import type { Vec2 } from '../../core/types';
import type { PieceDef } from '../../level/schema';

/**
 * A straight wall from `from` to `to` with doorways cut in it. Each doorway is given as
 * the distances along the wall where it starts and ends. A gate goes in a doorway; the
 * wall ends overlap it by half their thickness, so nothing shows through at the jambs.
 */
export function wallWithDoors(
  from: Vec2,
  to: Vec2,
  doors: readonly (readonly [number, number])[],
  surface: string,
  extra: { y?: number; height?: number; thickness?: number } = {},
): PieceDef[] {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.sqrt(dx * dx + dz * dz);
  const at = (d: number): Vec2 => [from[0] + (dx * d) / length, from[1] + (dz * d) / length];
  const pieces: PieceDef[] = [];
  let start = 0;
  for (const [open, shut] of [...doors].sort((a, b) => a[0] - b[0])) {
    if (open - start > 1e-6) pieces.push({ type: 'wall', from: at(start), to: at(open), surface, ...extra });
    start = shut;
  }
  if (length - start > 1e-6) pieces.push({ type: 'wall', from: at(start), to: at(length), surface, ...extra });
  return pieces;
}

/** The two ends of a doorway cut by `wallWithDoors`, for the gate that stands in it. */
export function doorway(from: Vec2, to: Vec2, door: readonly [number, number]): { from: Vec2; to: Vec2 } {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.sqrt(dx * dx + dz * dz);
  const at = (d: number): Vec2 => [from[0] + (dx * d) / length, from[1] + (dz * d) / length];
  return { from: at(door[0]), to: at(door[1]) };
}
