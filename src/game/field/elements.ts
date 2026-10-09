import { FIXED_DT } from '../../core/loop';
import { hypot } from '../../core/math';
import type { Vec3, XYZ } from '../../core/types';
import type { CrumbleDef, FloatDef, ValveDef, WaterDef } from '../../level/field';
import type { Ball } from '../../physics/ball';
import { cycleValue, Mover, type MoverPose } from '../../physics/movers';
import { RAPIER } from '../../physics/rapier';
import { getSurface } from '../../physics/surfaces';
import { ground, type Field, type Part } from './field';

/** A ball has to change its velocity by this much against a valve, in m/s, to turn it. */
export const TURN_SPEED = 0.3;
/** Ticks after a turn in which a valve does not turn again: one knock is one turn. */
export const TURN_COOLDOWN = 20;
/** Radius of the post a valve stands on. */
export const VALVE_POST = 0.2;
/** How far the post stands above `at`. */
export const VALVE_HEIGHT = 0.9;

/**
 * The post a valve stands on, and every other switch a knock works: an iron cylinder
 * that tells `part` when a ball runs into it. It reaches `depth` below `at`.
 */
export function standPost(field: Field, part: Part, at: Vec3, depth = 0): void {
  const { world, surfaces } = field.host;
  const collider = world.raw.createCollider(
    RAPIER.ColliderDesc.cylinder((VALVE_HEIGHT + depth) / 2, VALVE_POST)
      .setTranslation(at[0], at[1] + (VALVE_HEIGHT - depth) / 2, at[2])
      .setFriction(0)
      .setRestitution(getSurface('iron').restitution)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
  );
  surfaces.setCollider(collider.handle, 'prop', 'iron');
  field.own(collider.handle, part);
}

/** A valve (SPEC v5 3.4). Its signal: it is open. */
export class Valve implements Part {
  readonly kind = 'valve';
  readonly anchor: XYZ;
  readonly busy = false;
  open: boolean;
  private cooldown = 0;

  constructor(
    readonly def: ValveDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.anchor = ground(def.at);
    this.open = def.open ?? false;
    standPost(field, this, def.at, def.depth ?? 0);
  }

  get on(): boolean {
    return this.open;
  }

  hit(_ball: Ball, speed: number): void {
    if (this.cooldown > 0 || speed < TURN_SPEED) return;
    this.open = !this.open;
    this.cooldown = TURN_COOLDOWN;
    // A lever is the same thing with another face and another sound (SPEC v6 3.2).
    if (this.def.look === 'lever') this.field.host.cue(this.open ? 'leverOn' : 'leverOff');
    else this.field.host.cue(this.open ? 'valveOpen' : 'valveShut');
  }

  step(): void {
    if (this.cooldown > 0) this.cooldown--;
  }

  save(): boolean {
    return this.open;
  }

  load(state: unknown): void {
    this.open = state as boolean;
    this.cooldown = 0;
  }
}

const WATER_SPEED = 1.2;

interface WaterState {
  level: number;
  target: number;
}

/**
 * A body of water (SPEC v5 3.4). A ball whose middle goes under the surface is out of
 * bounds, wherever the surface is at that moment. Its signal: a valve has it standing
 * somewhere other than where it starts.
 *
 * Water moved by valves keeps its height in the snapshot. Water with a tide does not:
 * a tide keeps the hole's clock, as moving parts and bursts of fire do.
 */
export class Water implements Part {
  readonly kind = 'water';
  /** Height of the surface after the coming step, and after the last one: for the picture. */
  level: number;
  prev: number;
  private target: number;

  constructor(
    readonly def: WaterDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.level = this.prev = this.target = def.tide ? this.tideAt(field.host.world.tick) : def.level;
  }

  get anchor(): XYZ {
    const { min, max } = this.def;
    return { x: (min[0] + max[0]) / 2, y: this.level, z: (min[1] + max[1]) / 2 };
  }

  get on(): boolean {
    return !this.def.tide && this.target !== this.def.level;
  }

  get busy(): boolean {
    return !this.def.tide && this.level !== this.target;
  }

  /** True if the water rises and falls by itself. */
  get tidal(): boolean {
    return this.def.tide !== undefined;
  }

  private tideAt(tick: number): number {
    const { tide, level } = this.def;
    return tide ? level + (tide.to - level) * cycleValue(tick, tide) : level;
  }

  /** The height the valves call for right now. */
  private wanted(): number {
    for (const option of this.def.levels ?? []) if (this.field.test(option.when)) return option.level;
    return this.def.level;
  }

  step(): void {
    const { host } = this.field;
    this.prev = this.level;
    if (this.def.tide) {
      this.level = this.tideAt(host.world.tick + 1);
    } else {
      const wanted = this.wanted();
      if (wanted !== this.target) {
        this.target = wanted;
        host.cue(wanted > this.level ? 'waterRise' : 'waterFall');
        host.changed(this.id);
      }
      if (this.level !== this.target) {
        const step = (this.def.speed ?? WATER_SPEED) * FIXED_DT;
        const gap = this.target - this.level;
        this.level = Math.abs(gap) <= step ? this.target : this.level + (gap > 0 ? step : -step);
        if (this.level === this.target) host.cue('waterSettle');
      }
    }
    const { min, max } = this.def;
    for (const ball of host.balls()) {
      if (!ball.body.isEnabled()) continue;
      const p = ball.position();
      if (p.x > min[0] && p.x < max[0] && p.z > min[1] && p.z < max[1] && p.y < this.level) {
        host.cue('splash');
        host.outOfBounds(ball);
      }
    }
  }

  save(): WaterState | null {
    return this.def.tide ? null : { level: this.level, target: this.target };
  }

  load(state: unknown): void {
    if (!state) return;
    const { level, target } = state as WaterState;
    this.level = this.prev = level;
    this.target = target;
  }
}

const FREEBOARD = 0.1;

/**
 * A raft (SPEC v5 3.4): a moving part (physics/movers.ts) whose height is the water's.
 * A ball on it is carried up and down exactly as on any platform. It has no state of
 * its own: where it is follows from the water.
 */
export class Float implements Part {
  readonly kind = 'float';
  readonly on = false;
  readonly mover: Mover;
  private water: Water | null = null;
  /** Height of the water as the hole starts, for before the parts are wired. */
  private readonly start: number;

  constructor(
    readonly def: FloatDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    const water = field.def.parts.find((part): part is WaterDef => part.kind === 'water' && part.id === def.water);
    if (!water) throw new Error(`Float "${id}" lies on water "${def.water}", which does not exist`);
    this.start = water.level;
    const { world, surfaces } = field.host;
    this.mover = new Mover(
      // The motion is never read: the schedule below replaces it.
      { role: 'platform', size: def.size, position: [def.at[0], 0, def.at[1]], surface: def.surface, motion: { type: 'slide', offset: [0, 0, 0], period: 1 } },
      world,
      surfaces,
      () => this.pose(),
    );
  }

  wire(): void {
    this.water = this.field.part(this.def.water) as Water;
  }

  /** Height of its top face. */
  get top(): number {
    const level = (this.water?.level ?? this.start) + (this.def.freeboard ?? FREEBOARD);
    const stops = this.def.stops;
    return stops ? Math.min(stops[1], Math.max(stops[0], level)) : level;
  }

  get anchor(): XYZ {
    return { x: this.def.at[0], y: this.top, z: this.def.at[1] };
  }

  get busy(): boolean {
    // On a tide it never stops; it is the water moved by a valve that a stroke waits for.
    return !this.water?.tidal && this.mover.pose.position.y !== this.pose().position.y;
  }

  private pose(): MoverPose {
    return { position: { x: this.def.at[0], y: this.top - this.def.size[1] / 2, z: this.def.at[1] }, yaw: 0 };
  }

  step(): void {
    const { host } = this.field;
    this.mover.preStep(host.world, host.balls());
  }

  postStep(): void {
    this.mover.postStep();
  }

  save(): null {
    return null;
  }

  load(): void {}

  resync(): void {
    this.mover.snap(this.field.host.world);
  }

  forbidsRest(point: XYZ): boolean {
    return (this.water?.tidal ?? false) && this.mover.isUnder(point) && point.y - this.top < 0.6;
  }

  nearestRest(point: XYZ): Vec3 | null {
    let best: Vec3 | null = null;
    let nearest = Infinity;
    for (const rest of this.def.rest ?? []) {
      const distance = hypot(rest[0] - point.x, rest[1] - point.y, rest[2] - point.z);
      if (distance < nearest) {
        nearest = distance;
        best = rest;
      }
    }
    return best;
  }
}

/** Thickness of a slab. */
export const SLAB_THICKNESS = 0.3;
/**
 * A slab's top stands this far above the ground it joins, like any platform's
 * (physics/movers.ts): a ball rolls onto it from the ground without meeting its edge.
 */
const SLAB_LIFT = 0.004;
/** Ticks a slab takes to drop out of sight. */
const FALL_TICKS = 50;
/** How hard it drops, in m/s^2: faster than the ball, so it never carries one down. */
const FALL_PULL = 16;
/** A ball this close above a slab's top is standing on it. */
const ON_SLAB = 0.08;

interface CrumbleState {
  touched: boolean;
  timer: number;
  gone: boolean;
}

/**
 * A cracked slab of a bridge (SPEC v5 3.5). Its signal: it has fallen.
 *
 * It is a collider of its own, not part of the ground mesh, since it has to be able to
 * go; so it is built the way platforms are, a little proud of the ground and only
 * there for a ball that is over it, and slabs that meet overlap. That is what keeps a
 * rolling ball from tripping on the joins.
 *
 * A slab counting down to its fall holds the stroke open. So a ball cannot be struck
 * from one, and the place a lost ball returns to is never a slab that is about to go.
 */
export class Crumble implements Part {
  readonly kind = 'crumble';
  readonly anchor: XYZ;
  readonly mover: Mover;
  /** A ball has stood on it. */
  touched = false;
  /** Ticks into its fall; -1 while it has not begun. */
  falling = -1;
  /** Ticks left before a slab with a delay falls; -1 while it has not been touched. */
  private timer = -1;

  constructor(
    readonly def: CrumbleDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.anchor = ground(def.at);
    const { world, surfaces } = field.host;
    this.mover = new Mover(
      {
        role: 'platform',
        size: [def.size[0], SLAB_THICKNESS, def.size[1]],
        position: def.at,
        surface: def.surface ?? 'slab',
        motion: { type: 'slide', offset: [0, 0, 0], period: 1 },
      },
      world,
      surfaces,
      () => this.pose(),
    );
  }

  get gone(): boolean {
    return this.falling >= FALL_TICKS;
  }

  get on(): boolean {
    return this.falling >= 0;
  }

  get busy(): boolean {
    return this.timer > 0 || (this.falling >= 0 && !this.gone);
  }

  /** How near it is to falling, 0 to 1: for the picture to shake it. */
  get strain(): number {
    if (this.falling >= 0) return 1;
    if (this.def.delay !== undefined) return this.timer < 0 ? 0 : 1 - this.timer / this.def.delay;
    return this.touched ? 0.5 : 0;
  }

  private pose(): MoverPose {
    const [x, y, z] = this.def.at;
    const top = y + SLAB_LIFT;
    const ticks = this.falling;
    let drop = 0;
    if (ticks >= FALL_TICKS) drop = 40;
    else if (ticks > 0) drop = 0.5 * FALL_PULL * (ticks * FIXED_DT) * (ticks * FIXED_DT);
    return { position: { x, y: top - SLAB_THICKNESS / 2 - drop, z }, yaw: 0 };
  }

  /** True if the ball is standing on the slab; `over`, if it is anywhere above it. */
  private standing(ball: Ball): { on: boolean; over: boolean } {
    if (!ball.body.isEnabled()) return { on: false, over: false };
    const p = ball.position();
    const over = this.mover.isUnder(p);
    const gap = p.y - ball.props.radius - (this.def.at[1] + SLAB_LIFT);
    return { on: over && gap < ON_SLAB, over };
  }

  step(): void {
    const { host } = this.field;
    if (this.falling >= 0) {
      if (!this.gone) this.falling++;
    } else {
      let on = false;
      let over = false;
      for (const ball of host.balls()) {
        const where = this.standing(ball);
        on ||= where.on;
        over ||= where.over;
      }
      if (on && !this.touched) {
        this.touched = true;
        host.cue('slabCrack');
        if (this.def.delay !== undefined) this.timer = Math.max(1, this.def.delay);
      }
      if (this.def.delay !== undefined) {
        if (this.timer > 0 && --this.timer === 0) this.fall();
      } else if (this.touched && !over) {
        // A hop on the spot is not leaving: only a ball no longer above it has gone.
        this.fall();
      }
    }
    this.mover.preStep(host.world, host.balls());
  }

  private fall(): void {
    this.falling = 0;
    this.timer = -1;
    this.field.host.cue('slabFall');
    this.field.host.changed(this.id);
  }

  postStep(): void {
    this.mover.postStep();
  }

  save(): CrumbleState {
    return { touched: this.touched, timer: this.timer, gone: this.falling >= 0 };
  }

  load(state: unknown): void {
    const { touched, timer, gone } = state as CrumbleState;
    this.touched = touched;
    this.timer = timer;
    this.falling = gone ? FALL_TICKS : -1;
    this.mover.snap(this.field.host.world);
  }
}
