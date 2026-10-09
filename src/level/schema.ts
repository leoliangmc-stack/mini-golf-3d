import type { I18nText, Vec2, Vec3 } from '../core/types';
import type { ZoneDef } from '../physics/zones';
import type { ZoneShape } from '../physics/zones/shape';
import type { FieldDef } from './field';

/**
 * A chapter: a run of worlds closed by one finale hole. A chapter opens when the finale
 * of another has been finished: the one before it, unless it names a different one.
 */
export interface ChapterDef {
  id: string;
  name: I18nText;
  worlds: readonly WorldDef[];
  finale: FinaleDef;
  /**
   * Id of the chapter whose finale opens this one. Defaults to the chapter before it.
   * Naming an earlier one lets two chapters be open side by side (SPEC v4 3.1).
   */
  after?: string;
}

/**
 * The hole that closes a chapter, combining its mechanics. It belongs to no world, but
 * it is presented the way a world is, with a name, a look and a rule card of its own,
 * so it has the shape of a world with exactly one hole.
 */
export interface FinaleDef extends Omit<WorldDef, 'holes'> {
  holes: readonly [HoleDef];
}

/**
 * World and hole data format. Every hole in the game is an instance of this; adding
 * a hole must never require touching engine code.
 */
export interface WorldDef {
  id: string;
  name: I18nText;
  /** Id of a registered theme: sky, lights, colours. */
  theme: string;
  /** One-line statement of the world's rule, shown when its first hole starts. */
  ruleCard: I18nText;
  /** The rule in a word or two, shown in the corner while playing. */
  ruleTag: I18nText;
  holes: readonly HoleDef[];
}

export interface HoleDef {
  id: string;
  par: number;
  /** Strokes after which the hole ends automatically. Defaults to twice the par. */
  strokeLimit?: number;
  /** Point on the ground where the ball starts. */
  tee: Vec3;
  /** What finishes the hole: a cup to sink the ball in, pins to knock down, or one after the other. */
  goal: GoalDef;
  pieces: readonly PieceDef[];
  zones: readonly ZoneDef[];
  /** Moving parts. They keep moving while the player aims. */
  movers?: readonly MoverDef[];
  /**
   * The beat every machine of the hole keeps (SPEC v6 3.4). It is counted in physics
   * ticks, a whole number of them, so that no beat ever drifts from the one before:
   * 30 ticks is 120 beats a minute. Sound follows it; nothing in the game follows sound.
   */
  beat?: BeatDef;
  /** Loose boxes the ball can shove around, if it is heavy enough. */
  crates?: readonly CrateDef[];
  /**
   * The works of the hole: plates, gates, stones, crystals, gold, a dragon (SPEC v4 3).
   * On a hole that has them, the course goes back with the ball after an out-of-bounds,
   * and the player may take a stroke back.
   */
  field?: FieldDef;
  /**
   * A mirror (SPEC v8 3.4): the hole has a shadow ball beyond it, which is struck with
   * every stroke of the player's, the other way round. It goes with neither splitting
   * nor skills.
   */
  mirror?: MirrorDef;
  /** How many balls a split may leave on the course at once, 1 to 4. Defaults to 1: no splitting. */
  maxBalls?: number;
  /** Skills the player may use on this hole, and how many times each: `{ freeze: 2 }`. */
  skills?: Readonly<Record<string, number>>;
  /** Scenery. It has no collision and no rules. */
  decor?: readonly DecorDef[];
  /**
   * Countdown for the whole hole, started by the first stroke and running while the
   * player aims. When it runs out the hole restarts from the tee.
   */
  timer?: { seconds: number };
  /** Where the ball goes after an out-of-bounds penalty. */
  outOfBounds: 'lastPosition' | 'tee';
  /** Extra condition for the third star. Without one, par alone earns it. */
  challenge?: ChallengeDef;
  /** Tutorial prompts to show on this hole. */
  hints?: readonly HintId[];
  camera?: CameraOverride;
}

export type HintId = 'slingshot';

/**
 * A mirror standing across the course (SPEC v8 3.4), and the shadow ball beyond it. A
 * stroke sets both balls off at once, each from where it lies, as hard as each other
 * and in directions that are each other's reflection. Where they lie is not mirrored:
 * the two sides may have different walls, and the balls drift apart.
 *
 * The shadow presses plates and knocks levers like any ball. It cannot be holed, picked
 * or struck by itself, and if it leaves the course it is put back where the stroke
 * found it, at no cost.
 *
 * The mirror itself is only a picture: put a wall where it stands, or the two balls
 * can change sides.
 */
export interface MirrorDef {
  /** The way the mirror faces: `x` for one standing on the line x = `at`, which turns left into right. */
  axis: 'x' | 'z';
  at: number;
  /** Where the pane is drawn: from and to along the other axis. */
  span: readonly [number, number];
  /** Height of the ground it stands on. Defaults to 0. */
  y?: number;
  /** Point on the ground where the shadow starts. Defaults to the reflection of the tee. */
  shadow?: Vec3;
  /**
   * The part of the course the mirror shows. Only a stroke played from inside it sets
   * the shadow off; anywhere else the shadow stays where it is. Defaults to everywhere.
   */
  reach?: ZoneShape;
}

/**
 * Third-star condition, checked against what happened during the round. `type` names
 * a registered check (see game/challenges.ts); the other fields are its arguments.
 */
export interface ChallengeDef {
  type: string;
  /** Shown to the player. */
  text: I18nText;
  surface?: string;
  strokes?: number;
  shape?: ZoneShape;
  /** Name of a zone cue, e.g. `tunnelEnter`. */
  cue?: string;
  count?: number;
  seconds?: number;
  /** Id of one of the hole's works. */
  part?: string;
}

export interface BeatDef {
  /** Physics ticks one beat lasts. A whole number. */
  ticks: number;
  /** Beats to the bar, the first of them the strong one. Defaults to 4. */
  bar?: number;
}

/** Per-hole camera settings; anything left out uses the default. Angles in degrees. */
export interface CameraOverride {
  pitch?: number;
  yaw?: number;
  minDistance?: number;
  maxDistance?: number;
  /**
   * Points on the ground to keep in view besides the ball and the goal: something the
   * player has to see that lies the other way from the cup.
   */
  keep?: readonly Vec3[];
}

/** The three sizes a ball can be (SPEC v3 2.2). */
export type BallSize = 'small' | 'medium' | 'large';

/**
 * What the player has to do to finish a hole (SPEC v3 2.8).
 *
 * - `cup`: sink a ball in it.
 * - `knockdown`: knock every pin over. There is no cup.
 * - `sequence`: the steps one after the other. A cup that is not the current step is
 *   not there yet: it appears when the steps before it are done. A cup ends the round
 *   for the ball that drops into it, so it belongs at the end.
 */
export type GoalDef = CupGoal | KnockdownGoal | SequenceGoal;

export interface CupGoal extends CupDef {
  type: 'cup';
}

export interface KnockdownGoal {
  type: 'knockdown';
  pins: readonly PinDef[];
  /** A pin leaning further than this from upright, in degrees, is down. Defaults to 60. */
  tiltThreshold?: number;
}

export interface SequenceGoal {
  type: 'sequence';
  steps: readonly GoalDef[];
}

/** One bowling pin. */
export interface PinDef {
  /** Point on the ground the pin stands on. */
  at: Vec3;
}

export interface CupDef {
  /** Point on the ground at the center of the cup; where its cycle starts if it moves. */
  position: Vec3;
  radius: number;
  /** The ball drops in only when moving slower than this, in m/s, measured against the cup. */
  captureSpeed: number;
  /**
   * Makes the cup travel on a fixed schedule, with the same motions moving parts use.
   * Everything it passes over must be level ground at the height of `position`.
   */
  motion?: MotionDef;
  /** A lid that opens and shuts on a fixed schedule. Shut, the cup is plain ground. */
  hidden?: LidDef;
  /** The one ball size the cup takes. Defaults to any. */
  acceptSize?: BallSize | 'any';
}

/**
 * A loose box. It slides when something heavy enough runs into it and soon stops by
 * itself; it never turns or tips over. The medium ball weighs 0.05 kg and barely moves one.
 */
export interface CrateDef {
  /** Width (x), height (y) and depth (z) before rotation. */
  size: Vec3;
  /** Point on the ground under the middle of the crate. */
  at: Vec3;
  /** Rotation about the vertical axis, in degrees. */
  yaw?: number;
  /** In kilograms. Defaults to 6. */
  mass?: number;
  surface: string;
}

export interface LidDef {
  /** Seconds for one open-and-shut cycle. */
  period: number;
  /** Share of the cycle the cup is open, from the start of the cycle. */
  openRatio: number;
  /** Where in the cycle the lid starts, 0..1. */
  phase?: number;
}

/**
 * A piece of scenery: a registered model (see render/decor.ts) placed in the world.
 * `size` and `color` mean whatever that model says they mean.
 */
export interface DecorDef {
  type: string;
  /** Where the model stands. */
  at: Vec3;
  /** Rotation about the vertical axis, in degrees. */
  yaw?: number;
  size?: Vec3;
  color?: number;
}

export type PieceDef = FloorPiece | RampPiece | WallPiece | PillarPiece | BeamPiece;

/**
 * Flat rectangle of ground. Bounds must be multiples of FLOOR_CELL so that
 * neighbouring pieces share vertices (see level/compile.ts).
 */
export interface FloorPiece {
  type: 'floor';
  min: Vec2;
  max: Vec2;
  /** Height of the playing surface. Defaults to 0. */
  y?: number;
  /** Thickness of the solid slab under the surface. Defaults to a thin platform. */
  depth?: number;
  surface: string;
}

/**
 * Sloped rectangle of ground. Height changes linearly along one axis, from `yFrom`
 * at the `min` edge to `yTo` at the `max` edge. Same grid rule as FloorPiece.
 */
export interface RampPiece {
  type: 'ramp';
  min: Vec2;
  max: Vec2;
  along: 'x' | 'z';
  yFrom: number;
  yTo: number;
  /** Thickness of the solid body below the lowest edge. */
  depth?: number;
  surface: string;
}

/**
 * Straight rail between two points. Author one piece per straight run: a run split
 * into several pieces has seams the ball can catch on when rolling along it.
 */
export interface WallPiece {
  type: 'wall';
  from: Vec2;
  to: Vec2;
  /** Height of the ground the wall stands on: one value, or [at from, at to] for a rail along a ramp. */
  y?: number | readonly [number, number];
  height?: number;
  thickness?: number;
  surface: string;
}

/**
 * A bar across the course with a gap under it, like a limbo bar: a ball rolls under only
 * if it is no taller than `clearance`. Balls are 0.12, 0.2 and 0.34 m tall (SPEC v3 2.2),
 * so 0.16 lets the small one through and 0.26 the small and the medium. Unlike a gap
 * between two walls, the way through is as wide as the bar is long: no careful aim needed.
 */
export interface BeamPiece {
  type: 'beam';
  from: Vec2;
  to: Vec2;
  /** Height of the ground under the bar. Defaults to 0. */
  y?: number;
  /** Height of the gap between the ground and the underside of the bar. */
  clearance: number;
  /** How tall the bar itself is. */
  height?: number;
  thickness?: number;
  surface: string;
}

/** Round column standing on the ground: an obstacle to bounce off. */
export interface PillarPiece {
  type: 'pillar';
  at: Vec2;
  /** Height of the ground the pillar stands on. Defaults to 0. */
  y?: number;
  radius: number;
  height?: number;
  surface: string;
}

/**
 * A box that moves on a fixed schedule. Its position depends only on the physics tick,
 * so the same stroke at the same tick always meets it in the same place.
 *
 * - `platform`: the ball can roll onto its top. Set the top a few millimetres above the
 *   ground it connects and let it overlap that ground at both ends.
 * - `pusher`: an obstacle that shoves the ball. Leave more than a ball's width between
 *   it and any wall at the ends of its travel, or the ball gets crushed.
 * - `lift`: a platform that goes up and down in the ground (SPEC v6 3.4). Level with
 *   the ball it is rolled onto like any platform; standing higher than the ball, it is a
 *   wall to it. Make it tall enough that nothing can get under it at the top of its travel.
 */
export interface MoverDef {
  role: 'platform' | 'pusher' | 'lift';
  /** Width (x), height (y) and depth (z) before rotation. */
  size: Vec3;
  /** Centre of the box at the start of its cycle. */
  position: Vec3;
  /** Rotation about the vertical axis at the start of its cycle, in degrees. */
  yaw?: number;
  surface: string;
  motion: MotionDef;
  /** Ground the mover passes over. Like the top of a platform, the ball may not rest there. */
  sweep?: ZoneShape;
  /** Where to put a ball that came to rest on the mover or in its way. Defaults to where the stroke was played from. */
  rest?: readonly Vec3[];
  /**
   * Id of a time zone among the hole's works (SPEC v6 3.5). The part then keeps that
   * zone's clock in place of the hole's, and runs slower or faster as the zone does.
   */
  clock?: string;
  /** What it looks like, where a plain box will not do: a run of piano keys, the hand of a clock, a train that crosses the course. */
  look?: 'keys' | 'hand' | 'train';
  /** Makes it come and go on the hole's clock (SPEC v8 3.2). */
  phantom?: PhantomDef;
  /** A step of the world's scale it sounds as it arrives at the far end of its travel. Sound only. */
  note?: number;
}

/**
 * A moving part that comes and goes (SPEC v8 3.2): there for a share of every cycle and
 * gone for the rest. Gone, it is not a thing at all, and a ball that was on it falls.
 * It keeps the hole's clock and nothing else, so it is in no snapshot. It never comes
 * back into a ball that is in its place: it waits for the ball to have gone.
 */
export interface PhantomDef {
  /** Seconds for one cycle of being there and being gone. */
  period: number;
  /** Share of the cycle it is there, from the start of the cycle. */
  shown: number;
  /** Where in the cycle it starts, 0..1. */
  phase?: number;
  /** Seconds of warning it gives before it goes. Drawing and sound only. Defaults to 0.8. */
  warn?: number;
  /**
   * A ball may stop on it: the stroke then stays open until it goes, and the ball with
   * it. Without this a ball that stops on it is moved to `rest`, as on any moving part.
   */
  holds?: boolean;
}

/** One back-and-forth cycle: out and back, optionally pausing at either end. */
export interface CycleDef {
  /** Seconds for a full cycle. */
  period: number;
  /** Where in the cycle the mover starts, 0..1. */
  phase?: number;
  /** Share of the cycle spent waiting at the start position and at the far position. */
  hold?: readonly [number, number];
}

export type MotionDef =
  /** Slides to `position + offset` and back. */
  | ({ type: 'slide'; offset: Vec3 } & CycleDef)
  /** Turns about a vertical axis through `pivot` by `angle` degrees and back. */
  | ({ type: 'swing'; pivot: Vec2; angle: number } & CycleDef)
  /** Turns about `pivot` continuously, one revolution per period. */
  | { type: 'spin'; pivot: Vec2; period: number; phase?: number };
