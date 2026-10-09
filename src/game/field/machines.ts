import type { XYZ } from '../../core/types';
import type { BeltDef, DialDef, Driven, PulseDef, TimeZoneDef } from '../../level/field';
import type { Ball } from '../../physics/ball';
import { carry, carryShare, DEFAULT_STRENGTH } from '../../physics/zones/water';
import { standPost, TURN_COOLDOWN, TURN_SPEED } from './elements';
import { Drive, ground, type Field, type LocalClock, type Part } from './field';

/** How much of its pace a belt gains or loses each tick while it turns round: a sixteenth, so half a second and a bit from one way to the other. */
const BELT_TURN = 1 / 16;
/** How far above the belt a ball's middle may be and still be on it, and how far below. */
const BELT_REACH = { up: 0.35, down: 0.05 };

interface BeltState {
  drive: ReturnType<Drive['save']> | null;
  reversed: boolean;
}

/**
 * A conveyor belt (SPEC v6 3.2). To a ball it is moving water: each step the ball's
 * speed along the ground comes a share nearer the belt's (physics/zones/water.ts). What
 * sets it apart is that the player can turn it round: with its signal on it runs the
 * other way. It does not flip. It slows, stops and picks up again over half a second,
 * so a ball on it is carried smoothly round with it.
 *
 * Its signal: it runs the other way from how it started, and has finished turning.
 */
export class Belt implements Part {
  readonly kind = 'belt';
  readonly anchor: XYZ;
  readonly drive: Drive | null;
  /** A belt with no switch never changes: it keeps time, as a moving part does. */
  readonly timed: boolean;
  /** Its pace as a share of `velocity`, from 1 (the way it starts) to -1 (turned right round). */
  flow = 1;
  private target = 1;
  private readonly share: number;
  private readonly y: number;

  constructor(
    readonly def: BeltDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.y = def.y ?? 0;
    this.anchor = { x: (def.min[0] + def.max[0]) / 2, y: this.y, z: (def.min[1] + def.max[1]) / 2 };
    this.drive = def.when === undefined ? null : new Drive(field, { ...def, when: def.when } as Driven, this);
    this.timed = this.drive === null;
    this.share = carryShare(def.strength ?? DEFAULT_STRENGTH);
  }

  wire(): void {
    this.drive?.wire();
  }

  get on(): boolean {
    return this.flow === -1;
  }

  get busy(): boolean {
    return (this.drive?.pending ?? false) || this.flow !== this.target;
  }

  /** The pace it carries a ball at right now, on the ground. */
  get pace(): { x: number; z: number } {
    return { x: this.def.velocity[0] * this.flow, z: this.def.velocity[1] * this.flow };
  }

  /** True if the ball is lying or rolling on the belt. */
  carries(ball: Ball): boolean {
    if (!ball.body.isEnabled()) return false;
    const { min, max } = this.def;
    const p = ball.position();
    const height = p.y - ball.props.radius - this.y;
    return p.x >= min[0] && p.x <= max[0] && p.z >= min[1] && p.z <= max[1] && height <= BELT_REACH.up && height >= -BELT_REACH.down;
  }

  step(): void {
    const { host } = this.field;
    const target = this.drive?.step() ? -1 : 1;
    if (target !== this.target) {
      this.target = target;
      host.cue('beltTurn');
      host.changed(this.id);
    }
    if (this.flow !== target) {
      this.flow += target > this.flow ? BELT_TURN : -BELT_TURN;
      if (this.flow === target) host.cue('beltRun');
    }
    const { x, z } = this.pace;
    for (const ball of host.balls()) if (this.carries(ball)) carry(ball, x, z, this.share);
  }

  save(): BeltState {
    return { drive: this.drive?.save() ?? null, reversed: this.target === -1 };
  }

  load(state: unknown): void {
    const { drive, reversed } = state as BeltState;
    if (drive) this.drive?.load(drive);
    this.flow = this.target = reversed ? -1 : 1;
  }
}

const DIAL_RATES = [0.5, 1, 2];
/** Every rate is a whole number of these, which keeps a local clock exact (see TimeZone). */
const RATE_STEP = 1 / 8;

function checkRate(rate: number, owner: string): number {
  if (!(rate > 0) || !Number.isInteger(rate / RATE_STEP)) {
    throw new Error(`${owner}: a rate must be a whole number of eighths above zero, not ${rate}`);
  }
  return rate;
}

/**
 * A clock switch (SPEC v6 3.5). One knock moves it on to its next rate, round and
 * round: slow, normal, fast, slow again. Its signal: it shows any rate but the one it
 * started at. Like a valve, nothing it does cannot be undone by knocking it again.
 */
export class Dial implements Part {
  readonly kind = 'dial';
  readonly anchor: XYZ;
  readonly busy = false;
  readonly rates: readonly number[];
  /** Which of its rates it shows. */
  position: number;
  private readonly start: number;
  private cooldown = 0;

  constructor(
    readonly def: DialDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.anchor = ground(def.at);
    this.rates = (def.rates ?? DIAL_RATES).map((rate) => checkRate(rate, `Dial "${id}"`));
    this.start = this.position = def.start ?? 1;
    if (!(this.start in this.rates)) throw new Error(`Dial "${id}" starts at a rate it does not have`);
    standPost(field, this, def.at);
  }

  get on(): boolean {
    return this.position !== this.start;
  }

  /** The rate it shows. */
  get rate(): number {
    return this.rates[this.position];
  }

  hit(_ball: Ball, speed: number): void {
    if (this.cooldown > 0 || speed < TURN_SPEED) return;
    this.position = (this.position + 1) % this.rates.length;
    this.cooldown = TURN_COOLDOWN;
    this.field.host.cue('dialTurn');
  }

  step(): void {
    if (this.cooldown > 0) this.cooldown--;
  }

  save(): number {
    return this.position;
  }

  load(state: unknown): void {
    this.position = state as number;
    this.cooldown = 0;
  }
}

/** How far a ball's middle may be above the ground of a time zone, or below it, and still be inside. */
const ZONE_REACH = { up: 2.5, down: 0.5 };

/**
 * A time zone (SPEC v6 3.5): a clock of its own for the machines that name it. Each
 * tick of the hole adds `rate` to it, and a moving part on this clock is wherever its
 * motion puts it at the clock's time. So the machines run slow or fast, and the ball,
 * which keeps no clock but the hole's, does not.
 *
 * A change of rate changes how fast the clock runs from here on and never what time it
 * shows: a machine carries on from exactly where it is. The rate itself is eased over
 * a few ticks, an eighth at a time, so nothing lurches. Rates being whole eighths, the
 * clock is a sum of eighths: exact, and the same in every browser.
 *
 * The clock is in no snapshot (SPEC v6 3.7), like the hole's own: a stroke taken back
 * does not turn a machine back. The dial that sets the rate is in it, so the rate goes
 * back with the dial.
 *
 * Its signal: it runs at another rate than the one it keeps when left alone.
 */
export class TimeZone implements Part, LocalClock {
  readonly kind = 'timeZone';
  readonly anchor: XYZ;
  readonly busy = false;
  /** Ticks of its own clock that one tick of the hole is worth right now. */
  rate: number;
  /** Its time at the hole's current tick, and at the next one. */
  now = 0;
  private next = 0;
  /** The rate it is easing toward. */
  private target: number;
  private readonly usual: number;
  private readonly y: number;
  private dial: Dial | null = null;

  constructor(
    readonly def: TimeZoneDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.y = def.y ?? 0;
    this.anchor = { x: (def.min[0] + def.max[0]) / 2, y: this.y, z: (def.min[1] + def.max[1]) / 2 };
    const owner = `Time zone "${id}"`;
    this.usual = checkRate(def.rate ?? 1, owner);
    for (const option of def.rates ?? []) checkRate(option.rate, owner);
    if (def.carried !== undefined) checkRate(def.carried, owner);
    this.rate = this.target = this.usual;
    this.next = this.rate;
  }

  wire(): void {
    if (this.def.dial === undefined) return;
    const dial = this.field.part(this.def.dial);
    if (!(dial instanceof Dial)) throw new Error(`Time zone "${this.id}" is set by "${this.def.dial}", which is not a dial`);
    this.dial = dial;
  }

  get on(): boolean {
    return this.target !== this.usual;
  }

  at(tick: number): number {
    return tick > this.field.host.world.tick ? this.next : this.now;
  }

  /** True if the ball is within the zone. */
  holds(ball: Ball): boolean {
    if (!ball.body.isEnabled()) return false;
    const { min, max } = this.def;
    const p = ball.position();
    const height = p.y - this.y;
    return p.x >= min[0] && p.x <= max[0] && p.z >= min[1] && p.z <= max[1] && height <= ZONE_REACH.up && height >= -ZONE_REACH.down;
  }

  /** The rate that is called for right now. */
  private wanted(): number {
    const { def, field } = this;
    if (def.carried !== undefined && field.host.balls().some((ball) => this.holds(ball))) return def.carried;
    for (const option of def.rates ?? []) if (field.test(option.when)) return option.rate;
    return this.dial?.rate ?? this.usual;
  }

  step(): void {
    const wanted = this.wanted();
    if (wanted !== this.target) {
      this.field.host.cue(wanted < this.target ? 'timeSlow' : 'timeFast');
      this.target = wanted;
    }
    if (this.rate !== this.target) {
      const gap = this.target - this.rate;
      this.rate = Math.abs(gap) <= RATE_STEP ? this.target : this.rate + (gap > 0 ? RATE_STEP : -RATE_STEP);
    }
    this.next = this.now + this.rate;
  }

  postStep(): void {
    this.now = this.next;
    // Until the next `step` says otherwise the clock runs on as it is: after the hole
    // is over the parts stop being stepped, and the machines must not stop dead.
    this.next = this.now + this.rate;
  }

  save(): null {
    return null;
  }

  load(): void {}

  /** After a snapshot is put back the rate is whatever the dial, put back with it, calls for: at once, without a sound. */
  resync(): void {
    this.rate = this.target = this.wanted();
    this.next = this.now + this.rate;
  }
}

/**
 * The beat as a signal (SPEC v6 3.4). Its signal: this beat of the hole's is one of
 * the beats its pattern marks. It is a function of the hole's clock and of nothing
 * else, so it is in no snapshot and nothing a ball does reaches it.
 */
export class Pulse implements Part {
  readonly kind = 'pulse';
  readonly anchor: XYZ;
  readonly busy = false;
  readonly timed = true;
  private readonly ticks: number;

  constructor(
    readonly def: PulseDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.anchor = ground(def.at);
    const { beat } = field.host;
    if (beat === null) throw new Error(`Pulse "${id}" keeps the beat, and the hole has none`);
    if (def.pattern.length === 0) throw new Error(`Pulse "${id}" has an empty pattern`);
    this.ticks = beat;
  }

  /** Which beat of its pattern the hole is in. */
  get beat(): number {
    return Math.floor(this.field.host.world.tick / this.ticks) % this.def.pattern.length;
  }

  get on(): boolean {
    return this.def.pattern[this.beat] === 1;
  }

  step(): void {}

  save(): null {
    return null;
  }

  load(): void {}
}
