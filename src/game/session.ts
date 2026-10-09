import { FIXED_DT } from '../core/loop';
import { cos, hypot, sin } from '../core/math';
import type { Vec3, XYZ } from '../core/types';
import { xyz } from '../core/types';
import { compileHole, type CompiledHole } from '../level/compile';
import { buildHolePhysics } from '../level/physicsBuilder';
import type { BallSize, HoleDef, MoverDef } from '../level/schema';
import { DEFAULT_BALL, SIZE_ORDER, type Ball, type BallPose, type BallProps } from '../physics/ball';
import { fitBall } from '../physics/fit';
import { Mover, moverPose, type MoverPose } from '../physics/movers';
import { Crate } from '../physics/props';
import { applySurface, probeGround, SurfaceMap, type ColliderKind, type GroundProbe } from '../physics/surfaces';
import { PhysicsWorld } from '../physics/world';
import { createZone, type Zone, type ZoneContext, type ZoneEvent } from '../physics/zones';
import { shapeContains } from '../physics/zones/shape';
import { BallSet } from './ballSet';
import { challengeMet, emptyStats, type RoundStats } from './challenges';
import { cupOpenAt, cupPositionAt, type CupPose } from './cup';
import { Field, type FieldState, type TurnCheck } from './field/field';
import type { Boss } from './field/quest';
import { Goal, type CupState } from './goal';
import { cupCaptures, RULES, starsFor, StopDetector } from './rules';
import { getSkill, type SkillHost, type SkillState } from './skills';

export type { BallPose } from '../physics/ball';

/** `exploded`: the hole's countdown ran out; the round is dead until it is reset or conceded. */
export type Phase = 'aiming' | 'rolling' | 'exploded' | 'done';

/** Everything needed to reproduce a stroke: same tick, direction and power give the same result. */
export interface ShotRecord {
  tick: number;
  dir: Vec3;
  power: number;
  /** Which ball was struck, as its place among the balls in play. Left out for the first. */
  ball?: number;
}

/**
 * One thing the player did, and the physics tick it was done on. A round is exactly its
 * inputs: played back in order on the same ticks, they end the same way (SPEC v3 2.9).
 * Picking a ball is not an input of its own; the stroke that follows says which.
 */
export type InputRecord =
  | ({ type: 'shot' } & ShotRecord)
  | { type: 'skill'; tick: number; id: string }
  /** Time was let run again after a freeze, without a stroke. */
  | { type: 'resume'; tick: number }
  /** The last stroke was taken back, at the cost of one more. */
  | { type: 'undo'; tick: number }
  /** The player turned a wall group by hand: `part` is its id (SPEC v7 3.5). It costs no stroke. */
  | { type: 'rotate'; tick: number; part: string };

/** How a hole ended. */
export interface Outcome {
  /** True when the hole's goal was met, whatever it was; false when the stroke limit ended the hole. */
  holed: boolean;
  strokes: number;
  stars: 1 | 2 | 3;
  challengeMet: boolean;
  /** Physics ticks from the first stroke to the end. */
  ticks: number;
}

/** Balls are told apart by their `id` in events. */
export type SessionEvent =
  /** `frozen`: the stroke was played while time stood still, possibly in mid-air. */
  | { type: 'shot'; strokes: number; power: number; ball: number; frozen: boolean }
  | { type: 'stopped' }
  /** The ball hit something. `speed` is how much its velocity changed, in m/s. */
  | { type: 'bounce'; kind: ColliderKind; speed: number }
  /** The last ball in play left the course and was put back, at the cost of a stroke. */
  | { type: 'outOfBounds'; strokes: number }
  /** A monster caught the ball (SPEC v9 3.2): the stroke was taken back, at the cost of a stroke. */
  | { type: 'caught'; strokes: number }
  /** The rolling ball moved onto a different surface. */
  | { type: 'surface'; id: string }
  /** A named moment, e.g. a cannon firing, for sound and effects. */
  | { type: 'cue'; name: string }
  /** A ball dropped into a cup. `cup` is its place among the goal's cups. */
  | { type: 'holed'; strokes: number; ball: number; cup: number }
  /** A zone added time to the hole's countdown. */
  | { type: 'timeAdded'; seconds: number }
  /** The hole's countdown ran out. */
  | { type: 'exploded' }
  | { type: 'finished'; outcome: Outcome }
  | { type: 'reset' }
  /** A ball split off another one. */
  | { type: 'ballAdded'; ball: number; from: number }
  /** A ball left the course while others play on, or was not the one picked for the next stroke. */
  | { type: 'ballRemoved'; ball: number; reason: 'outOfBounds' | 'unpicked' }
  | { type: 'resized'; ball: number; size: BallSize }
  /** The player picked the ball to play next. */
  | { type: 'selected'; ball: number }
  | { type: 'frozen' }
  | { type: 'resumed' }
  /** A pin went down. `left` is how many are still standing. */
  | { type: 'pinDown'; pin: number; left: number }
  /** A cup that was not there yet has appeared: the steps before it are done. */
  | { type: 'cupAppeared'; cup: number }
  /** The last stroke was taken back: the ball and the course are as they were before it. */
  | { type: 'undo'; strokes: number }
  /** One of the works of the hole changed what it is doing: a gate opened, a block set off. */
  | { type: 'partChanged'; part: string }
  /** The player turned a wall group. `left` is how many turns the hole still allows. */
  | { type: 'rotated'; part: string; left: number };

/** Impacts gentler than this are contact noise, not bounces. */
const MIN_BOUNCE_SPEED = 0.3;
const TICKS_PER_SECOND = Math.round(1 / FIXED_DT);
/** The countdown warns once a second from this many seconds out. */
const WARNING_SECONDS = 3;
const STILL: XYZ = { x: 0, y: 0, z: 0 };
const RAD = Math.PI / 180;
/** Most balls a hole may have on the course at once (SPEC v3 2.4). */
const MAX_BALLS = 4;
/** Ticks a stroke waits for crates and pins to settle once the balls have stopped. */
const PROP_SETTLE_TICKS = 240;
/**
 * Ticks a stroke waits for the works of the hole to finish moving. They always do; this
 * only keeps a mistake in a hole's data from holding a stroke open for ever.
 */
const FIELD_SETTLE_TICKS = 1800;

/** The course as it was when a stroke was played: what an out-of-bounds or an undo goes back to. */
interface Snapshot {
  position: XYZ;
  size: BallSize;
  field: FieldState;
  /** Where the shadow ball lay, on a hole with a mirror (SPEC v8 3.7). */
  shadow?: XYZ;
}

/** What the session keeps about one ball from step to step. */
interface Track {
  stop: StopDetector;
  /** A zone is holding the ball this step, so it must not be judged as stopped. */
  busy: boolean;
  /** A zone moved the ball by hand this step. */
  snap: boolean;
  probe: GroundProbe | null;
  /** On the ground at the last step it was looked for: what zones are told. */
  grounded: boolean;
  lastSurface: string | null;
  before: XYZ;
}

/**
 * One attempt at one hole: physics world, balls, rules and score.
 * Has no rendering or DOM dependencies, so it runs unchanged in tests.
 */
export class Session implements SkillHost {
  readonly compiled: CompiledHole;
  phase: Phase = 'aiming';
  strokes = 0;
  /** Everything the player has done this round, in order. */
  inputs: InputRecord[] = [];
  stats: RoundStats = emptyStats();
  /** Set once the hole is over. */
  outcome: Outcome | null = null;
  world!: PhysicsWorld;
  balls!: BallSet;
  goal!: Goal;
  movers: Mover[] = [];
  crates: Crate[] = [];
  /** Plates, gates, stones and the rest of the hole's works; null on a hole that has none. */
  field: Field | null = null;
  /** The balls have stopped and the stroke is waiting for something else to: a chain still running. */
  waiting = false;
  /** The live zones, in the order of the hole's data. Rebuilt on every reset. */
  zones: Zone[] = [];
  /** Skills this hole gives the player, by id, with the uses left. */
  skills = new Map<string, SkillState>();
  /** Time stands still: no tick passes until a stroke is played or time is let run again. */
  frozen = false;
  /** Physics ticks left on the hole's countdown, or null if the hole has none. */
  timeLeft: number | null = null;

  private surfaces!: SurfaceMap;
  private timerRunning = false;
  private zoneEvents: { event: ZoneEvent; ball: Ball }[] = [];
  private zoneContext!: ZoneContext;
  private tracks = new WeakMap<Ball, Track>();
  private lastShotPosition!: XYZ;
  /** Size of the ball when the last stroke was played from the ground. */
  private lastShotSize: BallSize = 'medium';
  /** Where the shadow ball lay when the last stroke was played: where it returns to if it leaves the course. */
  private shadowFrom: XYZ = STILL;
  private tilted = false;
  private firstShotTick = 0;
  /** The goal is met; the round ends once any ball still under way has settled. */
  private won = false;
  /** Ticks the balls have been at rest while crates or pins were still moving. */
  private propWait = 0;
  /** The works have had their turn since the stroke was played (SPEC v9 3.2): once a stroke. */
  private turnTaken = false;
  /** The same, for the works of the hole. */
  private fieldWait = 0;
  /** The course before each stroke still standing, oldest first (SPEC v4 3.8). Only on a hole with works. */
  private snapshots: Snapshot[] = [];
  private replayQueue: InputRecord[] = [];
  /** What each ball ran into during the last step. Emptied and refilled every step. */
  private readonly hits = new Map<Ball, { kind: ColliderKind; handle: number }[]>();
  private readonly listeners = new Set<(event: SessionEvent) => void>();

  constructor(
    readonly hole: HoleDef,
    private readonly ballProps: BallProps = DEFAULT_BALL,
  ) {
    this.compiled = compileHole(hole);
    this.build();
  }

  /** True while the hole is being played: a stroke can be made, or one is under way. */
  get playing(): boolean {
    return this.phase === 'aiming' || this.phase === 'rolling';
  }

  get strokeLimit(): number {
    return this.hole.strokeLimit ?? this.hole.par * 2;
  }

  /** How many balls a split may leave on the course at once. */
  get maxBalls(): number {
    return Math.min(MAX_BALLS, Math.max(1, this.hole.maxBalls ?? 1));
  }

  /** The ball the next stroke is played with: the only one, unless there was a split. */
  get ball(): Ball {
    return this.balls.selected;
  }

  /** The shadow ball, on a hole with a mirror (SPEC v8 3.4). */
  get shadow(): Ball | null {
    return this.balls.shadow;
  }

  /**
   * True while a stroke would set the shadow off too: the hole has a mirror, and the
   * ball lies in the part of the course the mirror shows.
   */
  get mirroring(): boolean {
    const mirror = this.hole.mirror;
    return mirror !== undefined && (mirror.reach === undefined || shapeContains(mirror.reach, this.ball.position()));
  }

  /** Where the selected ball was at the last two physics steps. */
  get pose(): BallPose {
    return this.balls.selected.pose;
  }

  /** Where the hole's first cup is. Only for holes that have one. */
  get cup(): CupPose {
    return this.goal.cups[0].pose;
  }

  /** The strokes of the round so far, without its other inputs. */
  get shots(): ShotRecord[] {
    return this.inputs.filter((input) => input.type === 'shot');
  }

  on(listener: (event: SessionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Restarts the hole from the tee with a fresh physics world, so replays are exact. */
  reset(): void {
    this.world.free();
    this.build();
    this.emit({ type: 'reset' });
  }

  /** Restarts the hole and plays recorded inputs back at their original ticks. */
  replay(inputs: readonly (InputRecord | ShotRecord)[]): void {
    this.reset();
    this.replayQueue = inputs.map((input) => ({ type: 'shot', ...input }));
  }

  get replaying(): boolean {
    return this.replayQueue.length > 0;
  }

  dispose(): void {
    this.world.free();
    this.listeners.clear();
  }

  /**
   * Strikes a ball: the selected one unless another is named. With several balls at
   * rest, the others are taken off the course. Returns false if a stroke is not allowed
   * right now.
   *
   * While time is frozen the stroke is played from wherever the ball is, mid-air
   * included, and replaces its speed outright (SPEC v3 2.3); the other balls keep theirs.
   */
  shoot(dir: XYZ, power: number, ball: Ball = this.balls.selected): boolean {
    const frozen = this.frozen;
    const shadow = this.balls.shadow;
    // The shadow is struck with the player's ball, never by itself.
    if (ball === shadow) return false;
    if (frozen ? this.strokes >= this.strokeLimit : this.phase !== 'aiming') return false;
    // A wall group that is still swinging round has to come to rest first (SPEC v7 5).
    if (this.field?.turning) return false;
    // A zone holding the ball (a tunnel, a cannon) has to let go of it first.
    if (!this.balls.live.includes(ball) || this.track(ball).busy) return false;
    const p = Math.min(1, power);
    if (p < RULES.minPower) return false;
    const from = { ...ball.position() };
    const mirrored = shadow !== null && this.mirroring;
    if (!ball.launch(dir, p * RULES.maxShotSpeed)) return false;
    const index = this.balls.live.indexOf(ball);
    if (frozen) {
      this.frozen = false;
      // The stroke before this one ended here, in a manner of speaking.
      this.stats.rests.push(from);
      // Time can be frozen while the ball lies on the ground waiting for a pin to
      // settle; a stroke played then is a stroke from the ground like any other.
      if (this.track(ball).probe?.grounded) {
        this.lastShotPosition = from;
        this.lastShotSize = ball.state.size;
        this.keep(from, ball.state.size);
      }
    } else {
      for (const other of [...this.balls.live]) {
        if (other === ball || other === shadow) continue;
        this.balls.remove(other);
        this.emit({ type: 'ballRemoved', ball: other.id, reason: 'unpicked' });
      }
      // A ball that leaves the course comes back here, so only strokes from the ground count.
      this.lastShotPosition = from;
      this.lastShotSize = ball.state.size;
      this.keep(from, ball.state.size);
    }
    this.balls.selected = ball;
    if (shadow) {
      // The same stroke, the other way round, from wherever the shadow lies (SPEC v8 3.4).
      this.shadowFrom = { ...shadow.position() };
      if (mirrored) {
        const flip = this.hole.mirror!.axis === 'x';
        shadow.launch({ x: flip ? -dir.x : dir.x, y: 0, z: flip ? dir.z : -dir.z }, p * RULES.maxShotSpeed);
        this.track(shadow).stop.reset();
        this.cue('mirrorShot');
      }
    }
    // After the snapshot: what a part does about a stroke is part of that stroke.
    this.field?.struck(ball);
    if (this.strokes === 0) {
      this.firstShotTick = this.world.tick;
      // The countdown starts with the first stroke and never waits for the player again.
      this.timerRunning = true;
    }
    const record: InputRecord = { type: 'shot', tick: this.world.tick, dir: [dir.x, dir.y, dir.z], power: p };
    if (index > 0) record.ball = index;
    this.inputs.push(record);
    this.strokes++;
    this.phase = 'rolling';
    this.track(ball).stop.reset();
    this.propWait = 0;
    this.fieldWait = 0;
    this.turnTaken = false;
    if (frozen) this.cue('airShot');
    this.emit({ type: 'shot', strokes: this.strokes, power: p, ball: ball.id, frozen });
    if (frozen) this.emit({ type: 'resumed' });
    return true;
  }

  /** Picks the ball the next stroke is played with. Returns false if it cannot be picked now. */
  select(ball: Ball): boolean {
    if (!(this.phase === 'aiming' || this.frozen) || !this.balls.playable.includes(ball)) return false;
    if (this.balls.selected === ball) return true;
    this.balls.selected = ball;
    this.emit({ type: 'selected', ball: ball.id });
    return true;
  }

  /** Whether a skill can be used right now: the hole has it, uses are left, and the moment is right. */
  canUseSkill(id: string): boolean {
    const skill = this.skills.get(id);
    return skill !== undefined && skill.charges > 0 && getSkill(id).ready(this);
  }

  /** Uses a skill, spending one of its uses. Returns false if it cannot be used right now. */
  useSkill(id: string): boolean {
    if (!this.canUseSkill(id)) return false;
    this.skills.get(id)!.charges--;
    this.inputs.push({ type: 'skill', tick: this.world.tick, id });
    getSkill(id).use(this);
    return true;
  }

  /** Lets time run again after a freeze, without a stroke. */
  resume(): boolean {
    if (!this.frozen) return false;
    this.inputs.push({ type: 'resume', tick: this.world.tick });
    this.setFrozen(false);
    return true;
  }

  /**
   * True on a hole where a stroke can be taken back at all: one whose works hold
   * something a ball can change. Works that only keep time have nothing to put back
   * (SPEC v6 3.1), so a hole of beat gates has no undo any more than one of moving parts.
   */
  get rewindable(): boolean {
    return this.field?.rewindable ?? false;
  }

  /** Whether the last stroke can be taken back right now. */
  get canUndo(): boolean {
    return (
      this.rewindable && this.phase === 'aiming' && !this.frozen && !this.field?.turning && this.snapshots.length > 0
    );
  }

  /**
   * Whether the player can turn the wall group called `id` right now (SPEC v7 3.5), and
   * if not, why not. Only between strokes: a group is never turned under a rolling ball.
   */
  turnCheck(id: string): TurnCheck {
    if (!this.field || this.phase !== 'aiming' || this.frozen) return 'none';
    return this.field.turnCheck(id);
  }

  /**
   * Turns a wall group a quarter turn clockwise. It costs one of the hole's turns and
   * no stroke. Like a stroke it is an input of the round, played back on its own tick.
   */
  rotate(id: string): boolean {
    if (this.turnCheck(id) !== 'ok' || !this.field!.turn(id)) return false;
    this.inputs.push({ type: 'rotate', tick: this.world.tick, part: id });
    this.emit({ type: 'rotated', part: id, left: this.field!.turnsLeft });
    return true;
  }

  /**
   * Takes the last stroke back (SPEC v4 3.8): the ball and every part of the course
   * return to how they were when it was played, and it costs a stroke, exactly as going
   * out of bounds does. The way out of a stone shoved where it cannot be shoved back from.
   */
  undo(): boolean {
    if (!this.canUndo) return false;
    this.inputs.push({ type: 'undo', tick: this.world.tick });
    this.rewind(this.ball, this.snapshots.pop()!);
    this.strokes++;
    this.stats.undos++;
    this.emit({ type: 'undo', strokes: this.strokes });
    if (this.strokes >= this.strokeLimit) this.finish(false);
    return true;
  }

  setFrozen(frozen: boolean): void {
    if (frozen === this.frozen) return;
    this.frozen = frozen;
    this.cue(frozen ? 'freeze' : 'resume');
    this.emit({ type: frozen ? 'frozen' : 'resumed' });
  }

  hasFreeBall(): boolean {
    return this.balls.live.some((ball) => !this.track(ball).busy);
  }

  /**
   * Gives the hole up: it ends at the stroke limit, exactly as if that had been reached.
   * The way out of a hole whose countdown keeps running out.
   */
  concede(): void {
    if (this.phase !== 'done') this.finish(false);
  }

  /** Advances the simulation by exactly one fixed step, unless time is frozen. */
  step(): void {
    const { world } = this;
    while (this.replayQueue.length > 0 && this.replayQueue[0].tick <= world.tick) {
      this.apply(this.replayQueue.shift()!);
    }
    if (this.frozen) return;

    const balls = this.balls.live;
    for (const ball of balls) {
      const track = this.track(ball);
      track.busy = false;
      track.snap = false;
      track.probe = null;
    }
    if (this.playing) {
      // Gravity zones override this for the step; everywhere else it is the default again.
      world.setGravity([0, -RULES.gravity, 0]);
      for (const zone of this.zones) {
        // A ball that splits off during this pass meets the zone from the next step on.
        const count = balls.length;
        for (let i = 0; i < count; i++) {
          this.zoneContext.ball = balls[i];
          zone.preStep(this.zoneContext);
        }
      }
      this.field?.preStep();
      this.handleZoneEvents();
    }
    // Before the ground is probed: a platform's speed is read from where its next
    // pose is, and until it is scheduled that pose is still the current one, which
    // would make every moving platform look still and carry nothing.
    for (const mover of this.movers) mover.preStep(world, balls);
    if (this.playing) {
      // With several balls about, one must not take another for the ground under it.
      const others =
        balls.length > 1 ? (collider: { handle: number }) => this.balls.owner(collider.handle) !== undefined : undefined;
      let free = false;
      for (const ball of balls) {
        const track = this.track(ball);
        if (track.busy) continue;
        free = true;
        const probe = (track.probe = probeGround(world, ball, this.surfaces, others));
        // Before the world has stepped once its colliders cannot be found by a ray, so
        // the very first look finds nothing under a ball that is sitting on the tee.
        if (probe || world.tick > 0) track.grounded = probe?.grounded ?? false;
        applySurface(ball, probe);
        // What a round is judged on is what the player's ball did, not its shadow.
        if (probe?.grounded && this.phase === 'rolling' && ball !== this.balls.shadow) {
          this.stats.surfaces.add(probe.surfaceId);
          if (probe.surfaceId !== track.lastSurface) this.emit({ type: 'surface', id: probe.surfaceId });
        }
        if (probe?.grounded) track.lastSurface = probe.surfaceId;
      }
      if (free) {
        const tilted = world.up.y < 0.999 || Math.abs(world.gravity.y + RULES.gravity) > 0.01;
        if (tilted !== this.tilted) this.emit({ type: 'cue', name: tilted ? 'gravityOn' : 'gravityOff' });
        this.tilted = tilted;
      }
    }
    for (const ball of balls) this.track(ball).before = { ...ball.velocity() };
    world.step();
    for (const mover of this.movers) mover.postStep();
    for (const crate of this.crates) crate.postStep();
    for (const pin of this.goal.pins) pin.postStep();
    this.field?.postStep();
    for (const ball of balls) ball.recordPose(this.track(ball).snap);
    for (const ball of this.balls.sunk) ball.recordPose(false);
    this.handleCollisions();
    this.advanceCups();
    this.judge();
    this.advanceTimer();
  }

  private apply(input: InputRecord): void {
    if (input.type === 'shot') this.shoot(xyz(input.dir), input.power, this.balls.live[input.ball ?? 0]);
    else if (input.type === 'skill') this.useSkill(input.id);
    else if (input.type === 'undo') this.undo();
    else if (input.type === 'rotate') this.rotate(input.part);
    else this.resume();
  }

  /** Moves each travelling cup, and its lid, to where the new tick puts them. */
  private advanceCups(): void {
    for (const cup of this.goal.cups) {
      if (!cup.live) continue;
      if (this.phase === 'done') {
        // The cup stops where the hole ended.
        if (cup.pose.prevPosition !== cup.pose.position) cup.pose = { ...cup.pose, prevPosition: cup.pose.position };
        continue;
      }
      const open = cupOpenAt(cup.def, this.world.tick);
      if (open !== cup.pose.open && cup.active) this.emit({ type: 'cue', name: open ? 'cupOpen' : 'cupShut' });
      cup.pose = { prevPosition: cup.pose.position, position: cupPositionAt(cup.def, this.world.tick), open };
    }
  }

  /**
   * Decides what the last step came to: which balls dropped into a cup, which pins went
   * down, and whether the stroke, or the hole, is over.
   */
  private judge(): void {
    this.topplePins();
    const rolling = this.phase === 'rolling';
    // A cup that travels or opens can also take a ball that is lying still.
    if (rolling || (this.phase === 'aiming' && this.goal.live)) {
      const shadow = this.balls.shadow;
      let atRest = true;
      // The same, leaving the shadow out: a hole that is won does not wait for it.
      let playersAtRest = true;
      for (const ball of [...this.balls.live]) {
        const track = this.track(ball);
        if (track.busy) {
          track.stop.reset();
          atRest = false;
          if (ball !== shadow) playersAtRest = false;
          continue;
        }
        const v = ball.velocity();
        // Speed is judged against the ground, so a ball riding a platform counts as still.
        const ground = track.probe?.grounded ? track.probe.velocity : STILL;
        const speed = hypot(v.x - ground.x, v.y - ground.y, v.z - ground.z);
        // No cup takes the shadow (SPEC v8 3.4).
        const cup = ball === shadow ? null : this.cupTaking(ball, v, speed);
        if (cup) this.sink(ball, cup, rolling);
        else if (rolling && !track.stop.update(speed)) {
          atRest = false;
          if (ball !== shadow) playersAtRest = false;
        }
      }
      // A boss is beaten the moment it is struck, but the hole ends when the balls have stopped (SPEC v9 3.6).
      if (this.goal.met && (!this.goal.restFirst || atRest)) this.won = true;
      // With the hole won, the round still waits for balls on their way to the cup:
      // a second one dropping in is worth something (SPEC v3 2.4).
      const waiting =
        rolling && !playersAtRest && this.balls.playable.length > 0 && this.goal.cups.some((cup) => cup.sunk > 0);
      const still = rolling && atRest && !this.won;
      // The balls have stopped: the works that act between strokes take their turn, and the stroke waits for them.
      if (still && !this.turnTaken) {
        this.turnTaken = true;
        this.field?.stopped();
      }
      const settled = still && !this.detained() && this.propsSettled() && this.fieldSettled();
      this.waiting = still && !settled;
      if (this.won && !waiting) this.finish(true);
      else if (settled) this.endStroke();
    } else if (this.goal.met && this.playing) {
      // The last pin fell while the player was aiming.
      this.finish(true);
    }
  }

  /** The cup that takes this ball on this step, if any. */
  private cupTaking(ball: Ball, v: XYZ, speed: number): CupState | null {
    for (const cup of this.goal.cups) {
      if (!cup.active || !cup.pose.open) continue;
      const accepts = cup.def.acceptSize ?? 'any';
      if (accepts !== 'any' && accepts !== ball.state.size) continue;
      // For a cup on the move, what counts is how fast the ball and the cup close on each
      // other (SPEC v2 2.5): a ball matching its pace drops in, one meeting it head-on may not.
      const { prevPosition: was, position: at } = cup.pose;
      const closing = cup.live
        ? hypot(v.x - (at.x - was.x) / FIXED_DT, v.y, v.z - (at.z - was.z) / FIXED_DT)
        : speed;
      if (cupCaptures(cup.def, at, ball.position(), closing, ball.props.radius)) return cup;
    }
    return null;
  }

  private sink(ball: Ball, cup: CupState, rolling: boolean): void {
    this.balls.sink(ball);
    cup.sunk++;
    if (rolling) this.stats.rests.push({ ...cup.pose.position });
    this.stats.cues.holed = (this.stats.cues.holed ?? 0) + 1;
    this.emit({ type: 'holed', strokes: this.strokes, ball: ball.id, cup: this.goal.cups.indexOf(cup) });
    this.refreshGoal();
  }

  /** Marks the pins that went over during the last step. A pin that is down stays down. */
  private topplePins(): void {
    if (this.goal.pins.length === 0 || !this.playing) return;
    let fell = false;
    for (const group of this.goal.groups) {
      for (const pin of group.pins) {
        if (pin.down) {
          // One that has gone over the edge would fall for ever.
          if (pin.body.isEnabled() && pin.offCourse()) pin.remove();
          continue;
        }
        if (!pin.toppled(group.cosThreshold)) continue;
        pin.fall();
        fell = true;
        const left = this.goal.pinsLeft;
        this.stats.cues.pinDown = (this.stats.cues.pinDown ?? 0) + 1;
        this.emit({ type: 'pinDown', pin: this.goal.pins.indexOf(pin), left });
        if (left === 0) this.cue('strike');
      }
    }
    if (fell) this.refreshGoal();
  }

  /** After a ball is sunk or a pin goes down: the next step of a sequence may have opened. */
  private refreshGoal(): void {
    for (const cup of this.goal.refresh()) {
      this.cue('cupAppear');
      this.emit({ type: 'cupAppeared', cup: this.goal.cups.indexOf(cup) });
    }
  }

  /**
   * True once crates and pins have come to rest too. A pin can rock for a long time, so
   * after a while the stroke ends regardless.
   */
  private propsSettled(): boolean {
    for (const crate of this.crates) if (crate.body.isEnabled() && crate.offCourse()) crate.remove();
    const quiet = this.crates.every((crate) => crate.quiet()) && this.goal.pins.every((pin) => pin.quiet());
    if (quiet || this.propWait >= PROP_SETTLE_TICKS) return true;
    this.propWait++;
    return false;
  }

  /** True once nothing of the hole's works is still moving: a chain has run to its end. */
  private fieldSettled(): boolean {
    if (!this.field?.busy || this.fieldWait >= FIELD_SETTLE_TICKS) return true;
    this.fieldWait++;
    return false;
  }

  /**
   * True while a ball lies on a bridge that comes and goes and keeps what stops on it
   * (SPEC v8 3.2): the stroke stays open until the bridge has gone, and the ball with
   * it. So no stroke is ever played from one, as none is from a slab about to fall.
   */
  private detained(): boolean {
    for (const ball of this.balls.live) {
      const probe = this.track(ball).probe;
      const carrier = probe?.grounded ? probe.carrier : null;
      if (carrier && this.movers.some((mover) => mover === carrier && mover.def.phantom?.holds)) return true;
    }
    return false;
  }

  /** Keeps the course as it is now, for the stroke about to be played to go back to. */
  private keep(position: XYZ, size: BallSize): void {
    if (!this.field?.rewindable) return;
    const shadow = this.balls.shadow;
    this.snapshots.push({
      position: { ...position },
      size,
      field: this.field.save(),
      ...(shadow ? { shadow: { ...shadow.position() } } : {}),
    });
  }

  /** Puts a ball and the course back to how a snapshot has them. */
  private rewind(ball: Ball, snapshot: Snapshot): void {
    if (ball.setSize(snapshot.size, this.world.up)) this.emit({ type: 'resized', ball: ball.id, size: snapshot.size });
    // The ball first: parts work out what is standing on them from where it is.
    ball.teleport(snapshot.position);
    if (snapshot.shadow) this.returnShadow(snapshot.shadow);
    this.field?.restore(snapshot.field);
    this.lastShotPosition = snapshot.position;
    this.lastShotSize = snapshot.size;
    this.waiting = false;
    this.turnTaken = false;
    this.phase = 'aiming';
    this.track(ball).stop.reset();
    ball.recordPose(true);
  }

  /** Puts the shadow ball back where a stroke found it, at rest. */
  private returnShadow(to: XYZ = this.shadowFrom): void {
    const shadow = this.balls.shadow;
    if (!shadow) return;
    shadow.teleport(to);
    this.shadowFrom = to;
    this.track(shadow).stop.reset();
    shadow.recordPose(true);
  }

  /** Every ball has stopped: the stroke is over and the player aims again. */
  private endStroke(): void {
    this.waiting = false;
    for (const ball of this.balls.live) this.settle(ball);
    this.field?.rested();
    this.stats.rests.push({ ...this.ball.position() });
    // Fallen pins are cleared away; the ones left standing stay where they were knocked to.
    for (const pin of this.goal.pins) if (pin.down) pin.remove();
    this.phase = 'aiming';
    this.emit({ type: 'stopped' });
    if (this.strokes >= this.strokeLimit) this.finish(false);
  }

  /** Runs the hole's countdown. It keeps running while the player aims, but not before the first stroke. */
  private advanceTimer(): void {
    if (this.timeLeft === null || !this.timerRunning || !this.playing || this.won) return;
    this.timeLeft--;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.phase = 'exploded';
      for (const ball of this.balls.live) {
        ball.halt();
        ball.body.setEnabled(false);
      }
      this.emit({ type: 'exploded' });
    } else if (this.timeLeft % TICKS_PER_SECOND === 0) {
      const warn = this.timeLeft <= WARNING_SECONDS * TICKS_PER_SECOND;
      this.emit({ type: 'cue', name: warn ? 'timerWarn' : 'timerTick' });
    }
  }

  /**
   * Brings a ball to rest. A ball may not be left on a moving part or in its way
   * (SPEC 2.6): it is moved to the nearest safe spot the hole data names for that part.
   */
  private settle(ball: Ball): void {
    ball.halt();
    const { probe } = this.track(ball);
    const position = ball.position();
    const riding = probe?.grounded ? this.movers.find((m) => m === probe.carrier) : undefined;
    // The works of the hole have places a ball may not stay in too: where fire burns.
    // And so has a zone that acts by itself on whatever lies in it: a drum (SPEC v6 3.4).
    const mover =
      riding ??
      this.movers.find((m) => m.forbidsRest(position)) ??
      this.field?.forbidsRest(position) ??
      this.zones.find((zone) => zone.forbidsRest?.(position));
    if (!mover) return;
    const rest = mover.nearestRest?.(position) ?? null;
    const r = ball.props.radius;
    ball.teleport(rest ? { x: rest[0], y: rest[1] + r, z: rest[2] } : this.lastShotPosition);
    ball.recordPose(true);
  }

  private build(): void {
    const { hole, ballProps } = this;
    if (hole.beat && !(Number.isInteger(hole.beat.ticks) && hole.beat.ticks >= 2)) {
      throw new Error(`Hole "${hole.id}": a beat is a whole number of ticks, not ${hole.beat.ticks}`);
    }
    this.world = new PhysicsWorld([0, -RULES.gravity, 0]);
    this.surfaces = new SurfaceMap();
    // The works of the round before are gone with its world: nothing may ask them the time.
    this.field = null;
    buildHolePhysics(this.compiled, this.world, this.surfaces);
    this.zones = hole.zones.map(createZone);
    this.movers = (hole.movers ?? []).map(
      (def) => new Mover(def, this.world, this.surfaces, def.clock === undefined ? undefined : this.onClock(def)),
    );
    this.tracks = new WeakMap();
    this.balls = new BallSet(this.world, ballProps, this.teePoint());
    if (hole.mirror) {
      if ((hole.maxBalls ?? 1) > 1 || hole.skills) {
        throw new Error(`Hole "${hole.id}": a mirror goes with neither splitting nor skills`);
      }
      const { axis, at, shadow } = hole.mirror;
      const [tx, ty, tz] = hole.tee;
      // Where the hole says, or where the tee is in the glass.
      const [x, y, z] = shadow ?? (axis === 'x' ? [2 * at - tx, ty, tz] : [tx, ty, 2 * at - tz]);
      this.balls.shadow = this.balls.add([x, y + ballProps.radius, z]);
    }
    this.shadowFrom = this.balls.shadow ? { ...this.balls.shadow.position() } : STILL;
    this.goal = new Goal(hole.goal, this.world, this.surfaces, {
      // The works are built after the goal: looked up when asked, not before.
      bossDown: (id) => (this.field?.part(id) as Boss | undefined)?.hp === 0,
      bossAt: (id) => this.field?.part(id).anchor ?? { x: 0, y: 0, z: 0 },
    });
    this.crates = (hole.crates ?? []).map((def) => new Crate(def, this.world, this.surfaces));
    this.field = hole.field
      ? new Field(hole.field, {
          world: this.world,
          surfaces: this.surfaces,
          balls: () => this.balls.live,
          cue: (name) => this.cue(name),
          outOfBounds: (ball) => this.zoneEvents.push({ event: { type: 'outOfBounds' }, ball }),
          caught: (ball) => this.zoneEvents.push({ event: { type: 'caught' }, ball }),
          cups: () => this.goal.cups.filter((cup) => cup.active).map((cup) => cup.pose.position),
          changed: (part) => this.emit({ type: 'partChanged', part }),
          hold: (ball) => {
            this.track(ball).busy = true;
          },
          snap: (ball) => {
            this.track(ball).snap = true;
          },
          beat: hole.beat?.ticks ?? null,
        })
      : null;
    for (const def of hole.movers ?? []) {
      if (def.clock === undefined) continue;
      if (!this.field) throw new Error(`Hole "${hole.id}": a moving part keeps the clock "${def.clock}", and the hole has no works`);
      this.field.clock(def.clock);
    }
    this.snapshots = [];
    this.waiting = false;
    this.fieldWait = 0;
    this.turnTaken = false;
    this.skills = new Map(Object.entries(hole.skills ?? {}).map(([id, uses]) => [id, { max: uses, charges: uses }]));
    this.zoneEvents = [];
    this.zoneContext = {
      world: this.world,
      ball: this.ball,
      emit: (event) => this.zoneEvents.push({ event, ball: this.zoneContext.ball }),
      grounded: () => this.track(this.zoneContext.ball).grounded,
      busy: () => {
        this.track(this.zoneContext.ball).busy = true;
      },
      snap: () => {
        this.track(this.zoneContext.ball).snap = true;
      },
      addTime: (seconds) => {
        if (this.timeLeft === null) return;
        this.timeLeft += Math.round(seconds / FIXED_DT);
        this.emit({ type: 'timeAdded', seconds });
      },
      resize: (step) => this.resize(this.zoneContext.ball, step),
      split: (degrees) => this.split(this.zoneContext.ball, degrees),
    };
    this.timeLeft = hole.timer ? Math.round(hole.timer.seconds / FIXED_DT) : null;
    this.timerRunning = false;
    this.frozen = false;
    this.won = false;
    this.propWait = 0;
    this.lastShotPosition = { ...this.ball.position() };
    this.lastShotSize = 'medium';
    this.phase = 'aiming';
    this.strokes = 0;
    this.inputs = [];
    this.stats = emptyStats();
    this.outcome = null;
    this.replayQueue = [];
    this.tilted = false;
  }

  /**
   * Where a moving part is that keeps a time zone's clock in place of the hole's (SPEC
   * v6 3.5): where its motion puts it at that clock's time. The part is built before
   * the works are, on tick 0, when every clock still reads the same.
   */
  private onClock(def: MoverDef): (tick: number) => MoverPose {
    return (tick) => moverPose(def, this.field ? this.field.clock(def.clock!).at(tick) : tick);
  }

  private track(ball: Ball): Track {
    let track = this.tracks.get(ball);
    if (!track) {
      track = {
        stop: new StopDetector(),
        busy: false,
        snap: false,
        probe: null,
        grounded: true,
        lastSurface: null,
        before: STILL,
      };
      this.tracks.set(ball, track);
    }
    return track;
  }

  /** Ball centre when a ball of this radius sits on the tee. The course floor is always level with +Y up. */
  private teePoint(radius = this.ballProps.radius): Vec3 {
    const [x, y, z] = this.hole.tee;
    return [x, y + radius, z];
  }

  /** Makes a ball one size bigger or smaller, and clear of anything it now overlaps. */
  private resize(ball: Ball, step: 1 | -1): boolean {
    const size = SIZE_ORDER[SIZE_ORDER.indexOf(ball.state.size) + step];
    if (size === undefined || !ball.setSize(size, this.world.up)) return false;
    fitBall(this.world, ball);
    this.cue(step > 0 ? 'grow' : 'shrink');
    this.emit({ type: 'resized', ball: ball.id, size });
    return true;
  }

  /**
   * Splits a ball in two. Both halves keep its size and speed and head `degrees` to
   * either side of where it was going (SPEC v3 2.4). Balls pass through each other, so
   * starting from the same spot is no trouble.
   */
  private split(ball: Ball, degrees: number): Ball | null {
    if (this.balls.live.length >= this.maxBalls) return null;
    const v = ball.velocity();
    const c = cos(degrees * RAD);
    const s = sin(degrees * RAD);
    const twin = this.balls.add(ball.position(), ball.state.size);
    twin.collider.setRestitution(ball.collider.restitution());
    ball.body.setLinvel({ x: v.x * c + v.z * s, y: v.y, z: v.z * c - v.x * s }, true);
    twin.body.setLinvel({ x: v.x * c - v.z * s, y: v.y, z: v.z * c + v.x * s }, true);
    this.track(twin).lastSurface = this.track(ball).lastSurface;
    this.cue('split');
    this.emit({ type: 'ballAdded', ball: twin.id, from: ball.id });
    return twin;
  }

  private finish(holed: boolean): void {
    const strokes = holed ? this.strokes : this.strokeLimit;
    this.stats.strokes = strokes;
    this.stats.timeLeft = this.timeLeft === null ? null : this.timeLeft * FIXED_DT;
    // What the works look like at the end, not what happened along the way: a stroke
    // that was taken back never happened, so nothing it did may count for or against.
    if (this.field) {
      this.stats.partsOn = new Set(this.field.parts.filter((part) => part.on).map((part) => part.id));
      this.stats.coinsLeft = this.field.all('coin').filter((coin) => !coin.on).length;
      this.stats.turns = this.field.turnsUsed;
    }
    const met = holed && challengeMet(this.hole.challenge, this.stats);
    this.outcome = {
      holed,
      strokes,
      stars: starsFor(holed, strokes, this.hole.par, met),
      challengeMet: met,
      ticks: this.world.tick - this.firstShotTick,
    };
    this.phase = 'done';
    this.frozen = false;
    this.waiting = false;
    for (const ball of this.balls.live) ball.halt();
    for (const ball of this.balls.sunk) ball.halt();
    this.emit({ type: 'finished', outcome: this.outcome });
  }

  private handleZoneEvents(): void {
    if (this.zoneEvents.length === 0) return;
    // Each ball that is to be put back, and why: a monster's catch is an out-of-bounds counted apart.
    const out = new Map<Ball, 'outOfBounds' | 'caught'>();
    for (const { event, ball } of this.zoneEvents.splice(0)) {
      if (event.type === 'outOfBounds' || event.type === 'caught') {
        if (!out.has(ball)) out.set(ball, event.type);
        continue;
      }
      this.stats.cues[event.name] = (this.stats.cues[event.name] ?? 0) + 1;
      this.emit(event);
    }
    for (const [ball, why] of out) {
      // The shadow goes back where the stroke found it, and that is all: it costs
      // nothing, and whatever it did on the way stays done (SPEC v8 3.4).
      if (ball === this.balls.shadow) {
        this.returnShadow();
        this.cue('shadowBack');
        continue;
      }
      // While another ball plays on, or the hole is already won, a ball that leaves is just gone.
      if (this.balls.playable.length > 1 || this.won) {
        this.balls.remove(ball);
        this.emit({ type: 'ballRemoved', ball: ball.id, reason: 'outOfBounds' });
        continue;
      }
      // The last one comes back, at the size it was struck at, and it costs a stroke (SPEC 2.6).
      // On a hole with works the course comes back with it, to how it was when the stroke
      // was played (SPEC v4 3.8): the stroke did not happen, but it is still counted.
      // With no stroke under way it is the last one played that is taken back: the ball
      // returns to where that was struck from, and that spot has to be there again. A
      // bridge that fell when the ball left it would otherwise drop the ball for ever.
      const snapshot = this.snapshots.pop();
      const toTee = this.hole.outOfBounds === 'tee' && !snapshot;
      const size = toTee ? 'medium' : this.lastShotSize;
      if (ball.setSize(size, this.world.up)) this.emit({ type: 'resized', ball: ball.id, size });
      const target = toTee ? xyz(this.teePoint(ball.props.radius)) : this.lastShotPosition;
      if (snapshot) this.rewind(ball, snapshot);
      else {
        ball.teleport(target);
        // The stroke did not happen for the shadow either.
        this.returnShadow();
      }
      this.strokes++;
      if (why === 'caught') this.stats.caught++;
      else this.stats.outOfBounds++;
      this.stats.rests.push({ ...target });
      this.phase = 'aiming';
      this.turnTaken = false;
      this.track(ball).stop.reset();
      ball.recordPose(true);
      this.emit({ type: why, strokes: this.strokes });
      if (this.strokes >= this.strokeLimit) this.finish(false);
    }
  }

  /** Turns the collisions of the last step into bounce events and wall-hit counts. */
  private handleCollisions(): void {
    const { hits } = this;
    hits.clear();
    this.world.events.drainCollisionEvents((a, b, started) => {
      if (!started) return;
      const ball = this.balls.owner(a) ?? this.balls.owner(b);
      if (!ball) return;
      const handle = ball.collider.handle === a ? b : a;
      const kind = this.surfaces.kindOf(handle);
      if (!kind) return;
      const kinds = hits.get(ball);
      if (kinds) kinds.push({ kind, handle });
      else hits.set(ball, [{ kind, handle }]);
    });
    if (hits.size === 0 || this.phase === 'done') return;
    for (const [ball, kinds] of hits) {
      const before = this.track(ball).before;
      const after = ball.velocity();
      const speed = hypot(after.x - before.x, after.y - before.y, after.z - before.z);
      for (const { kind, handle } of kinds) {
        // A stone is shoved, a crystal turned.
        this.field?.hit(ball, handle, speed);
        const counted = this.phase === 'rolling' && ball !== this.balls.shadow;
        if (kind === 'wall' && counted) this.stats.wallHits++;
        if (kind === 'mover' && counted) this.stats.moverHits++;
        if (speed >= MIN_BOUNCE_SPEED) this.emit({ type: 'bounce', kind, speed });
      }
    }
  }

  /** A named moment of the round's own making. Counted, so a challenge can ask about it. */
  private cue(name: string): void {
    this.stats.cues[name] = (this.stats.cues[name] ?? 0) + 1;
    this.emit({ type: 'cue', name });
  }

  private emit(event: SessionEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
