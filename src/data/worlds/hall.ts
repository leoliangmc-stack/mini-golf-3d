import type { Vec2 } from '../../core/types';
import type { DecorDef, PieceDef, WorldDef } from '../../level/schema';
import { hall, WRAP_SKIRT } from '../../physics/zones/wrap';
import { CUP, FALL } from './common';

const FLOOR = 'hallFloor';
const WALL = 'hallWall';
/**
 * How far the pale ground goes on beyond a joined edge. A ball needs only a fraction
 * of it (physics/zones/wrap.ts); the rest is somewhere for the picture of the other
 * side to lie.
 */
export const SKIRT = WRAP_SKIRT;

/**
 * The ground of a hall (SPEC v8 3.3): its floor, a skirt of pale ground beyond each
 * joined edge, and a wall along each edge that is not joined. A wall that meets a
 * joined edge runs on across the skirt, as every wall inside the hall must that does:
 * what a ball meets just before the line has to be there just after it.
 */
export function hallGround(min: Vec2, max: Vec2, joined: { x?: boolean; z?: boolean }, floor = FLOOR, wall = WALL): PieceDef[] {
  const sx = joined.x ? SKIRT : 0;
  const sz = joined.z ? SKIRT : 0;
  const pieces: PieceDef[] = [{ type: 'floor', min, max, surface: floor }];
  if (joined.x) {
    pieces.push(
      { type: 'floor', min: [min[0] - sx, min[1] - sz], max: [min[0], max[1] + sz], surface: 'beyond' },
      { type: 'floor', min: [max[0], min[1] - sz], max: [max[0] + sx, max[1] + sz], surface: 'beyond' },
    );
  } else {
    pieces.push(
      { type: 'wall', from: [min[0], min[1] - sz], to: [min[0], max[1] + sz], surface: wall },
      { type: 'wall', from: [max[0], min[1] - sz], to: [max[0], max[1] + sz], surface: wall },
    );
  }
  if (joined.z) {
    pieces.push(
      { type: 'floor', min: [min[0], min[1] - sz], max: [max[0], min[1]], surface: 'beyond' },
      { type: 'floor', min: [min[0], max[1]], max: [max[0], max[1] + sz], surface: 'beyond' },
    );
  } else {
    pieces.push(
      { type: 'wall', from: [min[0] - sx, min[1]], to: [max[0] + sx, min[1]], surface: wall },
      { type: 'wall', from: [min[0] - sx, max[1]], to: [max[0] + sx, max[1]], surface: wall },
    );
  }
  return pieces;
}

/** Columns standing in the haze round the hall. */
const DEEP = -3.6;
const pillar = (x: number, z: number, height = 3.2): DecorDef => ({ type: 'column', at: [x, DEEP, z], size: [0.5, height, 0], color: 0xcdbf9f });

/**
 * World 32: a hall whose edges are joined (SPEC v8 3.3). A bright line on the ground is
 * an edge that leads to the one across from it: out of one, in by the other, as fast
 * and as far along as the ball went out. Beyond each line lies a pale picture of what
 * is on the other side.
 */
export const HALL_WORLD: WorldDef = {
  id: 'hall',
  name: { en: 'Endless Hall', zh: '无尽回廊' },
  theme: 'endless',
  ruleCard: {
    en: 'Leave one side, come back on the other.',
    zh: '从一边出去，会从另一边回来。',
  },
  ruleTag: { en: 'JOINED EDGES', zh: '边界相通' },
  holes: [
    // 1. Teaching: a wall from end to end between the ball and the cup. The left edge
    //    and the right are one: the pale flag beyond the left line is the cup.
    {
      id: 'hall-1',
      par: 2,
      tee: [-2.5, 0, 1.5],
      goal: { type: 'cup', position: [3.5, 0, -1.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: [
        ...hallGround([-5, -3.5], [5, 3.5], { x: true }),
        { type: 'wall', from: [0, -3.5], to: [0, 3.5], surface: WALL },
      ],
      decor: [pillar(-9.5, -6), pillar(9.5, -6), pillar(-9.5, 5, 2.4), pillar(9.5, 5, 2.4)],
      zones: [FALL, hall([-5, -3.5], [5, 3.5], { x: true })],
      outOfBounds: 'lastPosition',
      camera: { pitch: 60 },
    },

    // 2. Variation: joined all round, and four rooms with no door between them. The cup
    //    is in the room cornerwise across: two edges away by either road, or one stroke
    //    through the very corner.
    {
      id: 'hall-2',
      par: 3,
      tee: [-3, 0, 3],
      goal: { type: 'cup', position: [3, 0, -3], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: [
        ...hallGround([-5, -5], [5, 5], { x: true, z: true }),
        { type: 'wall', from: [0, -5 - SKIRT], to: [0, 5 + SKIRT], surface: WALL },
        { type: 'wall', from: [-5 - SKIRT, 0], to: [5 + SKIRT, 0], surface: WALL },
      ],
      decor: [pillar(-10.5, -10), pillar(10.5, -10), pillar(-10.5, 10, 2.4), pillar(10.5, 10, 2.4)],
      zones: [FALL, hall([-5, -5], [5, 5], { x: true, z: true })],
      outOfBounds: 'lastPosition',
      camera: { pitch: 62, maxDistance: 34 },
    },

    // 3. Challenge: the cup is penned in, and its pen opens only onto the right-hand
    //    edge. That edge is reached from the left, the left from the far strip, and the
    //    far strip from the near edge: out by the near edge first, then out by the left.
    {
      id: 'hall-3',
      par: 3,
      tee: [2, 0, 3],
      goal: { type: 'cup', position: [2.5, 0, -1.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        ...hallGround([-5, -5], [5, 5], { x: true, z: true }),
        // The wall across the middle, from edge to edge and on over both
        { type: 'wall', from: [-5 - SKIRT, 0], to: [5 + SKIRT, 0], surface: WALL },
        // The pen: its west side, and its north side, which runs on over the right-hand
        // edge and so comes in again a little way at the left
        { type: 'wall', from: [0, -3.5], to: [0, 0], surface: WALL },
        { type: 'wall', from: [0, -3.5], to: [5 + SKIRT, -3.5], surface: WALL },
        { type: 'wall', from: [-5 - SKIRT, -3.5], to: [-4.4, -3.5], surface: WALL },
      ],
      decor: [pillar(-10.5, -10), pillar(10.5, -10), pillar(-10.5, 10, 2.4), pillar(10.5, 10, 2.4)],
      zones: [FALL, hall([-5, -5], [5, 5], { x: true, z: true })],
      outOfBounds: 'lastPosition',
      camera: { pitch: 62, maxDistance: 34 },
    },
  ],
};
