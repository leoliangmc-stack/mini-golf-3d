import type { I18nText, Vec2, Vec3 } from '../core/types';
import type { ZoneDef } from '../physics/zones';
import type { ZoneShape } from '../physics/zones/shape';

/**
 * World and hole data format. Every hole in the game is an instance of this; adding
 * a hole must never require touching engine code.
 *
 * `decor` from SPEC 2.12 is not here yet: nothing needs it until real models are added.
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
  cup: CupDef;
  pieces: readonly PieceDef[];
  zones: readonly ZoneDef[];
  /** Moving parts. They keep moving while the player aims. */
  movers?: readonly MoverDef[];
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
}

/** Per-hole camera settings; anything left out uses the default. Angles in degrees. */
export interface CameraOverride {
  pitch?: number;
  yaw?: number;
  minDistance?: number;
  maxDistance?: number;
}

export interface CupDef {
  /** Point on the ground at the center of the cup. */
  position: Vec3;
  radius: number;
  /** The ball drops in only when moving slower than this, in m/s. */
  captureSpeed: number;
}

export type PieceDef = FloorPiece | RampPiece | WallPiece | PillarPiece;

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
 */
export interface MoverDef {
  role: 'platform' | 'pusher';
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
