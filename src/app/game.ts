import * as THREE from 'three';
import type { XYZ } from '../core/types';
import { RULES } from '../game/rules';
import { Session, type SessionEvent, type ShotRecord } from '../game/session';
import { attachCameraGestures } from '../input/cameraGestures';
import { attachSlingshot, type Pull } from '../input/slingshot';
import type { HoleDef, WorldDef } from '../level/schema';
import { DEFAULT_BALL } from '../physics/ball';
import { AimIndicator } from '../render/aimIndicator';
import { BallView } from '../render/ballView';
import { FollowCamera } from '../render/camera';
import { buildHoleView, disposeHoleView } from '../render/holeView';
import { buildMoverView, updateMoverView } from '../render/moverView';
import type { Stage } from '../render/scene';
import { getTheme } from '../render/theme';
import { buildZoneView } from '../render/zoneViews';

export type GameEvent =
  | SessionEvent
  /** A hole was loaded. `intro` is false when the same hole is merely rebuilt. */
  | { type: 'hole'; intro: boolean }
  /** The player is dragging to aim (power 0..1), or stopped (null). */
  | { type: 'aim'; power: number | null };

/**
 * Glue between the simulation and the screen: owns the current hole's session and
 * view, routes input into it, and tells the UI what happened.
 */
export class Game {
  readonly camera = new FollowCamera();
  world!: WorldDef;
  holeIndex = 0;
  session!: Session;
  /** Set by UI that is covering the course and must not let a stroke through. */
  inputBlocked = false;
  /** Freezes the simulation, moving parts included. */
  paused = false;

  private readonly ballView = new BallView(DEFAULT_BALL.radius);
  private readonly aim = new AimIndicator();
  private holeView: THREE.Group | null = null;
  private moverViews: THREE.Object3D[] = [];
  private pull: Pull | null = null;
  private readonly listeners = new Set<(event: GameEvent) => void>();
  private readonly frameListeners = new Set<() => void>();
  private readonly projected = new THREE.Vector3();

  constructor(
    readonly stage: Stage,
    canvas: HTMLCanvasElement,
    readonly worlds: readonly WorldDef[],
  ) {
    stage.scene.add(this.ballView.object, this.aim.object);
    stage.onResize((w, h) => this.camera.setViewport(w, h));
    attachCameraGestures(canvas, this.camera);
    attachSlingshot(canvas, {
      canAim: () => this.canAim(),
      onAim: (pull) => {
        this.pull = pull;
        this.emit({ type: 'aim', power: pull ? pull.power : null });
      },
      onRelease: (pull) => {
        if (this.canAim()) this.session.shoot(this.shotDirection(pull), pull.power);
      },
    });
  }

  get hole(): HoleDef {
    return this.world.holes[this.holeIndex];
  }

  get isLastHole(): boolean {
    return this.holeIndex >= this.world.holes.length - 1;
  }

  on(listener: (event: GameEvent) => void): void {
    this.listeners.add(listener);
  }

  /** Runs after the scene is updated each frame, before it is drawn. */
  onFrame(listener: () => void): void {
    this.frameListeners.add(listener);
  }

  loadHole(world: WorldDef, index: number, intro = true): void {
    this.session?.dispose();
    if (this.holeView) {
      this.stage.scene.remove(this.holeView);
      disposeHoleView(this.holeView);
    }
    this.world = world;
    this.holeIndex = index;
    const hole = this.hole;
    this.session = new Session(hole);
    this.session.on((event) => this.onSessionEvent(event));
    this.holeView = buildHoleView(this.session.compiled, hole.cup);
    this.moverViews = (hole.movers ?? []).map(buildMoverView);
    for (const view of this.moverViews) this.holeView.add(view);
    for (const zone of hole.zones) {
      const view = buildZoneView(zone);
      if (view) this.holeView.add(view);
    }
    this.stage.scene.add(this.holeView);
    this.stage.applyTheme(getTheme(world.theme));
    this.stage.fitShadows(this.session.compiled.bounds);
    this.camera.configure(hole.camera);
    this.resetView();
    this.emit({ type: 'hole', intro });
  }

  /** Rebuilds the current hole from its data, e.g. after the dev panel changed it. */
  reloadHole(): void {
    this.loadHole(this.world, this.holeIndex, false);
  }

  retry(): void {
    this.session.reset();
  }

  /** Goes to the next hole, or back to the first one after the last. */
  nextHole(): void {
    this.loadHole(this.world, this.isLastHole ? 0 : this.holeIndex + 1);
  }

  replay(shots: readonly ShotRecord[]): void {
    this.session.replay(shots);
  }

  step(): void {
    if (!this.paused) this.session.step();
  }

  /**
   * How deep the ball is inside a magnet's field, 0..1, and whether that magnet attracts.
   * For the hum; the physics does its own sums.
   */
  magnetProximity(): { level: number; attracts: boolean } {
    const p = this.session.pose.position;
    let level = 0;
    let attracts = true;
    for (const zone of this.hole.zones) {
      if (zone.type !== 'magnet' || zone.shape.kind !== 'sphere') continue;
      const [x, , z] = zone.shape.center;
      const near = 1 - Math.hypot(p.x - x, p.z - z) / zone.shape.radius;
      if (near > level) {
        level = near;
        attracts = Number(zone.params?.strength ?? 1) > 0;
      }
    }
    return { level, attracts };
  }

  render(alpha: number, frameDt: number): void {
    const { session } = this;
    // The session rebuilds its movers on every retry, so look them up afresh.
    this.moverViews.forEach((view, i) => updateMoverView(view, session.movers[i], alpha));
    const ball = this.ballView.update(session.pose, alpha, frameDt, session.hole.cup);
    this.camera.update(ball, this.cupPoint, frameDt);
    const pull = this.pull;
    const radius = session.ball.props.radius;
    if (session.phase !== 'aiming' || session.replaying) this.aim.hide();
    else if (pull && pull.power >= RULES.minPower) this.aim.showAim(ball, this.shotDirection(pull), pull.power, radius);
    else this.aim.showReady(ball, radius, frameDt);
    for (const listener of this.frameListeners) listener();
    this.stage.renderer.render(this.stage.scene, this.camera.camera);
  }

  /** Where the ball is on screen, in CSS pixels. */
  ballScreenPosition(): { x: number; y: number } {
    const p = this.projected.copy(this.ballView.object.position).project(this.camera.camera);
    return { x: ((p.x + 1) / 2) * window.innerWidth, y: ((1 - p.y) / 2) * window.innerHeight };
  }

  private get cupPoint(): XYZ {
    const [x, y, z] = this.hole.cup.position;
    return { x, y, z };
  }

  private canAim(): boolean {
    return !this.inputBlocked && !this.paused && !this.session.replaying && this.session.phase === 'aiming';
  }

  private shotDirection(pull: Pull): XYZ {
    return this.camera.screenToGround(-pull.x, -pull.y);
  }

  private resetView(): void {
    this.ballView.reset();
    this.camera.snapTo(this.session.pose.position, this.cupPoint);
  }

  private onSessionEvent(event: SessionEvent): void {
    if (event.type === 'holed') this.ballView.startSink();
    if (event.type === 'reset') this.resetView();
    this.emit(event);
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
