import { FIXED_DT } from '../../core/loop';
import { hypot } from '../../core/math';
import type { Vec3, XYZ } from '../../core/types';
import type { BellDef, CoinDef, DragonDef, FireDef } from '../../level/field';
import type { Ball } from '../../physics/ball';
import { cyclePhase } from '../../physics/movers';
import { RAPIER } from '../../physics/rapier';
import { getSurface } from '../../physics/surfaces';
import { shapeContains } from '../../physics/zones/shape';
import { Drive, ground, type Field, type Part } from './field';
import { ballNear } from './tomb';

const COIN_REACH = 0.34;

/**
 * A gold coin (SPEC v4 3.6). A ball that rolls through it picks it up. Gold is never a
 * score: it only counts toward a hole's challenge. Its signal: it has been picked up.
 */
export class Coin implements Part {
  readonly kind = 'coin';
  readonly anchor: XYZ;
  readonly busy = false;
  collected = false;

  constructor(
    readonly def: CoinDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.anchor = ground(def.at);
  }

  get on(): boolean {
    return this.collected;
  }

  step(): void {
    if (this.collected) return;
    if (!this.field.host.balls().some((ball) => ballNear(ball, this.anchor, COIN_REACH, 0.6))) return;
    this.collected = true;
    this.field.host.cue('coin');
  }

  save(): boolean {
    return this.collected;
  }

  load(state: unknown): void {
    this.collected = state as boolean;
  }
}

/** Radius of the post a bell hangs on. */
export const BELL_POST = 0.13;
const BONES_REACH = 0.4;

/**
 * Something that makes a noise when the ball touches it (SPEC v4 3.6): each touch
 * raises the alert by one. The ball has to leave and come back to set it off again, so
 * one that stops against a bell rings it once. Its signal: it has been set off.
 */
export class Bell implements Part {
  readonly kind = 'bell';
  readonly anchor: XYZ;
  readonly busy = false;
  /** How many times it has been set off, for the picture to swing. */
  rings = 0;
  private readonly reach: number;
  private touching = new WeakSet<Ball>();

  constructor(
    readonly def: BellDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.anchor = ground(def.at);
    const solid = (def.look ?? 'bell') === 'bell';
    // A bell is touched when the ball is against its post.
    this.reach = def.radius ?? (solid ? BELL_POST : BONES_REACH);
    if (solid) {
      const { world, surfaces } = field.host;
      const collider = world.raw.createCollider(
        RAPIER.ColliderDesc.cylinder(0.45, BELL_POST)
          .setTranslation(def.at[0], def.at[1] + 0.45, def.at[2])
          .setFriction(0)
          .setRestitution(getSurface('brass').restitution)
          .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
      );
      surfaces.setCollider(collider.handle, 'prop', 'brass');
    }
  }

  get on(): boolean {
    return this.rings > 0;
  }

  private near(ball: Ball): boolean {
    const solid = (this.def.look ?? 'bell') === 'bell';
    return ballNear(ball, this.anchor, this.reach + (solid ? ball.props.radius + 0.04 : 0), 0.6);
  }

  step(): void {
    for (const ball of this.field.host.balls()) {
      const now = this.near(ball);
      if (now && !this.touching.has(ball)) {
        this.rings++;
        this.field.alert++;
        this.field.host.cue('bell');
      }
      if (now) this.touching.add(ball);
      else this.touching.delete(ball);
    }
  }

  save(): number {
    return this.rings;
  }

  load(state: unknown): void {
    this.rings = state as number;
  }

  resync(): void {
    this.touching = new WeakSet(this.field.host.balls().filter((ball) => this.near(ball)));
  }
}

/**
 * The dragon (SPEC v4 3.6). It sleeps until the alert reaches its threshold. Its signal:
 * it is awake. It never goes back to sleep by itself; only putting the course back to
 * how it was before a stroke, alert included, finds it asleep again.
 */
export class Dragon implements Part {
  readonly kind = 'dragon';
  readonly anchor: XYZ;
  readonly busy = false;
  /** The alert level it last reacted to. */
  private heard = 0;

  constructor(
    readonly def: DragonDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.anchor = ground(def.at);
  }

  get on(): boolean {
    return this.field.alert >= this.def.threshold;
  }

  /** How close to waking it is, 0 to 1. */
  get unrest(): number {
    return Math.min(1, this.field.alert / this.def.threshold);
  }

  step(): void {
    const { alert, host } = this.field;
    if (alert === this.heard) return;
    const { threshold } = this.def;
    if (alert >= threshold && this.heard < threshold) {
      host.cue('dragonWake');
      host.changed(this.id);
    } else if (alert < threshold && alert > this.heard) {
      host.cue('dragonStir');
    }
    this.heard = alert;
  }

  save(): null {
    return null;
  }

  load(): void {}

  resync(): void {
    this.heard = this.field.alert;
  }
}

/** Seconds of warning before a burst of fire, in which it glows without burning. */
const FIRE_WARNING = 0.7;

/**
 * Fire (SPEC v4 3.6). A ball that touches it while it burns is out of bounds. Without a
 * cycle it burns for as long as its signal is on. With one it burns in bursts on the
 * hole's clock, the same clock moving parts keep, so that what a burst does to a stroke
 * depends on the tick the stroke was played and on nothing else. Its signal: it is lit.
 *
 * A ball may never be left where fire can burn: it would be put back on the spot it was
 * struck from, which is that same spot, and burn again for ever.
 */
export class Fire implements Part {
  readonly kind = 'fire';
  readonly anchor: XYZ;
  readonly drive: Drive;
  /** Its signal has arrived: it burns, or burns in bursts. */
  lit = false;
  /** It is burning this tick. */
  burning = false;
  /** How near it is to burning, 0 to 1: the glow that warns of a burst. */
  heat = 0;

  constructor(
    readonly def: FireDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    const [x, y, z] = def.shape.center;
    const drop = def.shape.kind === 'box' ? def.shape.halfExtents[1] : def.shape.radius;
    this.anchor = { x, y: y - drop, z };
    this.drive = new Drive(field, def, this);
  }

  wire(): void {
    this.drive.wire();
  }

  get on(): boolean {
    return this.lit;
  }

  get busy(): boolean {
    return this.drive.pending;
  }

  step(): void {
    const { host } = this.field;
    const lit = this.drive.step();
    if (lit !== this.lit) {
      this.lit = lit;
      if (lit) host.changed(this.id);
    }
    const was = this.burning;
    const { cycle } = this.def;
    if (!lit) {
      this.burning = false;
      this.heat = this.drive.progress;
    } else if (!cycle) {
      this.burning = true;
      this.heat = 1;
    } else {
      const u = cyclePhase(host.world.tick, cycle.period, cycle.phase);
      this.burning = u < cycle.burn;
      const warning = Math.min(FIRE_WARNING / cycle.period, 1 - cycle.burn);
      this.heat = this.burning ? 1 : Math.max(0, (u - (1 - warning)) / warning);
    }
    if (this.burning && !was) host.cue('fireOn');
    else if (!this.burning && was) host.cue('fireOff');
    if (!this.burning) return;
    for (const ball of host.balls()) {
      if (ball.body.isEnabled() && this.reaches(ball)) host.outOfBounds(ball);
    }
  }

  /** True if the ball is in the fire, or will be within the coming step. */
  private reaches(ball: Ball): boolean {
    const p = ball.position();
    const v = ball.velocity();
    for (const t of [0, 0.5, 1]) {
      const at = { x: p.x + v.x * FIXED_DT * t, y: p.y + v.y * FIXED_DT * t, z: p.z + v.z * FIXED_DT * t };
      if (shapeContains(this.def.shape, at)) return true;
    }
    return false;
  }

  forbidsRest(point: XYZ): boolean {
    return (this.lit || this.drive.input) && shapeContains(this.def.shape, point);
  }

  nearestRest(point: XYZ): Vec3 | null {
    let best: Vec3 | null = null;
    let nearest = Infinity;
    for (const rest of this.def.rest) {
      const distance = hypot(rest[0] - point.x, rest[1] - point.y, rest[2] - point.z);
      if (distance < nearest) {
        nearest = distance;
        best = rest;
      }
    }
    return best;
  }

  save(): unknown {
    return { drive: this.drive.save(), lit: this.lit };
  }

  load(state: unknown): void {
    const { drive, lit } = state as { drive: ReturnType<Drive['save']>; lit: boolean };
    this.drive.load(drive);
    this.lit = lit;
    this.burning = false;
  }
}
