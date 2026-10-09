import * as THREE from 'three';
import type { XYZ } from '../core/types';
import type { BallPose } from '../game/session';

const SINK_SECONDS = 0.35;
/** Seconds the ball takes to shrink out of sight, or to grow back. */
const FADE_SECONDS = 0.12;
/** Seconds a change of size takes to show (SPEC v3 2.2). */
const RESIZE_SECONDS = 0.3;
const OUTLINE = 0x1d2b3a;
const ALERT = 0xff3b30;
const WHITE = 0xffffff;
/** A ball that is on the course but not the one picked for the next stroke. */
const PASSED_OVER = 0xaab4bf;
/** The shadow ball of a hole with a mirror (SPEC v8 3.4): dark, with a violet rim. */
const SHADOW_SKIN = 0x2b2140;
const SHADOW_RIM = 0xb690ff;

/** The ball: white, faceted so its roll is visible, with a dark outline for contrast. */
export class BallView {
  readonly object = new THREE.Group();
  private readonly last = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private readonly spin = new THREE.Quaternion();
  private hasLast = false;
  private sink = -1;
  /** How much of the ball is showing, 0..1, and where that is heading. */
  private shown = 1;
  private shownGoal = 1;
  private alert = false;
  /** How big the ball is drawn against the medium one, and where that is heading. */
  private size = 1;
  private sizeGoal = 1;
  private readonly outline: THREE.MeshBasicMaterial;
  private readonly skin: THREE.MeshLambertMaterial;
  private readonly silhouette: THREE.MeshBasicMaterial;
  private shadow = false;

  /** `radius` is that of the medium ball; other sizes are drawn as a scale of it. */
  constructor(private readonly radius: number) {
    this.skin = new THREE.MeshLambertMaterial({ color: WHITE, flatShading: true });
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 2), this.skin);
    body.castShadow = true;
    this.outline = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });
    const outline = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 1.14, 2), this.outline);
    // Drawn only where something is in front of the ball, so it can always be found
    // behind a wall, a pillar or a bridge (SPEC 2.10).
    this.silhouette = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      depthFunc: THREE.GreaterDepth,
      depthWrite: false,
    });
    const silhouette = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 1.14, 2), this.silhouette);
    silhouette.renderOrder = 5;
    this.object.add(body, outline, silhouette);
  }

  startSink(): void {
    this.sink = 0;
  }

  /** Shrinks the ball out of sight, e.g. as it goes into a tunnel. */
  vanish(): void {
    this.shownGoal = 0;
  }

  /** Grows the ball back after `vanish`. */
  appear(): void {
    this.shownGoal = 1;
  }

  /** Removes the ball at once. `reset` brings it back. */
  hide(): void {
    this.shown = this.shownGoal = 0;
  }

  /** True once a ball told to vanish is out of sight, and its view can be thrown away. */
  get gone(): boolean {
    return this.shownGoal === 0 && this.shown <= 1e-3;
  }

  /** Sets how big the ball is against the medium one. It gets there over a moment, or at once. */
  setSize(scale: number, atOnce = false): void {
    this.sizeGoal = scale;
    if (atOnce) this.size = scale;
  }

  /** Greys the ball out: it is on the course, but another one is picked for the next stroke. */
  setPassedOver(on: boolean): void {
    if (this.shadow) return;
    this.skin.color.setHex(on ? PASSED_OVER : WHITE);
  }

  /** Draws the ball as the shadow of a hole with a mirror: dark where the player's is white. */
  setShadow(): void {
    this.shadow = true;
    this.skin.color.setHex(SHADOW_SKIN);
    this.skin.emissive.setHex(0x3a1f66);
    this.outline.color.setHex(SHADOW_RIM);
    this.silhouette.color.setHex(SHADOW_RIM);
  }

  /** Makes the outline blink red: time is nearly up. */
  setAlert(on: boolean): void {
    this.alert = on;
    if (!on) this.outline.color.setHex(this.shadow ? SHADOW_RIM : OUTLINE);
  }

  /** Call when the ball is put somewhere new: a fresh hole, a retry. */
  reset(): void {
    this.sink = -1;
    this.hasLast = false;
    this.shown = this.shownGoal = 1;
    this.size = this.sizeGoal = 1;
    this.setAlert(false);
    this.setPassedOver(false);
    this.object.scale.setScalar(1);
  }

  /**
   * Places the ball between its last two physics positions and rolls it by the distance
   * moved (the physics ball does not rotate). Returns the point the camera should follow.
   */
  update(pose: BallPose, alpha: number, frameDt: number, cup: XYZ): THREE.Vector3 {
    const { prevPosition: a, position: b } = pose;
    const p = this.object.position;
    p.set(a.x + (b.x - a.x) * alpha, a.y + (b.y - a.y) * alpha, a.z + (b.z - a.z) * alpha);

    const dx = p.x - this.last.x;
    const dy = p.y - this.last.y;
    const dz = p.z - this.last.z;
    const moved = Math.hypot(dx, dy, dz);
    // Skip the first frame and teleports.
    if (this.hasLast && moved > 1e-6 && moved < 1) {
      // Axis = up x movement, with the course floor's +Y as up.
      this.axis.set(dz, 0, -dx);
      const along = this.axis.length();
      if (along > 1e-6) {
        this.spin.setFromAxisAngle(this.axis.divideScalar(along), along / (this.radius * this.size));
        this.object.quaternion.premultiply(this.spin);
      }
    }
    this.last.copy(p);
    this.hasLast = true;

    const change = frameDt / FADE_SECONDS;
    this.shown += Math.min(change, Math.max(-change, this.shownGoal - this.shown));
    // The picture eases to the new size; the physics changed at once, so the middle of
    // the ball is already at the height its new size puts it.
    this.size += (this.sizeGoal - this.size) * Math.min(1, (frameDt / RESIZE_SECONDS) * 3);
    let scale = this.shown * this.size;
    if (this.sink >= 0) {
      // Purely visual: the ball slides to the centre of the cup and drops out of sight.
      this.sink = Math.min(1, this.sink + frameDt / SINK_SECONDS);
      const t = this.sink * this.sink;
      p.x += (cup.x - p.x) * this.sink;
      p.z += (cup.z - p.z) * this.sink;
      p.y -= t * this.radius * this.size * 2.4;
      scale *= 1 - 0.35 * t;
    }
    this.object.visible = scale > 1e-3;
    this.object.scale.setScalar(Math.max(scale, 1e-3));
    if (this.alert) this.outline.color.setHex(performance.now() % 400 < 200 ? ALERT : OUTLINE);
    return p;
  }
}
