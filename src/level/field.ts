import type { Vec2, Vec3 } from '../core/types';
import type { ZoneShape } from '../physics/zones/shape';
import type { CycleDef } from './schema';

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
  /** What it looks like. Defaults to `slab`. A `shutter` is a gate that keeps the beat (SPEC v6 3.4). */
  look?: 'slab' | 'bars' | 'boulder' | 'door' | 'shutter';
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

/**
 * A valve wheel on a post (SPEC v5 3.4). A knock turns it: open, shut, open again. Its
 * signal is on while it is open. Nothing a valve does cannot be undone by one more knock.
 */
export interface ValveDef {
  kind: 'valve';
  id: string;
  at: Vec3;
  /** How far below `at` the post reaches, for a valve that can also be struck from a raft lying low. Defaults to 0. */
  depth?: number;
  /** Starts open. */
  open?: boolean;
  /** What it looks like. A `lever` is the switch of a conveyor belt (SPEC v6 3.2). Defaults to `wheel`. */
  look?: 'wheel' | 'lever';
}

/**
 * A body of water over a rectangle of the course (SPEC v5 3.4). A ball that goes under
 * its surface is out of bounds. The surface stands at `level` unless one of `levels`
 * is called for, or, with a `tide`, rises and falls on the hole's clock.
 */
export interface WaterDef {
  kind: 'water';
  id: string;
  min: Vec2;
  max: Vec2;
  /** Height of the surface when nothing calls for another. */
  level: number;
  /** Other heights, each with the signal that calls for it. The first whose signal is on wins. */
  levels?: readonly { level: number; when: When }[];
  /**
   * Makes the surface go from `level` to `to` and back on the hole's clock, the way a
   * moving part goes back and forth, whatever any valve does.
   */
  tide?: { to: number } & CycleDef;
  /** How fast the surface moves when a valve changes it, in m/s. Defaults to 1.2. */
  speed?: number;
}

/**
 * A raft (SPEC v5 3.4). It lies on a body of water and goes up and down with it, never
 * sideways: nothing on this course has grip, so a raft that drifted would leave the
 * ball behind.
 */
export interface FloatDef {
  kind: 'float';
  id?: string;
  /** Id of the water it lies on. */
  water: string;
  /** Its middle, on the ground. */
  at: Vec2;
  /** Width (x), height (y) and depth (z). */
  size: Vec3;
  /** How far its top stands out of the water. Defaults to 0.1. */
  freeboard?: number;
  /** The lowest and the highest its top can go: it settles on the bottom, or stops under a ledge. */
  stops?: readonly [number, number];
  /** On water with a tide a ball may not be left on it: where to put one that stopped there. */
  rest?: readonly Vec3[];
  surface: string;
}

/**
 * A cracked slab of a bridge (SPEC v5 3.5). It falls once the ball has left it, so it
 * can be crossed, and stood on, exactly once. With a `delay` it does not wait for the
 * ball to leave: it falls that many physics ticks after it was first touched.
 */
export interface CrumbleDef {
  kind: 'crumble';
  id?: string;
  /** Middle of its top face, level with the ground it joins. */
  at: Vec3;
  /** Width (x) and depth (z). Let it reach a little under the ground and the slabs it joins. */
  size: Vec2;
  delay?: number;
  surface?: string;
}

/**
 * A conveyor belt over a rectangle of the course (SPEC v6 3.2). It carries a ball the
 * way moving water does: the ball takes up the belt's pace, however it came on. Lay it
 * over a floor piece of the same size. With a `when` it runs the other way while that
 * signal is on; without one it runs one way for good.
 */
export interface BeltDef extends Partial<Driven> {
  kind: 'belt';
  id: string;
  min: Vec2;
  max: Vec2;
  /** Height of the ground it lies on. Defaults to 0. */
  y?: number;
  /** The way it runs and how fast, [x, z] in m/s, while its signal is off. */
  velocity: Vec2;
  /** How quickly a ball takes up its pace, in 1/s. Defaults to that of a current. */
  strength?: number;
}

/**
 * A clock switch on a post (SPEC v6 3.5). A knock moves it on to the next of its
 * `rates`, round and round. A time zone that names it runs at the rate it shows. Its
 * signal is on whenever it shows any rate but the one it started at.
 */
export interface DialDef {
  kind: 'dial';
  id: string;
  at: Vec3;
  /** The rates it steps through. Defaults to slow, normal, fast: 0.5, 1, 2. */
  rates?: readonly number[];
  /** Which of them it starts at. Defaults to the second, which by default is normal. */
  start?: number;
}

/**
 * A time zone (SPEC v6 3.5): a rectangle of the course with a clock of its own. The
 * moving parts that name it (`MoverDef.clock`) keep that clock in place of the hole's.
 * Each tick is worth `rate` ticks of the zone's clock, so at 0.5 its machines run at
 * half speed and at 2 at double. The ball is never slowed or sped up: only machines are.
 *
 * Rates are whole eighths, so that the clock is the same number in every browser.
 */
export interface TimeZoneDef {
  kind: 'timeZone';
  id: string;
  min: Vec2;
  max: Vec2;
  /** Height of the ground it lies on. Defaults to 0. */
  y?: number;
  /** The rate it keeps when nothing calls for another. Defaults to 1. */
  rate?: number;
  /** Id of the clock switch that sets its rate. */
  dial?: string;
  /** Other rates, each with the signal that calls for it. The first whose signal is on wins, over the dial. */
  rates?: readonly { rate: number; when: When }[];
  /**
   * The rate it keeps for as long as a ball is inside it, whatever else calls for
   * another: the ball brings its own time with it (SPEC v6 3.5).
   */
  carried?: number;
}

/**
 * The beat as a signal (SPEC v6 3.4): on for some beats of the hole's and off for
 * others, round and round, whatever the ball does. A gate that listens to one opens
 * and shuts in time. The hole must have a `beat`.
 */
export interface PulseDef {
  kind: 'pulse';
  id: string;
  /** Where its lamps stand, on the ground: one for each beat of the pattern. */
  at: Vec3;
  /** Compass heading the row of lamps runs along, in degrees. Defaults to 90: along +X. */
  heading?: number;
  /** One entry per beat: 1 for a beat its signal is on, 0 for one it is off. */
  pattern: readonly (0 | 1)[];
}

export type PartDef =
  | BeltDef
  | DialDef
  | TimeZoneDef
  | PulseDef
  | ValveDef
  | WaterDef
  | FloatDef
  | CrumbleDef
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
