import type { CompiledBox, CompiledHole } from '../../level/compile';
import type { HoleDef, MoverDef } from '../../level/schema';

/** A rectangle on the ground, in X and Z. */
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Metres of the game to one unit of the design. The design's courses are about two
 * units wide, the game's about four: scaled by this the props stand to a course as they
 * do in the pictures.
 */
export const SCALE = 2;

export const emptyRect = (): Rect => ({ minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });

/** Grows `rect` to take in the point, or the circle of `radius` round it. */
export function include(rect: Rect, x: number, z: number, radius = 0): Rect {
  rect.minX = Math.min(rect.minX, x - radius);
  rect.maxX = Math.max(rect.maxX, x + radius);
  rect.minZ = Math.min(rect.minZ, z - radius);
  rect.maxZ = Math.max(rect.maxZ, z + radius);
  return rect;
}

export const centreOf = (rect: Rect): { x: number; z: number } => ({ x: (rect.minX + rect.maxX) / 2, z: (rect.minZ + rect.maxZ) / 2 });

/** One axis of `mapPoint`. */
function mapAxis(from0: number, from1: number, to0: number, to1: number, v: number): number {
  if (v < from0) return to0 - (from0 - v) * SCALE;
  if (v > from1) return to1 + (v - from1) * SCALE;
  return from1 > from0 ? to0 + ((v - from0) / (from1 - from0)) * (to1 - to0) : (to0 + to1) / 2;
}

/**
 * Where a point of a design scene goes round a real hole. The design composed each
 * scene round one short, straight course (`lane`); a hole is bigger and of any shape
 * (`site`, the rectangle round it). Each side of the lane maps to the same side of the
 * site: what stood one unit beyond the lane's left edge stands SCALE metres beyond the
 * site's, and keeps its share of the way along that edge. Like a picture frame cut in
 * nine and stretched: the corners keep their size, the edges and the middle stretch.
 */
export function mapPoint(lane: Rect, site: Rect, x: number, z: number): { x: number; z: number } {
  return {
    x: mapAxis(lane.minX, lane.maxX, site.minX, site.maxX, x),
    z: mapAxis(lane.minZ, lane.maxZ, site.minZ, site.maxZ, z),
  };
}

/** The ground a block of the course covers, turned as it is, added to `rect`. */
export function boxReach(rect: Rect, box: CompiledBox): Rect {
  const [qx, qy, qz, qw] = box.rotation;
  const [hx, , hz] = box.halfExtents;
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    // The corner (sx·hx, 0, sz·hz) turned by the box's rotation.
    const x = sx * hx;
    const z = sz * hz;
    const tx = 2 * (qy * z);
    const ty = 2 * (qz * x - qx * z);
    const tz = 2 * (-qy * x);
    include(rect, box.center[0] + x + qw * tx + (qy * tz - qz * ty), box.center[2] + z + qw * tz + (qx * ty - qy * tx));
  }
  return rect;
}

/** The ground a moving part can reach in its cycle, added to `rect`. */
export function moverReach(rect: Rect, mover: MoverDef): Rect {
  const [x, , z] = mover.position;
  const half = Math.hypot(mover.size[0], mover.size[2]) / 2;
  const { motion } = mover;
  include(rect, x, z, half);
  if (motion.type === 'slide') {
    include(rect, x + motion.offset[0], z + motion.offset[2], half);
  } else {
    // A turn about a pivot sweeps a circle round it.
    const [px, pz] = motion.pivot;
    include(rect, px, pz, Math.hypot(x - px, z - pz) + half);
  }
  return rect;
}

/**
 * The rectangle a hole is played in: every floor, wall and post, every moving part at
 * either end of its travel, and anything the camera is told to keep in view. Scenery
 * stays outside it.
 */
export function siteOf(compiled: CompiledHole, hole: HoleDef): Rect {
  const rect = emptyRect();
  for (const body of compiled.bodies) for (const [x, , z] of body.top) include(rect, x, z);
  for (const box of compiled.boxes) boxReach(rect, box);
  for (const cylinder of compiled.cylinders) include(rect, cylinder.center[0], cylinder.center[2], cylinder.radius);
  for (const mover of hole.movers ?? []) moverReach(rect, mover);
  for (const [x, , z] of hole.camera?.keep ?? []) include(rect, x, z);
  if (!Number.isFinite(rect.minX)) include(rect, hole.tee[0], hole.tee[2], 2);
  return rect;
}

/**
 * The height of the scenery's ground under a hole: just above where a falling ball is
 * out of bounds (one metre down on most holes), so that a ball goes out as it lands, as
 * it did on the sea that was there before; under the lowest block of a hole that goes
 * deeper than that; and as deep as the design's own ground lies, where its course is up
 * on a table or a cliff (`designed`).
 */
export function groundUnder(compiled: CompiledHole, designed: number): number {
  const lowest = Math.min(...compiled.bodies.map((body) => body.bottomY));
  if (!Number.isFinite(lowest)) return Math.min(-0.9, designed);
  // A city's blocks stand on the street, which is the ground.
  if (lowest >= 0) return lowest;
  return Math.min(-0.9, lowest - 0.05, designed);
}

/**
 * Heights in the design to heights round the hole. The design's course and the hole's
 * line up (`top` and `level`): what is above it stands as far above, SCALE times; what
 * is between the design's ground and its course is stretched to fit between the
 * scenery's ground and the hole's, so that what stood on the ground still does.
 */
export function heightMap(ground: number, top: number, floor: number, level: number): (y: number) => number {
  const below = top > ground ? (level - floor) / (top - ground) : SCALE;
  return (y) => (y >= top ? level + (y - top) * SCALE : floor + (y - ground) * below);
}
