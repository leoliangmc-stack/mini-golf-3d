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
import { cupCaptures, RULES, starsFor, StopDetector } from './rules';

export type Phase = 'aiming' | 'rolling' | 'done';

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
  | { type: 'finished'; outcome: Outcome }
  | { type: 'reset' };

/** Ball position at the last two physics steps, for render interpolation. */
export interface BallPose {
  prevPosition: XYZ;
  position: XYZ;
}

/** Impacts gentler than this are contact noise, not bounces. */
const MIN_BOUNCE_SPEED = 0.3;

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

  private surfaces!: SurfaceMap;
  private zones: Zone[] = [];
  private zoneEvents: ZoneEvent[] = [];
  private zoneContext!: ZoneContext;
  /** A zone is holding the ball this step, so it must not be judged as stopped. */
  private zoneBusy = false;
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
    this.build();
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
    if (this.phase !== 'aiming') return false;
    const p = Math.min(1, power);
    if (p < RULES.minPower) return false;
    const from = { ...this.ball.position() };
    if (!this.ball.launch(dir, p * RULES.maxShotSpeed)) return false;
    this.lastShotPosition = from;
    if (this.strokes === 0) this.firstShotTick = this.world.tick;
    this.shots.push({ tick: this.world.tick, dir: [dir.x, dir.y, dir.z], power: p });
    this.strokes++;
    this.phase = 'rolling';
    this.stop.reset();
    this.emit({ type: 'shot', strokes: this.strokes, power: p });
    return true;
  }

  /** Advances the simulation by exactly one fixed step. */
  step(): void {
    const { world, ball } = this;
    while (this.replayQueue.length > 0 && this.replayQueue[0].tick <= world.tick) {
      const shot = this.replayQueue.shift()!;
      this.shoot(xyz(shot.dir), shot.power);
    }
    this.zoneBusy = false;
    if (this.phase !== 'done') {
      // Gravity zones override this for the step; everywhere else it is the default again.
      world.setGravity([0, -RULES.gravity, 0]);
      for (const zone of this.zones) zone.preStep(this.zoneContext);
      this.handleZoneEvents();
    }
    let probe: GroundProbe | null = null;
    if (this.phase !== 'done' && !this.zoneBusy) {
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
    this.recordPose(false);
    this.handleCollisions(before);

    if (this.phase !== 'rolling') return;
    if (this.zoneBusy) {
      this.stop.reset();
      return;
    }
    // Speed is judged against the ground, so a ball riding a platform counts as still.
    const v = ball.velocity();
    const ground = probe?.grounded ? probe.velocity : { x: 0, y: 0, z: 0 };
    const speed = Math.hypot(v.x - ground.x, v.y - ground.y, v.z - ground.z);
    if (cupCaptures(this.hole.cup, ball.position(), speed, this.ballProps.radius)) {
      ball.body.setEnabled(false);
      this.stats.rests.push(xyz(this.hole.cup.position));
      this.emit({ type: 'holed', strokes: this.strokes });
      this.finish(true);
    } else if (this.stop.update(speed)) {
      this.settle(probe);
      this.stats.rests.push({ ...ball.position() });
      this.phase = 'aiming';
      this.emit({ type: 'stopped' });
      if (this.strokes >= this.strokeLimit) this.finish(false);
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
    };
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
      if (event.type === 'outOfBounds') outOfBounds = true;
      else this.emit(event);
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
