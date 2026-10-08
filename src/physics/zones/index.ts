import type { Vec3 } from '../../core/types';
import type { Ball } from '../ball';
import type { PhysicsWorld } from '../world';
import type { ZoneShape } from './shape';

/**
 * Zone layer: a region that acts on the ball before every physics step.
 * Hole data references zones by `type`; behavior lives in a registered module.
 */
export interface ZoneDef {
  type: string;
  shape: ZoneShape;
  params?: Readonly<Record<string, number | string | boolean | Vec3 | readonly Vec3[] | readonly ZoneShape[]>>;
}

/**
 * Things a zone can tell the game about. Forces are applied directly to the ball instead.
 * A `cue` is a named moment (a cannon firing, say) for sound and effects to react to.
 */
export type ZoneEvent = { type: 'outOfBounds' } | { type: 'cue'; name: string };

/**
 * What a zone works with. With several balls on the course a zone is run once per ball
 * every step, each time with that ball here: a zone that remembers something about a
 * ball keeps it per ball (see `perBall`).
 */
export interface ZoneContext {
  world: PhysicsWorld;
  ball: Ball;
  emit(event: ZoneEvent): void;
  /**
   * True if the ball was resting or rolling on something at the last step, false while
   * it is in the air. It is the round's own judgement, the one that decides rolling
   * resistance, so a zone that cares about the air agrees with everything else (SPEC v5 4.1).
   */
  grounded(): boolean;
  /** Call every step while the zone is holding the ball, so it is not judged as stopped. */
  busy(): void;
  /** Call on a step where the zone put the ball somewhere else by hand, so the jump is not drawn as motion. */
  snap(): void;
  /** Adds seconds to the hole's countdown. Does nothing on a hole without one. */
  addTime(seconds: number): void;
  /** Makes the ball one size bigger (+1) or smaller (-1). False if it has no further to go. */
  resize(step: 1 | -1): boolean;
  /**
   * Splits the ball in two, the halves heading `degrees` to either side of where it was
   * going. Returns the new ball, or null once the hole has as many balls as it allows.
   */
  split(degrees: number): Ball | null;
}

/** Storage for what a zone remembers about each ball. It goes when the ball does. */
export function perBall<T>(initial: () => T): (ball: Ball) => T {
  const memory = new WeakMap<Ball, T>();
  return (ball) => {
    let value = memory.get(ball);
    if (value === undefined) memory.set(ball, (value = initial()));
    return value;
  };
}

/** Reads a number from a zone's params. */
export function numberParam(def: ZoneDef, name: string, fallback?: number): number {
  const value = def.params?.[name];
  if (typeof value === 'number') return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Zone "${def.type}" needs a number "${name}"`);
}

/** Reads a vector from a zone's params. */
export function vectorParam(def: ZoneDef, name: string): Vec3 {
  const value = def.params?.[name];
  if (Array.isArray(value) && value.length === 3) return value as unknown as Vec3;
  throw new Error(`Zone "${def.type}" needs a vector "${name}"`);
}

export interface Zone {
  preStep(ctx: ZoneContext): void;
  /** True once a single-use zone has been used up, for its view to show. */
  readonly spent?: boolean;
}

/** Reads a list of vectors from a zone's params. */
export function vectorsParam(def: ZoneDef, name: string): readonly Vec3[] {
  const value = def.params?.[name];
  if (Array.isArray(value) && value.every((item) => Array.isArray(item) && item.length === 3)) {
    return value as unknown as readonly Vec3[];
  }
  throw new Error(`Zone "${def.type}" needs a list of vectors "${name}"`);
}

/** Reads a list of shapes from a zone's params. An absent one is an empty list. */
export function shapesParam(def: ZoneDef, name: string): readonly ZoneShape[] {
  const value = def.params?.[name];
  if (value === undefined) return [];
  if (Array.isArray(value) && value.every((item) => typeof item === 'object' && item !== null && 'kind' in item)) {
    return value as unknown as readonly ZoneShape[];
  }
  throw new Error(`Zone "${def.type}" needs a list of shapes "${name}"`);
}

export type ZoneFactory = (def: ZoneDef) => Zone;

const registry = new Map<string, ZoneFactory>();

export function registerZone(type: string, factory: ZoneFactory): void {
  registry.set(type, factory);
}

export function createZone(def: ZoneDef): Zone {
  const factory = registry.get(def.type);
  if (!factory) throw new Error(`Unknown zone type "${def.type}"`);
  return factory(def);
}
