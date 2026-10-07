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
  params?: Readonly<Record<string, number | string | boolean | Vec3>>;
}

/**
 * Things a zone can tell the game about. Forces are applied directly to the ball instead.
 * A `cue` is a named moment (a cannon firing, say) for sound and effects to react to.
 */
export type ZoneEvent = { type: 'outOfBounds' } | { type: 'cue'; name: string };

export interface ZoneContext {
  world: PhysicsWorld;
  ball: Ball;
  emit(event: ZoneEvent): void;
  /** Call every step while the zone is holding the ball, so it is not judged as stopped. */
  busy(): void;
  /** Call on a step where the zone put the ball somewhere else by hand, so the jump is not drawn as motion. */
  snap(): void;
  /** Adds seconds to the hole's countdown. Does nothing on a hole without one. */
  addTime(seconds: number): void;
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
