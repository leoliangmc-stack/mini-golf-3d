import * as THREE from 'three';
import type { XYZ } from '../core/types';
import { cupLidOpenness } from '../game/cup';
import { RULES } from '../game/rules';
import { Session, type InputRecord, type SessionEvent, type ShotRecord } from '../game/session';
import { attachCameraGestures } from '../input/cameraGestures';
import { attachSlingshot, type Pull } from '../input/slingshot';
import { chapterOf, holeNumber } from '../level/chapters';
import type { ChapterDef, HoleDef, WorldDef } from '../level/schema';
import { DEFAULT_BALL, type Ball } from '../physics/ball';
import { isArm } from '../physics/zones/arm';
import { AimIndicator } from '../render/aimIndicator';
import { BallView } from '../render/ballView';
import { FollowCamera } from '../render/camera';
import { Explosion } from '../render/explosion';
import { buildFieldView, groundBounds, type FieldView } from '../render/fieldViews';
import { buildHoleView, disposeHoleView, type HoleView } from '../render/holeView';
import { buildMoverView, updateMoverView } from '../render/moverView';
import { OcclusionFader } from '../render/occlusion';
import { buildCrateView, buildPinView, updatePropView } from '../render/propViews';
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
  | { type: 'stuck' }
  /** The camera showed the player a part that had changed. `skipped`: they did not wait for it to finish. */
  | { type: 'showcase'; part: string; skipped: boolean }
  /** A moving part that sounds a note has arrived at the end of its travel: a piano key at the top (SPEC v6 3.9). */
  | { type: 'note'; degree: number }
  /** The lamp of a robot arm has changed to the next place it will go. */
  | { type: 'lamp' };

/** Ticks between the countdown running out and the hole starting over: long enough to see the blast. */
const RESTART_TICKS = 50;
/** How many times in a row the countdown may run out before the player is offered a way on. */
const EXPLOSIONS_BEFORE_OFFER = 3;
/**
 * How close to a ball on screen a tap has to land to pick it, in CSS pixels. Far more
 * than the ball covers, since a finger hides what it is aiming at (SPEC v3 2.4).
 */
const PICK_RADIUS_PX = 56;

/** Seconds the camera stays on a part that changed while the ball was rolling (SPEC v4 3.2). */
const SHOWCASE_SECONDS = 1.4;
/** A part this near the middle of the screen, as a share of it, needs no showing: it is in view already. */
const IN_VIEW = 0.62;

/** What a zone cue does to the picture of a ball that a zone has hold of. */
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
  /** How far the frame last drawn was between two physics steps, 0..1: for sound that follows the game's clock. */
  frameAlpha = 0;

  /** One picture per ball, by ball id. A ball's picture can outlive it for a moment, to fade. */
  private readonly ballViews = new Map<number, BallView>();
  /** Which cup each sinking ball is dropping into. */
  private readonly sinking = new Map<number, number>();
  private readonly aim = new AimIndicator();
  private readonly explosion = new Explosion();
  private readonly fader = new OcclusionFader();
  private holeView: HoleView | null = null;
  private moverViews: THREE.Object3D[] = [];
  private crateViews: THREE.Object3D[] = [];
  private pinViews: THREE.Object3D[] = [];
  /** One entry per zone of the hole, in order; null for zones that have nothing to show. */
  private zoneViews: (ZoneView | null)[] = [];
  private fieldView: FieldView | null = null;
  /** Seconds this hole has been on screen. */
  private time = 0;
  /** Parts that changed during the stroke under way, to be shown when the ball has stopped. */
  private toShow: string[] = [];
  /** Parts shown once already on this hole: each is shown only the first time. */
  private readonly shown = new Set<string>();
  /** The part the camera is on right now, and the seconds left of it. */
  private showing: { part: string; left: number } | null = null;
  private readonly showPoint = new THREE.Vector3();
  private pull: Pull | null = null;
  private readonly cupPoints: THREE.Vector3[] = [];
  /** Where the selected ball is drawn this frame. */
  private readonly focus = new THREE.Vector3();
  private readonly others: XYZ[] = [];
  /** Times in a row the countdown has run out on this hole. */
  private explosions = 0;
  /** Ticks until the hole starts over after the countdown ran out; 0 when it is not about to. */
  private restartIn = 0;
  /** What each robot arm's lamp showed at the last step, and which movers stood at the end of their travel. */
  private lamps: number[] = [];
  private arrived: boolean[] = [];
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
    stage.scene.add(this.aim.object, this.explosion.object);
    stage.onResize((w, h) => this.camera.setViewport(w, h));
    attachCameraGestures(canvas, this.camera);
    attachSlingshot(canvas, {
      canAim: () => this.canAim(),
      onAim: (pull) => {
        // Starting to aim is how the player says they have seen enough.
        if (pull) this.endShowcase(true);
        this.pull = pull;
        this.emit({ type: 'aim', power: pull ? pull.power : null });
      },
      onRelease: (pull) => {
        if (this.canAim()) this.session.shoot(this.shotDirection(pull), pull.power);
      },
      onTap: (x, y) => this.pickAt(x, y),
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

  /** True when the player has more than one ball to choose from for the next stroke. */
  get choosing(): boolean {
    const { session } = this;
    return session.balls.live.length > 1 && (session.phase === 'aiming' || session.frozen);
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
    this.crateViews = (hole.crates ?? []).map(buildCrateView);
    this.pinViews = this.session.goal.pins.map((pin) => buildPinView(pin.def.at));
    for (const view of [...this.moverViews, ...this.crateViews, ...this.pinViews]) group.add(view);
    this.zoneViews = hole.zones.map(buildZoneView);
    for (const view of this.zoneViews) if (view) group.add(view.object);
    this.fieldView = hole.field ? buildFieldView(hole.field, groundBounds(this.session.compiled.bodies)) : null;
    if (this.fieldView) group.add(this.fieldView.group);
    this.shown.clear();
    this.time = 0;
    this.stage.scene.add(group);
    this.fader.setOccluders(this.holeView.occluders);
    this.stage.applyTheme(getTheme(world.theme));
    this.stage.fitShadows(this.session.compiled.bounds);
    this.camera.configure(hole.camera);
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

  replay(inputs: readonly (InputRecord | ShotRecord)[]): void {
    this.session.replay(inputs);
  }

  /** Takes the last stroke back, if the hole allows it right now. */
  undo(): boolean {
    return !this.paused && !this.inputBlocked && !this.session.replaying && this.session.undo();
  }

  /** Uses a skill the hole gives, if it can be used right now. */
  useSkill(id: string): boolean {
    return !this.paused && !this.session.replaying && this.session.useSkill(id);
  }

  /** Lets time run again after a freeze, without a stroke. */
  resume(): boolean {
    return !this.paused && this.session.resume();
  }

  /** Picks the next ball (`step` 1) or the one before (-1) for the coming stroke. */
  pickNext(step: 1 | -1): void {
    if (!this.choosing) return;
    const { live, selected } = this.session.balls;
    this.session.select(live[(live.indexOf(selected) + step + live.length) % live.length]);
  }

  /** Picks the ball nearest to a point on screen, if one is near enough. */
  pickAt(x: number, y: number): void {
    if (!this.choosing || this.inputBlocked || this.paused) return;
    let best: Ball | null = null;
    let bestDistance = PICK_RADIUS_PX;
    for (const ball of this.session.balls.live) {
      const view = this.ballViews.get(ball.id);
      if (!view) continue;
      const at = this.screenPosition(view.object.position);
      const distance = Math.hypot(at.x - x, at.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = ball;
      }
    }
    if (best) this.session.select(best);
  }

  step(): void {
    if (this.paused) return;
    this.session.step();
    this.watchMachines();
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
   * Things machines do that the round has no need to know about, only the ear (SPEC v6
   * 3.9): a key reaching the top of its travel, an arm's lamp changing.
   */
  private watchMachines(): void {
    const { session } = this;
    if (!session.playing) return;
    session.movers.forEach((mover, i) => {
      const { note, motion, position } = mover.def;
      if (note === undefined || motion.type !== 'slide') return;
      const there = Math.abs(mover.pose.position.y - (position[1] + motion.offset[1])) < 1e-6;
      if (there && this.arrived[i] === false) this.emit({ type: 'note', degree: note });
      this.arrived[i] = there;
    });
    session.zones.forEach((zone, i) => {
      if (!isArm(zone)) return;
      const { next } = zone.pose;
      if (this.lamps[i] !== undefined && this.lamps[i] !== next) this.emit({ type: 'lamp' });
      this.lamps[i] = next;
    });
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

  render(frameAlpha: number, frameDt: number): void {
    const { session } = this;
    // While time is frozen nothing is between two steps: everything is where the last one left it.
    const alpha = session.frozen ? 1 : frameAlpha;
    this.frameAlpha = alpha;
    // The session rebuilds its movers, crates and zones on every retry, so look them up afresh.
    this.moverViews.forEach((view, i) => updateMoverView(view, session.movers[i], alpha));
    this.crateViews.forEach((view, i) => updatePropView(view, session.crates[i], alpha));
    this.pinViews.forEach((view, i) => updatePropView(view, session.goal.pins[i], alpha));
    this.zoneViews.forEach((view, i) => view?.update?.(session.zones[i], alpha));
    this.time += frameDt;
    if (session.field) this.fieldView?.update(session.field, { alpha, dt: frameDt, time: this.time });
    session.goal.cups.forEach((cup, i) => {
      const { prevPosition: was, position: now } = cup.pose;
      const point = (this.cupPoints[i] ??= new THREE.Vector3());
      point.set(was.x + (now.x - was.x) * alpha, was.y + (now.y - was.y) * alpha, was.z + (now.z - was.z) * alpha);
      this.holeView?.cups[i].update(point, cupLidOpenness(cup.def, session.world.tick), cup.active, frameDt);
    });

    const selected = session.ball;
    const choosing = this.choosing;
    this.others.length = 0;
    const drawn = new Set<number>();
    for (const ball of [...session.balls.live, ...session.balls.sunk]) {
      const view = this.viewOf(ball);
      drawn.add(ball.id);
      const cup = this.cupPoints[this.sinking.get(ball.id) ?? 0] ?? this.focus;
      const at = view.update(ball.pose, alpha, frameDt, cup);
      view.setPassedOver(choosing && ball !== selected);
      if (ball === selected) this.focus.copy(at);
      else if (session.balls.live.includes(ball)) this.others.push({ x: at.x, y: at.y, z: at.z });
    }
    // Balls taken off the course fade out where they were, then their pictures go.
    for (const [id, view] of this.ballViews) {
      if (drawn.has(id)) continue;
      view.update({ prevPosition: view.object.position, position: view.object.position }, 1, frameDt, this.focus);
      if (view.gone) this.dropView(id);
    }

    // A part being shown has the view to itself; otherwise it is the ball and the goal.
    const watched = this.watched(frameDt);
    if (watched) this.camera.update(watched, watched, frameDt);
    else this.camera.update(this.focus, session.goal.focus(), frameDt, this.others);
    this.fader.update(this.camera.camera.position, this.focus, frameDt);
    this.explosion.update(frameDt);
    const pull = this.pull;
    const radius = selected.props.radius;
    const aiming = session.phase === 'aiming' || session.frozen;
    if (!aiming || session.replaying) this.aim.hide();
    else if (pull && pull.power >= RULES.minPower) this.aim.showAim(this.focus, this.shotDirection(pull), pull.power, radius);
    else this.aim.showReady(this.focus, radius, frameDt);
    for (const listener of this.frameListeners) listener();
    this.stage.renderer.render(this.stage.scene, this.camera.camera);
  }

  /**
   * The part the camera has turned to, if any (SPEC v4 3.2). While the ball waits for a
   * chain to run, the part that is moving; and once the ball has stopped, each part that
   * changed out of sight during the stroke, one after another. Only ever with the ball
   * at rest: the camera never leaves one that is rolling.
   */
  private watched(frameDt: number): XYZ | null {
    const { session } = this;
    const field = session.field;
    if (!field) return null;
    if (this.showing) {
      this.showing.left -= frameDt;
      if (this.showing.left <= 0) this.endShowcase(false);
    }
    const part = this.showing ? field.part(this.showing.part) : session.waiting ? field.active : null;
    return part ? this.showPoint.set(part.anchor.x, part.anchor.y, part.anchor.z) : null;
  }

  /** Moves on to the next part waiting to be shown, if there is one. */
  private nextShowcase(): void {
    const field = this.session.field;
    this.showing = null;
    while (field && this.toShow.length > 0) {
      const part = this.toShow.shift()!;
      const at = field.part(part).anchor;
      const seen = this.projected.set(at.x, at.y, at.z).project(this.camera.camera);
      // Already in plain view: the player watched it happen.
      if (Math.abs(seen.x) < IN_VIEW && Math.abs(seen.y) < IN_VIEW && seen.z < 1) continue;
      this.showing = { part, left: SHOWCASE_SECONDS };
      return;
    }
  }

  private endShowcase(skipped: boolean): void {
    if (!this.showing) {
      if (skipped) this.toShow.length = 0;
      return;
    }
    const { part } = this.showing;
    this.emit({ type: 'showcase', part, skipped });
    if (skipped) {
      this.toShow.length = 0;
      this.showing = null;
    } else {
      this.nextShowcase();
    }
  }

  /** Where the selected ball is on screen, in CSS pixels. */
  ballScreenPosition(): { x: number; y: number } {
    return this.screenPosition(this.focus);
  }

  private screenPosition(point: THREE.Vector3): { x: number; y: number } {
    const p = this.projected.copy(point).project(this.camera.camera);
    return { x: ((p.x + 1) / 2) * window.innerWidth, y: ((1 - p.y) / 2) * window.innerHeight };
  }

  private canAim(): boolean {
    const { session } = this;
    const open = session.phase === 'aiming' || session.frozen;
    return !this.inputBlocked && !this.paused && !session.replaying && open;
  }

  private shotDirection(pull: Pull): XYZ {
    return this.camera.screenToGround(-pull.x, -pull.y);
  }

  /** The picture of a ball, made on first sight at the size the ball is. */
  private viewOf(ball: Ball): BallView {
    let view = this.ballViews.get(ball.id);
    if (!view) {
      view = new BallView(DEFAULT_BALL.radius);
      view.setSize(ball.props.radius / DEFAULT_BALL.radius, true);
      this.ballViews.set(ball.id, view);
      this.stage.scene.add(view.object);
    }
    return view;
  }

  private dropView(id: number): void {
    const view = this.ballViews.get(id);
    if (!view) return;
    this.stage.scene.remove(view.object);
    disposeHoleView(view.object);
    this.ballViews.delete(id);
    this.sinking.delete(id);
  }

  private resetView(): void {
    this.toShow.length = 0;
    this.showing = null;
    this.lamps = [];
    this.arrived = [];
    this.restartIn = 0;
    this.explosion.stop();
    for (const id of [...this.ballViews.keys()]) this.dropView(id);
    this.sinking.clear();
    const start = this.session.pose.position;
    this.focus.set(start.x, start.y, start.z);
    this.camera.snapTo(start, this.session.goal.focus());
  }

  private onSessionEvent(event: SessionEvent): void {
    switch (event.type) {
      case 'holed':
        this.sinking.set(event.ball, event.cup);
        this.ballViews.get(event.ball)?.startSink();
        break;
      case 'finished':
        this.toShow.length = 0;
        this.showing = null;
        this.explosions = 0;
        for (const view of this.ballViews.values()) view.setAlert(false);
        break;
      case 'reset':
        this.resetView();
        break;
      case 'partChanged':
        // Shown once per hole, the first time it happens. A part that keeps time changes
        // all the while, in plain sight: it is nothing to go and look at.
        if (!this.shown.has(event.part) && !this.session.field?.isClockwork(event.part)) {
          this.shown.add(event.part);
          this.toShow.push(event.part);
        }
        break;
      case 'stopped':
        this.nextShowcase();
        break;
      case 'shot':
        this.toShow.length = 0;
        this.showing = null;
        break;
      case 'outOfBounds':
      case 'undo':
        // What changed was put back: there is nothing to show.
        this.toShow.length = 0;
        this.showing = null;
        break;
      case 'ballRemoved':
        this.ballViews.get(event.ball)?.vanish();
        break;
      case 'resized': {
        const ball = this.session.balls.live.find((b) => b.id === event.ball);
        if (ball) this.viewOf(ball).setSize(ball.props.radius / DEFAULT_BALL.radius);
        break;
      }
      case 'cue': {
        const effect = BALL_CUES[event.name];
        if (effect) {
          // The cue does not say which ball: it is the one a zone has taken out of the simulation.
          for (const ball of this.session.balls.live) {
            if (!ball.body.isEnabled()) this.ballViews.get(ball.id)?.[effect]();
          }
        } else if (event.name === 'timerWarn') {
          for (const view of this.ballViews.values()) view.setAlert(true);
        }
        break;
      }
      case 'timeAdded':
        for (const view of this.ballViews.values()) view.setAlert(false);
        break;
      case 'exploded':
        this.explosions++;
        this.restartIn = RESTART_TICKS;
        this.explosion.start(this.focus);
        for (const view of this.ballViews.values()) view.hide();
        break;
    }
    this.emit(event);
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
