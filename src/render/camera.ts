import * as THREE from 'three';
import type { XYZ } from '../core/types';
import type { CameraOverride } from '../level/schema';

export interface CameraParams {
  /** Angle above the ground, in degrees. */
  pitch: number;
  /** Rotation around the up axis, in degrees. 0 looks toward -Z. */
  yaw: number;
  /** Closest and furthest the camera gets while framing the ball and the cup. */
  minDistance: number;
  maxDistance: number;
}

/** Used by every hole that does not override it. Mutable so the dev panel can tune it. */
export const CAMERA_DEFAULTS: CameraParams = { pitch: 52, yaw: 0, minDistance: 9, maxDistance: 28 };

/** Higher is snappier. The camera closes ~63% of the gap to its goal every 1/FOLLOW seconds. */
const FOLLOW = 4;
const RAD = Math.PI / 180;
/** Ground kept visible around the ball and the cup, in metres. */
const MARGIN_NEAR = 1.2;
const MARGIN_FAR = 1;
const MARGIN_SIDE = 2.5;
/**
 * Share of the view, from the centre toward the top and bottom edges, that framing may
 * use. The rest stays clear for the HUD at the top and for the thumb at the bottom.
 */
const USABLE_TOP = 0.66;
const USABLE_BOTTOM = 0.8;

/**
 * Third-person camera that keeps both the ball and the cup on screen: it pans and
 * zooms as the ball moves, and never rotates on its own.
 */
export class FollowCamera {
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
  params: CameraParams = { ...CAMERA_DEFAULTS };
  /** Player zoom on top of the automatic framing: below 1 is closer. */
  zoom = 1;
  /** Player rotation on top of the hole's own yaw, in degrees: where it is heading, and where it is now. */
  private turnGoal = 0;
  private turn = 0;
  private readonly look = new THREE.Vector3();
  private readonly goal = new THREE.Vector3();
  private distance = CAMERA_DEFAULTS.minDistance;

  /** Applies the defaults plus a hole's overrides. */
  configure(override: CameraOverride = {}): void {
    this.params = { ...CAMERA_DEFAULTS, ...override };
    this.zoom = 1;
    this.turnGoal = this.turn = 0;
  }

  /** Turns the view around the course. Only ever called for the player; the camera never turns by itself. */
  rotateBy(degrees: number): void {
    this.turnGoal += degrees;
  }

  zoomBy(factor: number): void {
    this.zoom = Math.min(1.8, Math.max(0.5, this.zoom * factor));
  }

  private get yaw(): number {
    return (this.params.yaw + this.turn) * RAD;
  }

  setViewport(width: number, height: number): void {
    // A viewport of no size (a tab opened in the background) must not put NaN into the
    // framing, where it would stay until the next hole.
    this.camera.aspect = width > 0 && height > 0 ? width / height : 1;
    this.camera.updateProjectionMatrix();
  }

  /** `others` are further points to keep in view: the other balls, after a split. */
  snapTo(ball: XYZ, cup: XYZ, others: readonly XYZ[] = []): void {
    this.distance = this.frame(ball, cup, others);
    this.look.copy(this.goal);
    this.place();
  }

  update(ball: XYZ, cup: XYZ, dt: number, others: readonly XYZ[] = []): void {
    this.turn += (this.turnGoal - this.turn) * (1 - Math.exp(-12 * dt));
    const wanted = this.frame(ball, cup, others);
    const k = 1 - Math.exp(-FOLLOW * dt);
    this.look.lerp(this.goal, k);
    this.distance += (wanted - this.distance) * k;
    this.place();
  }

  /**
   * Converts a direction on screen (x right, y down) into a direction on the ground,
   * so that dragging "down the screen" always means "toward the camera".
   */
  screenToGround(x: number, y: number): XYZ {
    const yaw = this.yaw;
    const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    return { x: right.x * x - forward.x * y, y: 0, z: right.z * x - forward.z * y };
  }

  /** Works out where to look (into `goal`) and from how far, to fit the ball, the cup and any other points. */
  private frame(ball: XYZ, cup: XYZ, others: readonly XYZ[]): number {
    const pitch = this.params.pitch * RAD;
    const yaw = this.yaw;
    const halfFov = (this.camera.fov * RAD) / 2;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);

    // Cup position relative to the ball: `ahead` along the view, `aside` across it.
    const ahead = (cup.x - ball.x) * fx + (cup.z - ball.z) * fz;
    const aside = (cup.x - ball.x) * rx + (cup.z - ball.z) * rz;
    // The stretch of ground to show, measured from the ball: it reaches to the cup and
    // to every other point.
    let back = Math.min(0, ahead);
    let front = Math.max(0, ahead);
    let left = Math.min(0, aside);
    let right = Math.max(0, aside);
    for (const p of others) {
      const a = (p.x - ball.x) * fx + (p.z - ball.z) * fz;
      const s = (p.x - ball.x) * rx + (p.z - ball.z) * rz;
      back = Math.min(back, a);
      front = Math.max(front, a);
      left = Math.min(left, s);
      right = Math.max(right, s);
    }
    const nearEdge = back - MARGIN_NEAR;
    const farEdge = front + MARGIN_FAR;
    const sideSpan = right - left + 2 * MARGIN_SIDE;

    // Ground visible beyond and before the look point, per metre of camera distance.
    const beyond = -Math.cos(pitch) + Math.sin(pitch) / Math.tan(Math.max(pitch - halfFov * USABLE_TOP, 0.15));
    const before = Math.cos(pitch) - Math.sin(pitch) / Math.tan(pitch + halfFov * USABLE_BOTTOM);

    const fitDepth = (farEdge - nearEdge) / (beyond + before);
    const fitWidth = sideSpan / (2 * 0.8 * Math.tan(halfFov) * this.camera.aspect);
    const { minDistance, maxDistance } = this.params;
    const distance = Math.min(Math.max(fitDepth, fitWidth, minDistance), maxDistance) * this.zoom;

    let lookAhead = nearEdge + before * fitDepth;
    if (distance < fitDepth) {
      // Too far apart to show both: keep the ball, with the cup's side of the view open.
      lookAhead = ahead >= 0 ? before * distance - MARGIN_NEAR : MARGIN_FAR - beyond * distance;
    }
    const lookAside = (left + right) / 2;
    this.goal.set(
      ball.x + fx * lookAhead + rx * lookAside,
      (ball.y + cup.y) / 2,
      ball.z + fz * lookAhead + rz * lookAside,
    );
    return distance;
  }

  private place(): void {
    const pitch = this.params.pitch * RAD;
    const yaw = this.yaw;
    const flat = Math.cos(pitch) * this.distance;
    this.camera.position.set(
      this.look.x + Math.sin(yaw) * flat,
      this.look.y + Math.sin(pitch) * this.distance,
      this.look.z + Math.cos(yaw) * flat,
    );
    this.camera.lookAt(this.look);
  }
}
