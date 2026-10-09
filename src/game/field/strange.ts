import { hypot } from '../../core/math';
import type { XYZ } from '../../core/types';
import type { EchoDef, EchoPlateDef } from '../../level/field';
import type { Ball } from '../../physics/ball';
import { ground, type Field, type Part } from './field';

/**
 * One stroke as an echo zone heard it (SPEC v8 3.5): where the ball was on each tick
 * it spent inside. Once the stroke is over it is never changed again, so a snapshot
 * may hold on to it as it is.
 */
export interface Recording {
  /** Ticks since the stroke was played, in order: one entry for each tick the ball was inside. */
  readonly at: readonly number[];
  readonly x: readonly number[];
  readonly y: readonly number[];
  readonly z: readonly number[];
  /** Ticks the whole stroke took. If the last entry of `at` is this, the ball came to rest inside. */
  readonly length: number;
}

/** How far above or below the zone's floor a ball's underside may be and still be heard. */
const ECHO_REACH = 0.5;

interface EchoState {
  playing: Recording | null;
  since: number;
  heard: Recording | null;
}

/**
 * An echo zone (SPEC v8 3.5): a rectangle of ground that hears every stroke and plays
 * the one before back. When a stroke is played, the last one is set going again as an
 * echo, tick for tick as it went, wherever its path lay inside the zone. If that
 * stroke ended inside, the echo stops there too, and stays until the next stroke.
 *
 * An echo is a path being read back. Nothing is simulated and nothing can run into it:
 * all it ever does is stand on an echo plate. Its signal: an echo is in the zone now.
 *
 * What is in the snapshot is which stroke is being played back and since when, and
 * which was heard last. How far the playing has got is not: that is the hole's clock.
 */
export class Echo implements Part {
  readonly kind = 'echo';
  readonly anchor: XYZ;
  readonly busy = false;
  /** Where the echo is, as of the step now being taken and the one before it; null while none is in the zone. */
  now: XYZ | null = null;
  prev: XYZ | null = null;
  /** The last stroke that was finished: what the next one will set going. For the picture to draw its path. */
  heard: Recording | null = null;
  private playing: Recording | null = null;
  /** The tick the stroke being played back was set going on. */
  private since = 0;
  /** The stroke under way, as heard so far. */
  private taking: { ball: Ball; from: number; at: number[]; x: number[]; y: number[]; z: number[] } | null = null;
  private readonly y: number;

  constructor(
    readonly def: EchoDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.y = def.y ?? 0;
    this.anchor = { x: (def.min[0] + def.max[0]) / 2, y: this.y, z: (def.min[1] + def.max[1]) / 2 };
  }

  get on(): boolean {
    return this.now !== null;
  }

  /** True if a ball at `p`, of radius `r`, is in the zone. */
  private hears(p: XYZ, r: number): boolean {
    const { min, max } = this.def;
    return p.x >= min[0] && p.x <= max[0] && p.z >= min[1] && p.z <= max[1] && Math.abs(p.y - r - this.y) <= ECHO_REACH;
  }

  private take(tick: number): void {
    const taking = this.taking;
    if (!taking || !taking.ball.body.isEnabled()) return;
    const p = taking.ball.position();
    if (!this.hears(p, taking.ball.props.radius)) return;
    const k = tick - taking.from;
    // The stroke's last tick is taken once by the step and once more as it ends.
    if (taking.at[taking.at.length - 1] === k) return;
    taking.at.push(k);
    taking.x.push(p.x);
    taking.y.push(p.y);
    taking.z.push(p.z);
  }

  /** Where the stroke being played back had the ball `k` ticks in, if that was inside the zone. */
  private echoAt(k: number): XYZ | null {
    const rec = this.playing;
    if (!rec || rec.at.length === 0 || k < 0) return null;
    let i = rec.at.length - 1;
    if (k < rec.length) {
      // The entry for tick k, if there is one: the ticks are in order.
      let low = 0;
      let high = i;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (rec.at[mid] < k) low = mid + 1;
        else high = mid;
      }
      i = low;
      if (rec.at[i] !== k) return null;
    } else if (rec.at[i] !== rec.length) {
      // Played out, and the stroke did not end in here.
      return null;
    }
    return { x: rec.x[i], y: rec.y[i], z: rec.z[i] };
  }

  struck(ball: Ball): void {
    const tick = this.field.host.world.tick;
    this.playing = this.heard;
    this.since = tick;
    this.taking = { ball, from: tick, at: [], x: [], y: [], z: [] };
    if (this.playing && this.playing.at.length > 0) this.field.host.cue('echoStart');
  }

  rested(): void {
    const taking = this.taking;
    if (!taking) return;
    const tick = this.field.host.world.tick;
    // Where it stopped, which is not always where the last step left it.
    this.take(tick);
    this.heard = { at: taking.at, x: taking.x, y: taking.y, z: taking.z, length: tick - taking.from };
    this.taking = null;
  }

  step(): void {
    const tick = this.field.host.world.tick;
    this.take(tick);
    this.prev = this.now;
    this.now = this.echoAt(tick - this.since);
  }

  save(): EchoState {
    return { playing: this.playing, since: this.since, heard: this.heard };
  }

  load(state: unknown): void {
    const { playing, since, heard } = state as EchoState;
    this.playing = playing;
    this.since = since;
    this.heard = heard;
    // The stroke that was under way did not happen.
    this.taking = null;
  }

  resync(): void {
    this.now = this.prev = this.echoAt(this.field.host.world.tick - this.since);
  }
}

const ECHO_PLATE_RADIUS = 0.45;

/**
 * An echo plate (SPEC v8 3.5). Only an echo presses it: a ball rolls over it as over
 * plain ground. Otherwise it is a plate like any other, one that stays down once
 * pressed (`latch`) or one that is down only while an echo stands on it (`hold`).
 *
 * List the echo zones of a hole before its plates: a plate looks at where each echo is
 * on the step being taken.
 */
export class EchoPlate implements Part {
  readonly kind = 'echoPlate';
  readonly anchor: XYZ;
  readonly radius: number;
  readonly busy = false;
  /** An echo is on it right now. */
  pressed = false;
  private latched = false;

  constructor(
    readonly def: EchoPlateDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.anchor = ground(def.at);
    this.radius = def.radius ?? ECHO_PLATE_RADIUS;
  }

  get on(): boolean {
    return this.def.mode === 'latch' ? this.latched : this.pressed;
  }

  private under(p: XYZ): boolean {
    return Math.abs(p.y - this.anchor.y) < 0.6 && hypot(p.x - this.anchor.x, p.z - this.anchor.z) <= this.radius;
  }

  private loaded(): boolean {
    for (const echo of this.field.all<Echo>('echo')) {
      const { now, prev } = echo;
      if (!now) continue;
      if (this.under(now)) return true;
      // A fast echo must not step over a plate: half way from where it was counts too.
      if (prev && this.under({ x: (now.x + prev.x) / 2, y: now.y, z: (now.z + prev.z) / 2 })) return true;
    }
    return false;
  }

  step(): void {
    const now = this.loaded();
    if (now !== this.pressed) this.field.host.cue(now ? 'echoPlateDown' : 'echoPlateUp');
    this.pressed = now;
    if (now) this.latched = true;
  }

  save(): boolean {
    return this.latched;
  }

  load(state: unknown): void {
    this.latched = state as boolean;
  }

  resync(): void {
    this.pressed = this.loaded();
  }
}
