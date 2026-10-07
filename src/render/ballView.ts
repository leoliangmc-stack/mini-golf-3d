import * as THREE from 'three';
import type { XYZ } from '../core/types';
import type { BallPose } from '../game/session';

const SINK_SECONDS = 0.35;
/** Seconds the ball takes to shrink out of sight, or to grow back. */
const FADE_SECONDS = 0.12;
const OUTLINE = 0x1d2b3a;
const ALERT = 0xff3b30;

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
  private readonly outline: THREE.MeshBasicMaterial;

  constructor(private readonly radius: number) {
    const body = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 2),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    );
    body.castShadow = true;
    this.outline = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });
    const outline = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 1.14, 2), this.outline);
    // Drawn only where something is in front of the ball, so it can always be found
    // behind a wall, a pillar or a bridge (SPEC 2.10).
    const silhouette = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius * 1.14, 2),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
        depthFunc: THREE.GreaterDepth,
        depthWrite: false,
      }),
    );
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

  /** Makes the outline blink red: time is nearly up. */
  setAlert(on: boolean): void {
    this.alert = on;
    if (!on) this.outline.color.setHex(OUTLINE);
  }

  /** Call when the ball is put somewhere new: a fresh hole, a retry. */
  reset(): void {
    this.sink = -1;
    this.hasLast = false;
    this.shown = this.shownGoal = 1;
    this.setAlert(false);
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
        this.spin.setFromAxisAngle(this.axis.divideScalar(along), along / this.radius);
        this.object.quaternion.premultiply(this.spin);
      }
    }
    this.last.copy(p);
    this.hasLast = true;

    const change = frameDt / FADE_SECONDS;
    this.shown += Math.min(change, Math.max(-change, this.shownGoal - this.shown));
    let scale = this.shown;
    if (this.sink >= 0) {
      // Purely visual: the ball slides to the centre of the cup and drops out of sight.
      this.sink = Math.min(1, this.sink + frameDt / SINK_SECONDS);
      const t = this.sink * this.sink;
      p.x += (cup.x - p.x) * this.sink;
      p.z += (cup.z - p.z) * this.sink;
      p.y -= t * this.radius * 2.4;
      scale *= 1 - 0.35 * t;
    }
    this.object.visible = scale > 1e-3;
    this.object.scale.setScalar(Math.max(scale, 1e-3));
    if (this.alert) this.outline.color.setHex(performance.now() % 400 < 200 ? ALERT : OUTLINE);
    return p;
  }
}
