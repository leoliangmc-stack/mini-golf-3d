import { cos, sin } from '../../core/math';
import type { PieceDef, PinDef } from '../../level/schema';
import type { ZoneDef } from '../../physics/zones';

/** Anything that drops below the course is out of bounds. */
export const FALL: ZoneDef = {
  type: 'outOfBounds',
  shape: { kind: 'box', center: [0, -6, 0], halfExtents: [80, 5, 80] },
};

/** Standard cup size and capture speed. */
export const CUP = { radius: 0.22, captureSpeed: 3.5 };

/** For worlds whose ground level is the street: anything that comes down to it is out of bounds. */
export const STREET: ZoneDef = {
  type: 'outOfBounds',
  shape: { kind: 'box', center: [0, -2, 0], halfExtents: [80, 2.6, 80] },
};

/** A walled rectangle of ground. */
export function walledRoom(
  [minX, minZ]: readonly [number, number],
  [maxX, maxZ]: readonly [number, number],
  floor: string,
  wall: string,
): PieceDef[] {
  return [
    { type: 'floor', min: [minX, minZ], max: [maxX, maxZ], surface: floor },
    { type: 'wall', from: [minX, maxZ], to: [maxX, maxZ], surface: wall },
    { type: 'wall', from: [maxX, maxZ], to: [maxX, minZ], surface: wall },
    { type: 'wall', from: [maxX, minZ], to: [minX, minZ], surface: wall },
    { type: 'wall', from: [minX, minZ], to: [minX, maxZ], surface: wall },
  ];
}

/**
 * Pins in the classic triangle (SPEC v3 2.5). `at` is where the head pin stands and
 * `heading` the compass direction it faces, the way a ball should come from: 0 is -Z,
 * 90 is +X, 180 is +Z. The rows fan out behind it, `gap` metres apart.
 */
export function rack(at: readonly [number, number, number], rows: number, heading = 180, gap = 0.3): PinDef[] {
  const a = (heading * Math.PI) / 180;
  // Unit vectors: back, away from where the ball comes from, and across.
  const back = { x: -sin(a), z: cos(a) };
  const across = { x: cos(a), z: sin(a) };
  const pins: PinDef[] = [];
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i <= row; i++) {
      const b = row * gap * 0.866;
      const s = (i - row / 2) * gap;
      pins.push({ at: [at[0] + back.x * b + across.x * s, at[1], at[2] + back.z * b + across.z * s] });
    }
  }
  return pins;
}
