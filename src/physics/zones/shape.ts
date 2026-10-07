import type { Vec3, XYZ } from '../../core/types';

export type ZoneShape =
  | { kind: 'box'; center: Vec3; halfExtents: Vec3 }
  | { kind: 'sphere'; center: Vec3; radius: number };

export function shapeContains(shape: ZoneShape, p: XYZ): boolean {
  const [cx, cy, cz] = shape.center;
  if (shape.kind === 'sphere') {
    return Math.hypot(p.x - cx, p.y - cy, p.z - cz) <= shape.radius;
  }
  const [hx, hy, hz] = shape.halfExtents;
  return Math.abs(p.x - cx) <= hx && Math.abs(p.y - cy) <= hy && Math.abs(p.z - cz) <= hz;
}
