import { RAPIER } from '../physics/rapier';
import { getSurface, type SurfaceMap } from '../physics/surfaces';
import type { PhysicsWorld } from '../physics/world';
import type { CompiledBody, CompiledHole } from './compile';

/**
 * The solid under each ground piece stops short of the playing surface by this much.
 * The ball rolls on the ground mesh alone; if the solids reached the surface, the
 * seams between them would deflect it.
 */
const BODY_TOP_GAP = 0.05;

/**
 * How much the ground grips loose objects (crates, pins). The ball never feels it: its
 * own friction is zero and its combine rule takes the smaller value.
 */
const GROUND_GRIP = 1;

/**
 * Creates the static colliders of a hole. For the ball everything is frictionless; see
 * physics/ball.ts.
 *
 * The ground is one mesh carrying many surfaces, so it cannot hold per-surface
 * restitution itself. Instead the ball carries the value of the surface under it
 * (physics/surfaces.ts) and the combine rules are arranged so that:
 *   ball vs ground: the ball's value is used as-is;
 *   ball vs wall:   max(ball, wall), i.e. the wall's own value, walls being bouncier
 *                   than any ground.
 */
export function buildHolePhysics(compiled: CompiledHole, world: PhysicsWorld, surfaces: SurfaceMap): void {
  const { ground, bodies, boxes, cylinders } = compiled;
  const passThrough = (desc: RAPIER.ColliderDesc) =>
    desc.setFriction(GROUND_GRIP).setRestitution(0).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max);

  if (ground) {
    const collider = world.raw.createCollider(
      passThrough(
        RAPIER.ColliderDesc.trimesh(ground.vertices, ground.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES),
      ),
    );
    surfaces.setResolver(collider.handle, 'ground', ground.surfaceAt);
  }
  for (const body of bodies) {
    const collider = world.raw.createCollider(passThrough(bodyShape(body)));
    surfaces.setCollider(collider.handle, 'ground', body.surface);
  }
  const wall = (desc: RAPIER.ColliderDesc, surfaceId: string) => {
    const collider = world.raw.createCollider(
      desc
        .setFriction(0)
        .setRestitution(getSurface(surfaceId).restitution)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
    );
    surfaces.setCollider(collider.handle, 'wall', surfaceId);
  };
  for (const box of boxes) {
    const [x, y, z, w] = box.rotation;
    wall(
      RAPIER.ColliderDesc.cuboid(box.halfExtents[0], box.halfExtents[1], box.halfExtents[2])
        .setTranslation(box.center[0], box.center[1], box.center[2])
        .setRotation({ x, y, z, w }),
      box.surface,
    );
  }
  for (const c of cylinders) {
    wall(
      RAPIER.ColliderDesc.cylinder(c.halfHeight, c.radius).setTranslation(c.center[0], c.center[1], c.center[2]),
      c.surface,
    );
  }
}

function bodyShape(body: CompiledBody): RAPIER.ColliderDesc {
  const points: number[] = [];
  for (const [x, y, z] of body.top) points.push(x, y - BODY_TOP_GAP, z, x, body.bottomY, z);
  const shape = RAPIER.ColliderDesc.convexHull(new Float32Array(points));
  if (!shape) throw new Error(`Could not build a solid for ground piece ${JSON.stringify(body)}`);
  return shape;
}
