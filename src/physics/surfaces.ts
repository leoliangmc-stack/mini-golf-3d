import { FIXED_DT } from '../core/loop';
import type { XYZ } from '../core/types';
import { dot } from '../core/types';
import type { Ball } from './ball';
import { RAPIER } from './rapier';
import type { PhysicsWorld } from './world';

/**
 * Surface layer: what a piece of ground does to a ball touching it.
 *
 * Rolling is modelled directly rather than through solver friction: a surface is
 * "slippery" or "sticky" purely through the two rolling terms below.
 */
export interface SurfaceDef {
  restitution: number;
  /** Constant deceleration while rolling, in m/s^2. Makes the ball stop in finite time. */
  rollingResistance: number;
  /** Speed-proportional deceleration while rolling, in 1/s. Shortens fast shots. */
  drag: number;
  /** Default display color. Themes may override it later. */
  color: number;
}

const registry = new Map<string, SurfaceDef>();

export function registerSurface(id: string, def: SurfaceDef): void {
  registry.set(id, def);
}

export function getSurface(id: string): SurfaceDef {
  const def = registry.get(id);
  if (!def) throw new Error(`Unknown surface "${id}"`);
  return def;
}

export type SurfaceResolver = (point: XYZ) => string | null;

/** Moving ground: reports how fast a point on it is travelling. */
export interface GroundCarrier {
  pointVelocity(point: XYZ): XYZ;
}

/** What a collider is to the game: something to roll on, to bounce off, or a moving part. */
export type ColliderKind = 'ground' | 'wall' | 'mover';

/**
 * What the game knows about each collider: its kind and its surface. A collider
 * carrying several surfaces registers a resolver that picks one from the contact point
 * (Rapier ray hits do not report which triangle of a mesh was hit).
 */
export class SurfaceMap {
  private readonly kinds = new Map<number, ColliderKind>();
  private readonly whole = new Map<number, string>();
  private readonly resolvers = new Map<number, SurfaceResolver>();
  private readonly carriers = new Map<number, GroundCarrier>();

  setCollider(handle: number, kind: ColliderKind, surfaceId: string): void {
    this.kinds.set(handle, kind);
    this.whole.set(handle, surfaceId);
  }

  setResolver(handle: number, kind: ColliderKind, resolver: SurfaceResolver): void {
    this.kinds.set(handle, kind);
    this.resolvers.set(handle, resolver);
  }

  /** Registers a moving collider, so a ball on it is treated as moving with it. */
  setCarrier(handle: number, carrier: GroundCarrier): void {
    this.carriers.set(handle, carrier);
  }

  carrierOf(handle: number): GroundCarrier | null {
    return this.carriers.get(handle) ?? null;
  }

  kindOf(handle: number): ColliderKind | null {
    return this.kinds.get(handle) ?? null;
  }

  lookup(handle: number, point: XYZ): string | null {
    const resolver = this.resolvers.get(handle);
    return resolver ? resolver(point) : (this.whole.get(handle) ?? null);
  }
}

export interface GroundProbe {
  surfaceId: string;
  surface: SurfaceDef;
  normal: XYZ;
  /** True when the ball is resting or rolling on the surface, false when it is just above it. */
  grounded: boolean;
  /** Velocity of the ground under the ball: zero unless it is a moving part. */
  velocity: XYZ;
  /** The moving part the ball is over, if any. */
  carrier: GroundCarrier | null;
}

const STILL: XYZ = { x: 0, y: 0, z: 0 };

const GROUND_EPS = 0.02;
/** Surfaces steeper than this relative to gravity do not count as ground. */
const MIN_GROUND_COS = 0.2;

/**
 * Finds the surface under the ball along the current gravity direction. Looks slightly
 * ahead of a falling ball so its material is already set on the step it lands.
 */
export function probeGround(world: PhysicsWorld, ball: Ball, map: SurfaceMap): GroundProbe | null {
  const up = world.up;
  const r = ball.props.radius;
  // Generous enough to still reach the floor when a gravity zone tilts "down" sideways.
  const reach = 2.5 * r + 2 * ball.speed() * FIXED_DT;
  const origin = ball.position();
  const ray = new RAPIER.Ray(origin, { x: -up.x, y: -up.y, z: -up.z });
  const hit = world.raw.castRayAndGetNormal(ray, reach, true, undefined, undefined, ball.collider);
  if (!hit) return null;
  const t = hit.timeOfImpact;
  const point = { x: origin.x - up.x * t, y: origin.y - up.y * t, z: origin.z - up.z * t };
  const surfaceId = map.lookup(hit.collider.handle, point);
  if (surfaceId === null) return null;
  const cos = dot(hit.normal, up);
  const gap = t * cos - r;
  const carrier = map.carrierOf(hit.collider.handle);
  return {
    surfaceId,
    surface: getSurface(surfaceId),
    normal: hit.normal,
    grounded: cos > MIN_GROUND_COS && gap <= GROUND_EPS,
    velocity: carrier ? carrier.pointVelocity(point) : STILL,
    carrier,
  };
}

/** Applies the probed surface to the ball. Call once per physics step, before stepping. */
export function applySurface(ball: Ball, probe: GroundProbe | null): void {
  if (!probe) return;
  const s = probe.surface;
  ball.collider.setRestitution(s.restitution * ball.props.bounciness);
  if (!probe.grounded) return;

  // Slow the part of the velocity that lies along the surface, measured against the
  // ground itself: a ball on a moving platform is gradually carried along with it.
  const n = probe.normal;
  const g = probe.velocity;
  const v = ball.velocity();
  const rel = { x: v.x - g.x, y: v.y - g.y, z: v.z - g.z };
  const vn = dot(rel, n);
  const t = { x: rel.x - n.x * vn, y: rel.y - n.y * vn, z: rel.z - n.z * vn };
  const speed = Math.hypot(t.x, t.y, t.z);
  if (speed < 1e-9) return;
  const k = Math.max(0, speed * (1 - s.drag * FIXED_DT) - s.rollingResistance * FIXED_DT) / speed;
  ball.body.setLinvel(
    { x: g.x + t.x * k + n.x * vn, y: g.y + t.y * k + n.y * vn, z: g.z + t.z * k + n.z * vn },
    true,
  );
}
