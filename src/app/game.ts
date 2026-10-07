import * as THREE from 'three';
import type { XYZ } from '../core/types';
import { cupAnchor, cupLidOpenness } from '../game/cup';
import { RULES } from '../game/rules';
import { Session, type SessionEvent, type ShotRecord } from '../game/session';
import { attachCameraGestures } from '../input/cameraGestures';
import { attachSlingshot, type Pull } from '../input/slingshot';
import { chapterOf, holeNumber } from '../level/chapters';
import type { ChapterDef, HoleDef, WorldDef } from '../level/schema';
import { DEFAULT_BALL } from '../physics/ball';
import { AimIndicator } from '../render/aimIndicator';
import { BallView } from '../render/ballView';
import { FollowCamera } from '../render/camera';
import { Explosion } from '../render/explosion';
import { buildHoleView, disposeHoleView, type HoleView } from '../render/holeView';
import { buildMoverView, updateMoverView } from '../render/moverView';
import { OcclusionFader } from '../render/occlusion';
import type { Stage } from '../render/scene';
import { getTheme } from '../render/theme';
import { buildZoneView, type ZoneView } from '../render/zoneViews';

export type GameEvent =
  | SessionEvent
  /** A hole was loaded. `intro` is false when the same hole is merely rebuilt. */
  | { type: 'hole'; intro: boolean }
  /** The player is dragging to aim (power 0..1), or stopped (null). */
  | { type: 'aim'; power: number | null }
  /** The countdown has kept running out on this hole: the player is offered a way on (SPEC v2 2.6). */
  | { type: 'stuck' };

/** Ticks between the countdown running out and the hole starting over: long enough to see the blast. */
const RESTART_TICKS = 50;
/** How many times in a row the countdown may run out before the player is offered a way on. */
const EXPLOSIONS_BEFORE_OFFER = 3;

/** What a zone cue does to the picture of the ball. */
const BALL_CUES: Record<string, 'vanish' | 'appear'> = { tunnelEnter: 'vanish', tunnelExit: 'appear' };

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
  /** Freezes the simulation, moving parts and countdown included. */
  paused = false;

  private readonly ballView = new BallView(DEFAULT_BALL.radius);
  private readonly aim = new AimIndicator();
  private readonly explosion = new Explosion();
  private readonly fader = new OcclusionFader();
  private holeView: HoleView | null = null;
  private moverViews: THREE.Object3D[] = [];
  /** One entry per zone of the hole, in order; null for zones that have nothing to show. */
  private zoneViews: (ZoneView | null)[] = [];
  private pull: Pull | null = null;
  /** Where the camera frames the cup: a point that stays put even when the cup does not. */
  private anchor: XYZ = { x: 0, y: 0, z: 0 };
  private readonly cupPoint = new THREE.Vector3();
  /** Times in a row the countdown has run out on this hole. */
  private explosions = 0;
  /** Ticks until the hole starts over after the countdown ran out; 0 when it is not about to. */
  private restartIn = 0;
  private readonly listeners = new Set<(event: GameEvent) => void>();
  private readonly frameListeners = new Set<() => void>();
  private readonly projected = new THREE.Vector3();

  constructor(
    readonly stage: Stage,
    canvas: HTMLCanvasElement,
    readonly chapters: readonly ChapterDef[],
    /** Everything that can be loaded, in play order: the chapters' worlds and finales, plus any extras. */
    readonly worlds: readonly WorldDef[],
  ) {
    stage.scene.add(this.ballView.object, this.aim.object, this.explosion.object);
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

  /** The chapter the current hole is part of, or null for the dev sandbox. */
  get chapter(): ChapterDef | null {
    return chapterOf(this.chapters, this.world);
  }

  /** True when the current hole is the one that closes its chapter. */
  get isFinale(): boolean {
    return this.chapter?.finale === this.world;
  }

  /** The number the current hole goes by: its place in the chapter for a finale, in its world otherwise. */
  get holeNumber(): number {
    const chapter = this.chapter;
    return chapter && this.isFinale ? holeNumber(chapter, this.world, this.holeIndex) : this.holeIndex + 1;
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
      this.stage.scene.remove(this.holeView.group);
      disposeHoleView(this.holeView.group);
    }
    this.world = world;
    this.holeIndex = index;
    const hole = this.hole;
    this.session = new Session(hole);
    this.session.on((event) => this.onSessionEvent(event));
    this.holeView = buildHoleView(this.session.compiled, hole);
    const { group } = this.holeView;
    this.moverViews = (hole.movers ?? []).map(buildMoverView);
    for (const view of this.moverViews) group.add(view);
    this.zoneViews = hole.zones.map(buildZoneView);
    for (const view of this.zoneViews) if (view) group.add(view.object);
    this.stage.scene.add(group);
    this.fader.setOccluders(this.holeView.occluders);
    this.stage.applyTheme(getTheme(world.theme));
    this.stage.fitShadows(this.session.compiled.bounds);
    this.camera.configure(hole.camera);
    this.anchor = cupAnchor(hole.cup);
    this.explosions = 0;
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

  /** Ends the hole at the stroke limit: the way on from a hole whose countdown keeps running out. */
  concede(): void {
    this.session.concede();
  }

  replay(shots: readonly ShotRecord[]): void {
    this.session.replay(shots);
  }

  step(): void {
    if (this.paused) return;
    this.session.step();
    if (this.restartIn > 0 && --this.restartIn === 0) {
      if (this.explosions >= EXPLOSIONS_BEFORE_OFFER) {
        this.explosions = 0;
        this.emit({ type: 'stuck' });
      } else {
        this.session.reset();
      }
    }
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
    // The session rebuilds its movers and zones on every retry, so look them up afresh.
    this.moverViews.forEach((view, i) => updateMoverView(view, session.movers[i], alpha));
    this.zoneViews.forEach((view, i) => view?.update?.(session.zones[i]));
    const { prevPosition: was, position: now } = session.cup;
    this.cupPoint.set(was.x + (now.x - was.x) * alpha, was.y + (now.y - was.y) * alpha, was.z + (now.z - was.z) * alpha);
    this.holeView?.cup.update(this.cupPoint, cupLidOpenness(session.hole.cup, session.world.tick));

    const ball = this.ballView.update(session.pose, alpha, frameDt, this.cupPoint);
    this.camera.update(ball, this.anchor, frameDt);
    this.fader.update(this.camera.camera.position, ball, frameDt);
    this.explosion.update(frameDt);
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

  private canAim(): boolean {
    return !this.inputBlocked && !this.paused && !this.session.replaying && this.session.phase === 'aiming';
  }

  private shotDirection(pull: Pull): XYZ {
    return this.camera.screenToGround(-pull.x, -pull.y);
  }

  private resetView(): void {
    this.restartIn = 0;
    this.explosion.stop();
    this.ballView.reset();
    this.camera.snapTo(this.session.pose.position, this.anchor);
  }

  private onSessionEvent(event: SessionEvent): void {
    switch (event.type) {
      case 'holed':
        this.ballView.startSink();
        break;
      case 'finished':
        this.explosions = 0;
        this.ballView.setAlert(false);
        break;
      case 'reset':
        this.resetView();
        break;
      case 'cue': {
        const effect = BALL_CUES[event.name];
        if (effect) this.ballView[effect]();
        else if (event.name === 'timerWarn') this.ballView.setAlert(true);
        break;
      }
      case 'timeAdded':
        this.ballView.setAlert(false);
        break;
      case 'exploded':
        this.explosions++;
        this.restartIn = RESTART_TICKS;
        this.explosion.start(this.ballView.object.position);
        this.ballView.hide();
        break;
    }
    this.emit(event);
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
