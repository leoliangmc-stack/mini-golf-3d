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
