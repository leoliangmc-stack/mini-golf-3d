import type { XYZ } from '../core/types';
import type { HoleDef } from '../level/schema';
import { hallOf } from '../physics/zones/wrap';

/** How far outside a hall a ball may be and the hall still be kept in view: the ground it crosses on. */
const HALL_MARGIN = 0.7;

/**
 * Points for the camera to keep in view besides the ball and the goal: those the hole
 * names, and the corners of a hall with joined edges while the ball is in it (SPEC v8
 * 3.3). With its corners in view the picture of a hall does not move when the ball
 * goes out of one side and comes in by the other.
 */
export function framingPoints(hole: HoleDef, ball: XYZ, into: XYZ[] = []): XYZ[] {
  for (const [x, y, z] of hole.camera?.keep ?? []) into.push({ x, y, z });
  for (const zone of hole.zones) {
    if (zone.type !== 'wrap') continue;
    const { min, max, y } = hallOf(zone);
    const inside =
      ball.x >= min[0] - HALL_MARGIN && ball.x <= max[0] + HALL_MARGIN && ball.z >= min[1] - HALL_MARGIN && ball.z <= max[1] + HALL_MARGIN;
    if (!inside) continue;
    into.push({ x: min[0], y, z: min[1] }, { x: min[0], y, z: max[1] }, { x: max[0], y, z: min[1] }, { x: max[0], y, z: max[1] });
  }
  return into;
}
