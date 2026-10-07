import { FIXED_DT } from '../core/loop';
import type { Vec3, XYZ } from '../core/types';
import { xyz } from '../core/types';
import { compileHole, type CompiledHole } from '../level/compile';
import { buildHolePhysics } from '../level/physicsBuilder';
import type { HoleDef } from '../level/schema';
import { Ball, DEFAULT_BALL, type BallProps } from '../physics/ball';
import { Mover } from '../physics/movers';
import { applySurface, probeGround, SurfaceMap, type ColliderKind, type GroundProbe } from '../physics/surfaces';
import { PhysicsWorld } from '../physics/world';
import { createZone, type Zone, type ZoneContext, type ZoneEvent } from '../physics/zones';
import { challengeMet, emptyStats, type RoundStats } from './challenges';
import { cupIsLive, cupOpenAt, cupPositionAt, type CupPose } from './cup';
import { cupCaptures, RULES, starsFor, StopDetector } from './rules';

/** `exploded`: the hole's countdown ran out; the round is dead until it is reset or conceded. */
export type Phase = 'aiming' | 'rolling' | 'exploded' | 'done';

/** Everything needed to reproduce a stroke: same tick, direction and power give the same result. */
export interface ShotRecord {
  tick: number;
  dir: Vec3;
  power: number;
}

/** How a hole ended. */
export interface Outcome {
  /** False when the stroke limit ended the hole. */
  holed: boolean;
  strokes: number;
  stars: 1 | 2 | 3;
  challengeMet: boolean;
  /** Physics ticks from the first stroke to the end. */
  ticks: number;
}

export type SessionEvent =
  | { type: 'shot'; strokes: number; power: number }
  | { type: 'stopped' }
  /** The ball hit something. `speed` is how much its velocity changed, in m/s. */
  | { type: 'bounce'; kind: ColliderKind; speed: number }
  | { type: 'outOfBounds'; strokes: number }
  /** The rolling ball moved onto a different surface. */
  | { type: 'surface'; id: string }
  /** A named moment from a zone, e.g. a cannon firing. */
  | { type: 'cue'; name: string }
  | { type: 'holed'; strokes: number }
  /** A zone added time to the hole's countdown. */
  | { type: 'timeAdded'; seconds: number }
  /** The hole's countdown ran out. */
  | { type: 'exploded' }
  | { type: 'finished'; outcome: Outcome }
  | { type: 'reset' };

/** Ball position at the last two physics steps, for render interpolation. */
export interface BallPose {
  prevPosition: XYZ;
  position: XYZ;
}

/** Impacts gentler than this are contact noise, not bounces. */
const MIN_BOUNCE_SPEED = 0.3;
const TICKS_PER_SECOND = Math.round(1 / FIXED_DT);
/** The countdown warns once a second from this many seconds out. */
const WARNING_SECONDS = 3;
const STILL: XYZ = { x: 0, y: 0, z: 0 };

/**
 * One attempt at one hole: physics world, ball, rules and score.
 * Has no rendering or DOM dependencies, so it runs unchanged in tests.
 */
export class Session {
  readonly compiled: CompiledHole;
  phase: Phase = 'aiming';
  strokes = 0;
  shots: ShotRecord[] = [];
  stats: RoundStats = emptyStats();
  /** Set once the hole is over. */
  outcome: Outcome | null = null;
  world!: PhysicsWorld;
  ball!: Ball;
  pose!: BallPose;
  movers: Mover[] = [];
  /** The live zones, in the order of the hole's data. Rebuilt on every reset. */
  zones: Zone[] = [];
  cup!: CupPose;
  /** Physics ticks left on the hole's countdown, or null if the hole has none. */
  timeLeft: number | null = null;

  private surfaces!: SurfaceMap;
  private timerRunning = false;
  private readonly cupLive: boolean;
  private zoneEvents: ZoneEvent[] = [];
  private zoneContext!: ZoneContext;
  /** A zone is holding the ball this step, so it must not be judged as stopped. */
  private zoneBusy = false;
  /** A zone moved the ball by hand this step. */
  private zoneSnap = false;
  private lastShotPosition!: XYZ;
  private lastSurface: string | null = null;
  private tilted = false;
  private firstShotTick = 0;
  private replayQueue: ShotRecord[] = [];
  private readonly stop = new StopDetector();
  private readonly listeners = new Set<(event: SessionEvent) => void>();

  constructor(
    readonly hole: HoleDef,
    private readonly ballProps: BallProps = DEFAULT_BALL,
  ) {
    this.compiled = compileHole(hole);
    this.cupLive = cupIsLive(hole.cup);
    this.build();
  }

  /** True while the hole is being played: a stroke can be made, or one is under way. */
  get playing(): boolean {
    return this.phase === 'aiming' || this.phase === 'rolling';
  }

  get strokeLimit(): number {
    return this.hole.strokeLimit ?? this.hole.par * 2;
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

  /** Restarts the hole and plays recorded strokes back at their original ticks. */
  replay(shots: readonly ShotRecord[]): void {
    this.reset();
    this.replayQueue = shots.map((shot) => ({ ...shot }));
  }

  get replaying(): boolean {
    return this.replayQueue.length > 0;
  }

  dispose(): void {
    this.world.free();
    this.listeners.clear();
  }

  /** Strikes the ball. Returns false if a stroke is not allowed right now. */
  shoot(dir: XYZ, power: number): boolean {
    // A zone holding the ball (a tunnel, a cannon) has to let go of it first.
    if (this.phase !== 'aiming' || this.zoneBusy) return false;
    const p = Math.min(1, power);
    if (p < RULES.minPower) return false;
    const from = { ...this.ball.position() };
    if (!this.ball.launch(dir, p * RULES.maxShotSpeed)) return false;
    this.lastShotPosition = from;
    if (this.strokes === 0) {
      this.firstShotTick = this.world.tick;
      // The countdown starts with the first stroke and never waits for the player again.
      this.timerRunning = true;
    }
    this.shots.push({ tick: this.world.tick, dir: [dir.x, dir.y, dir.z], power: p });
    this.strokes++;
    this.phase = 'rolling';
    this.stop.reset();
    this.emit({ type: 'shot', strokes: this.strokes, power: p });
    return true;
  }

  /**
   * Gives the hole up: it ends at the stroke limit, exactly as if that had been reached.
   * The way out of a hole whose countdown keeps running out.
   */
  concede(): void {
    if (this.phase !== 'done') this.finish(false);
  }

  /** Advances the simulation by exactly one fixed step. */
  step(): void {
    const { world, ball } = this;
    while (this.replayQueue.length > 0 && this.replayQueue[0].tick <= world.tick) {
      const shot = this.replayQueue.shift()!;
      this.shoot(xyz(shot.dir), shot.power);
    }
    this.zoneBusy = false;
    this.zoneSnap = false;
    if (this.playing) {
      // Gravity zones override this for the step; everywhere else it is the default again.
      world.setGravity([0, -RULES.gravity, 0]);
      for (const zone of this.zones) zone.preStep(this.zoneContext);
      this.handleZoneEvents();
    }
    let probe: GroundProbe | null = null;
    if (this.playing && !this.zoneBusy) {
      probe = probeGround(world, ball, this.surfaces);
      applySurface(ball, probe);
      if (probe?.grounded && this.phase === 'rolling') {
        this.stats.surfaces.add(probe.surfaceId);
        if (probe.surfaceId !== this.lastSurface) this.emit({ type: 'surface', id: probe.surfaceId });
      }
      if (probe?.grounded) this.lastSurface = probe.surfaceId;
      const tilted = world.up.y < 0.999 || Math.abs(world.gravity.y + RULES.gravity) > 0.01;
      if (tilted !== this.tilted) this.emit({ type: 'cue', name: tilted ? 'gravityOn' : 'gravityOff' });
      this.tilted = tilted;
    }
    for (const mover of this.movers) mover.preStep(world, ball);

    const before = { ...ball.velocity() };
    world.step();
    for (const mover of this.movers) mover.postStep();
    this.recordPose(this.zoneSnap);
    this.handleCollisions(before);
    this.advanceCup();
    this.judge(probe);
    this.advanceTimer();
  }

  /** Moves the cup, and its lid, to where the new tick puts them. */
  private advanceCup(): void {
    if (!this.cupLive) return;
    if (this.phase === 'done') {
      // The cup stops where the hole ended.
      if (this.cup.prevPosition !== this.cup.position) this.cup = { ...this.cup, prevPosition: this.cup.position };
      return;
    }
    const { cup } = this.hole;
    const open = cupOpenAt(cup, this.world.tick);
    if (open !== this.cup.open) this.emit({ type: 'cue', name: open ? 'cupOpen' : 'cupShut' });
    this.cup = { prevPosition: this.cup.position, position: cupPositionAt(cup, this.world.tick), open };
  }

  /** Decides whether the ball dropped into the cup or came to rest during the last step. */
  private judge(probe: GroundProbe | null): void {
    const { ball } = this;
    const rolling = this.phase === 'rolling';
    // A cup that travels or opens can also take a ball that is lying still.
    if (!rolling && !(this.phase === 'aiming' && this.cupLive)) return;
    if (this.zoneBusy) {
      this.stop.reset();
      return;
    }
    const v = ball.velocity();
    // Speed is judged against the ground, so a ball riding a platform counts as still.
    const ground = probe?.grounded ? probe.velocity : STILL;
    const speed = Math.hypot(v.x - ground.x, v.y - ground.y, v.z - ground.z);
    // For a cup on the move, what counts is how fast the ball and the cup close on each
    // other (SPEC v2 2.5): a ball matching its pace drops in, one meeting it head-on may not.
    const { prevPosition: was, position: at } = this.cup;
    const closing = this.cupLive
      ? Math.hypot(v.x - (at.x - was.x) / FIXED_DT, v.y, v.z - (at.z - was.z) / FIXED_DT)
      : speed;
    if (this.cup.open && cupCaptures(this.hole.cup, at, ball.position(), closing, this.ballProps.radius)) {
      ball.body.setEnabled(false);
      if (rolling) this.stats.rests.push({ ...at });
      this.emit({ type: 'holed', strokes: this.strokes });
      this.finish(true);
    } else if (rolling && this.stop.update(speed)) {
      this.settle(probe);
      this.stats.rests.push({ ...ball.position() });
      this.phase = 'aiming';
      this.emit({ type: 'stopped' });
      if (this.strokes >= this.strokeLimit) this.finish(false);
    }
  }

  /** Runs the hole's countdown. It keeps running while the player aims, but not before the first stroke. */
  private advanceTimer(): void {
    if (this.timeLeft === null || !this.timerRunning || !this.playing) return;
    this.timeLeft--;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.phase = 'exploded';
      this.ball.halt();
      this.ball.body.setEnabled(false);
      this.emit({ type: 'exploded' });
    } else if (this.timeLeft % TICKS_PER_SECOND === 0) {
      const warn = this.timeLeft <= WARNING_SECONDS * TICKS_PER_SECOND;
      this.emit({ type: 'cue', name: warn ? 'timerWarn' : 'timerTick' });
    }
  }

  /**
   * Brings the ball to rest. A ball may not be left on a moving part or in its way
   * (SPEC 2.6): it is moved to the nearest safe spot the hole data names for that part.
   */
  private settle(probe: GroundProbe | null): void {
    const { ball } = this;
    ball.halt();
    const position = ball.position();
    const riding = probe?.grounded ? this.movers.find((m) => m === probe.carrier) : undefined;
    const mover = riding ?? this.movers.find((m) => m.forbidsRest(position));
    if (!mover) return;
    const rest = mover.nearestRest(position);
    const r = this.ballProps.radius;
    ball.teleport(rest ? { x: rest[0], y: rest[1] + r, z: rest[2] } : this.lastShotPosition);
    this.recordPose(true);
  }

  private build(): void {
    const { hole, ballProps } = this;
    this.world = new PhysicsWorld([0, -RULES.gravity, 0]);
    this.surfaces = new SurfaceMap();
    buildHolePhysics(this.compiled, this.world, this.surfaces);
    this.zones = hole.zones.map(createZone);
    this.movers = (hole.movers ?? []).map((def) => new Mover(def, this.world, this.surfaces));
    this.ball = new Ball(this.world, ballProps, this.teePoint());
    this.zoneEvents = [];
    this.zoneContext = {
      world: this.world,
      ball: this.ball,
      emit: (e) => this.zoneEvents.push(e),
      busy: () => {
        this.zoneBusy = true;
      },
      snap: () => {
        this.zoneSnap = true;
      },
      addTime: (seconds) => {
        if (this.timeLeft === null) return;
        this.timeLeft += Math.round(seconds / FIXED_DT);
        this.emit({ type: 'timeAdded', seconds });
      },
    };
    const cupAt = cupPositionAt(hole.cup, this.world.tick);
    this.cup = { prevPosition: cupAt, position: cupAt, open: cupOpenAt(hole.cup, this.world.tick) };
    this.timeLeft = hole.timer ? Math.round(hole.timer.seconds / FIXED_DT) : null;
    this.timerRunning = false;
    this.zoneBusy = false;
    this.zoneSnap = false;
    this.lastShotPosition = { ...this.ball.position() };
    this.phase = 'aiming';
    this.strokes = 0;
    this.shots = [];
    this.stats = emptyStats();
    this.outcome = null;
    this.replayQueue = [];
    this.lastSurface = null;
    this.tilted = false;
    this.stop.reset();
    this.recordPose(true);
  }

  /** Ball centre when it sits on the tee. The course floor is always level with +Y up. */
  private teePoint(): Vec3 {
    const [x, y, z] = this.hole.tee;
    return [x, y + this.ballProps.radius, z];
  }

  private finish(holed: boolean): void {
    const strokes = holed ? this.strokes : this.strokeLimit;
    this.stats.strokes = strokes;
    this.stats.timeLeft = this.timeLeft === null ? null : this.timeLeft * FIXED_DT;
    const met = holed && challengeMet(this.hole.challenge, this.stats);
    this.outcome = {
      holed,
      strokes,
      stars: starsFor(holed, strokes, this.hole.par, met),
      challengeMet: met,
      ticks: this.world.tick - this.firstShotTick,
    };
    this.phase = 'done';
    this.ball.halt();
    this.emit({ type: 'finished', outcome: this.outcome });
  }

  private handleZoneEvents(): void {
    if (this.zoneEvents.length === 0) return;
    let outOfBounds = false;
    for (const event of this.zoneEvents.splice(0)) {
      if (event.type === 'outOfBounds') {
        outOfBounds = true;
        continue;
      }
      this.stats.cues[event.name] = (this.stats.cues[event.name] ?? 0) + 1;
      this.emit(event);
    }
    if (!outOfBounds) return;
    const target = this.hole.outOfBounds === 'tee' ? xyz(this.teePoint()) : this.lastShotPosition;
    this.ball.teleport(target);
    this.strokes++;
    this.stats.outOfBounds++;
    this.stats.rests.push({ ...target });
    this.phase = 'aiming';
    this.stop.reset();
    this.recordPose(true);
    this.emit({ type: 'outOfBounds', strokes: this.strokes });
    if (this.strokes >= this.strokeLimit) this.finish(false);
  }

  /** Turns the collisions of the last step into bounce events and wall-hit counts. */
  private handleCollisions(velocityBefore: XYZ): void {
    const ballHandle = this.ball.collider.handle;
    const kinds: ColliderKind[] = [];
    this.world.events.drainCollisionEvents((a, b, started) => {
      if (!started || (a !== ballHandle && b !== ballHandle)) return;
      const kind = this.surfaces.kindOf(a === ballHandle ? b : a);
      if (kind) kinds.push(kind);
    });
    if (kinds.length === 0 || this.phase === 'done') return;
    const after = this.ball.velocity();
    const speed = Math.hypot(
      after.x - velocityBefore.x,
      after.y - velocityBefore.y,
      after.z - velocityBefore.z,
    );
    for (const kind of kinds) {
      if (kind === 'wall' && this.phase === 'rolling') this.stats.wallHits++;
      if (kind === 'mover' && this.phase === 'rolling') this.stats.moverHits++;
      if (speed >= MIN_BOUNCE_SPEED) this.emit({ type: 'bounce', kind, speed });
    }
  }

  /** `snap` drops the previous position so a teleport is not interpolated across the course. */
  private recordPose(snap: boolean): void {
    const position = { ...this.ball.body.translation() };
    this.pose = { prevPosition: snap ? position : this.pose.position, position };
  }

  private emit(event: SessionEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
