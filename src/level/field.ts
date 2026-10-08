import type { Vec2, Vec3 } from '../core/types';
import type { ZoneShape } from '../physics/zones/shape';

/**
 * The works of a hole (SPEC v4 3, 4): plates, gates, stones, crystals, light, moving
 * blocks, gold and a dragon. Everything here is data. What each part does lives in a
 * registered module (game/field), the way zones and challenges do, so a hole never
 * carries logic of its own and a new kind of part is one more registration.
 *
 * Parts are wired by name. A part that reacts to others says so with `when`: it reacts
 * to their signal, which each part defines for itself (a plate is on while pressed, a
 * gate once it has opened, a block once it has arrived). A chain is nothing more than
 * parts listening to one another.
 */
export interface FieldDef {
  /** The squares stones slide on. Needed only by a hole with stones. */
  grid?: GridDef;
  parts: readonly PartDef[];
}

/**
 * What a part listens to: one part's signal, or all of several while none of some
 * others is on. `'plate'` is short for `{ all: ['plate'] }`.
 */
export type When = string | { all?: readonly string[]; none?: readonly string[] };

/** Fields shared by every part that reacts to a signal. */
export interface Driven {
  when: When;
  /**
   * Physics ticks between the signal turning on and the part reacting. Defaults to the
   * time the glow takes to run down the line from the source, which is faster than any
   * ball: a ball that rolls over a plate never gets to the gate first.
   */
  delay?: number;
  /** Once it has reacted it stays that way, whatever the signal does next. */
  latch?: boolean;
  /** Corners of the glowing line from the source to this part, on the ground. Straight if left out. */
  via?: readonly Vec2[];
  /** Draw no line at all, for a part that sits right on its source. */
  unlinked?: boolean;
}

/**
 * Squares of `cell` metres, `cols` across (+X) and `rows` deep (+Z), the centre of square
 * (0, 0) at `origin`. A stone moves one square at a time and never leaves the grid.
 */
export interface GridDef {
  origin: Vec2;
  /** Height of the ground the stones stand on. Defaults to 0. */
  y?: number;
  /** Defaults to 1. */
  cell?: number;
  cols: number;
  rows: number;
  /** Squares no stone may enter: where a wall, a crystal or anything else fixed stands. */
  blocked?: readonly Cell[];
}

export type Cell = readonly [col: number, row: number];

/**
 * A plate in the ground. A ball rolling over it presses it, and so does a stone standing
 * on it. `latch`: pressed once, on for good. `hold`: on only while something is on it.
 */
export interface PlateDef {
  kind: 'plate';
  id: string;
  at: Vec3;
  mode: 'latch' | 'hold';
  /** Defaults to 0.45. */
  radius?: number;
}

/**
 * A slab across a doorway, between two points on the ground. Shut, it is a wall. It
 * never shuts on a ball or a stone standing in the doorway: it waits for them to leave.
 */
export interface GateDef extends Driven {
  kind: 'gate';
  id: string;
  from: Vec2;
  to: Vec2;
  /** Height of the ground it stands on. Defaults to 0. */
  y?: number;
  height?: number;
  thickness?: number;
  /**
   * `false` (the default): shut until its signal is on. `true`: a trap, open until its
   * signal is on, then shut.
   */
  trap?: boolean;
  /** What it looks like. Defaults to `slab`. */
  look?: 'slab' | 'bars' | 'boulder' | 'door';
  surface?: string;
}

/** A block of stone on the grid. A ball that runs into one of its sides shoves it one square the other way. */
export interface StoneDef {
  kind: 'stone';
  id?: string;
  cell: Cell;
}

/**
 * A crystal on a pedestal. Light that reaches it leaves the way it points. A ball that
 * runs into it turns it to the next of its `facings`, round and round.
 */
export interface CrystalDef {
  kind: 'crystal';
  id?: string;
  at: Vec3;
  /** Compass headings in degrees it can point: 0 is -Z, 90 is +X. Two to four of them. */
  facings: readonly number[];
  /** Which of them it starts at. Defaults to the first. */
  start?: number;
}

/** Where a beam of light starts. It shines all the time unless it has a `when`. */
export interface EmitterDef extends Partial<Driven> {
  kind: 'emitter';
  id?: string;
  at: Vec3;
  heading: number;
}

/** What a beam is for. Once light has reached it, it stays on. */
export interface ReceiverDef {
  kind: 'receiver';
  id: string;
  at: Vec3;
  /** How near its centre a beam has to pass. Defaults to 0.35. */
  radius?: number;
}

/**
 * A block that travels from one place to another when its signal comes on, and stays
 * there: a bridge rising out of a pit, a boulder rolling across. `platform`: the ball
 * can roll onto its top. `pusher`: an obstacle that shoves the ball.
 */
export interface SliderDef extends Driven {
  kind: 'slider';
  id: string;
  role: 'platform' | 'pusher';
  /** Width (x), height (y) and depth (z). */
  size: Vec3;
  /** Its centre before it moves, and after. */
  from: Vec3;
  to: Vec3;
  /** Physics ticks the journey takes. Defaults to 60. */
  ticks?: number;
  look?: 'bridge' | 'boulder' | 'block';
  surface: string;
}

/** A gold coin. A ball that rolls through it picks it up. Gold is never a score, only a challenge. */
export interface CoinDef {
  kind: 'coin';
  id?: string;
  at: Vec3;
}

/**
 * Something that makes a noise when the ball touches it. Each touch raises the alert by
 * one. `bell` stands in the way and the ball bounces off it; `bones` lie on the floor.
 */
export interface BellDef {
  kind: 'bell';
  id?: string;
  at: Vec3;
  look?: 'bell' | 'bones';
  /** How near the ball has to come. Defaults to touching for a bell, 0.4 for bones. */
  radius?: number;
}

/** The dragon. It wakes once the alert has reached `threshold`, and its signal is on from then. */
export interface DragonDef {
  kind: 'dragon';
  id: string;
  at: Vec3;
  /** Compass heading it faces, in degrees. */
  heading?: number;
  threshold: number;
}

/**
 * Fire. A ball that touches it while it burns is out of bounds. It burns while its
 * signal is on; with a `cycle`, in bursts on a fixed schedule, with a warning before each.
 */
export interface FireDef extends Driven {
  kind: 'fire';
  id: string;
  shape: ZoneShape;
  /** Seconds per cycle, the share of it the fire burns, and where in the cycle it starts. */
  cycle?: { period: number; burn: number; phase?: number };
  /** Where a ball that came to rest in the fire's place is put. A ball may never be left there. */
  rest: readonly Vec3[];
}

export type PartDef =
  | PlateDef
  | GateDef
  | StoneDef
  | CrystalDef
  | EmitterDef
  | ReceiverDef
  | SliderDef
  | CoinDef
  | BellDef
  | DragonDef
  | FireDef;
