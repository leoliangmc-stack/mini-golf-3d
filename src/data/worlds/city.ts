import type { Vec2 } from '../../core/types';
import type { DecorDef, PieceDef, WorldDef } from '../../level/schema';
import { CUP, STREET } from './common';

/**
 * A building whose roof is part of the course: the roof at height `y`, solid all the
 * way down to the street at 0, with windows on its sides.
 */
function building(min: Vec2, max: Vec2, y: number, surface = 'rooftop'): { roof: PieceDef; lights: DecorDef } {
  return {
    roof: { type: 'floor', min, max, y, depth: y, surface },
    lights: {
      type: 'windows',
      at: [(min[0] + max[0]) / 2, 0, (min[1] + max[1]) / 2],
      size: [max[0] - min[0], y, max[1] - min[1]],
    },
  };
}

/** A low wall along the edge of a roof at height `y`. */
const parapet = (from: Vec2, to: Vec2, y: number, height?: number): PieceDef => ({
  type: 'wall',
  from,
  to,
  y,
  height,
  surface: 'parapet',
});

/** A rooftop air conditioner: a squat box to steer around. */
const acUnit = (x: number, z: number, y: number): PieceDef => ({
  type: 'wall',
  from: [x - 0.45, z],
  to: [x + 0.45, z],
  y,
  height: 0.55,
  thickness: 0.7,
  surface: 'duct',
});

const vent = (x: number, z: number, y: number): PieceDef => ({
  type: 'pillar',
  at: [x, z],
  y,
  radius: 0.3,
  height: 0.8,
  surface: 'duct',
});

/** Buildings that are only scenery, standing on the street around the course. */
const towers = (...spots: [x: number, z: number, width: number, height: number, depth: number, color?: number][]): DecorDef[] =>
  spots.map(([x, z, width, height, depth, color]) => ({ type: 'tower', at: [x, 0, z], size: [width, height, depth], color }));

// Hole 1
const high1 = building([-3, 1], [3, 8], 4, 'tar');
const low1 = building([-4, -10], [4, 1], 2);
// Hole 2
const top2 = building([1, 1], [6, 8], 6, 'tar');
const middle2 = building([-5, -8], [6, -3], 4, 'terracotta');
const bottom2 = building([-5, -3], [1, 8], 2);
// Hole 3
const b3 = [
  building([-2, 5], [2, 10], 8, 'tar'),
  building([-2, -1], [3, 4], 6),
  building([4, -2], [9, 3], 4, 'terracotta'),
  building([4, -9], [9, -3], 2),
];

/**
 * World 8: rooftops at different heights. Dropping onto a lower roof costs nothing:
 * the ball lands and you play on, and sometimes the drop is the short way round. Only
 * the street is out of bounds. Compare with Sky Island, where every fall is a penalty.
 */
export const CITY_WORLD: WorldDef = {
  id: 'city',
  name: { en: 'Rooftop City', zh: '城市屋顶' },
  theme: 'rooftop',
  ruleCard: {
    en: "Falling to a lower roof is fine — just don't hit the street.",
    zh: '掉到下层屋顶没关系，别掉到街上。',
  },
  ruleTag: { en: 'ROOFTOPS', zh: '多层屋顶' },
  holes: [
    // 1. Teaching: two roofs. The cup is on the lower one, and the only way there is off
    //    the edge. The lower roof is walled all round, so nothing can go wrong.
    {
      id: 'city-1',
      par: 2,
      tee: [0, 4, 6.5],
      goal: { type: 'cup', position: [0, 2, -6.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: [
        high1.roof,
        low1.roof,
        parapet([-3, 8], [3, 8], 4),
        parapet([-3, 1], [-3, 8], 4),
        parapet([3, 1], [3, 8], 4),
        parapet([-4, -10], [4, -10], 2, 0.6),
        parapet([-4, 1], [-4, -10], 2),
        parapet([4, 1], [4, -10], 2),
        parapet([-4, 1], [-3, 1], 2),
        parapet([3, 1], [4, 1], 2),
        acUnit(-2.2, -3, 2),
        vent(2.3, -4.5, 2),
      ],
      decor: [
        high1.lights,
        low1.lights,
        ...towers([-10, -3, 5, 7, 7, 0x6c7f94], [10.5, 2, 5, 5, 6, 0x8a7f74], [10, -9, 4, 9, 5, 0x66788c], [-9, -15, 6, 6, 5, 0x857a8c], [2, -17.5, 7, 7, 4, 0x70828f]),
        { type: 'waterTank', at: [-10, 7, -4] },
        { type: 'antenna', at: [10, 9, -9] },
      ],
      zones: [STREET],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: three roofs. The safe way is the ramp down to the middle roof, then
    //    off its edge to the bottom one. The quick way is straight off the side of the
    //    top roof, four metres down, onto a roof with no wall on its far side.
    {
      id: 'city-2',
      par: 3,
      tee: [3.5, 6, 6.5],
      goal: { type: 'cup', position: [-2.5, 2, -0.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        top2.roof,
        { type: 'ramp', min: [2, -3], max: [5, 1], along: 'z', yFrom: 4, yTo: 6, depth: 4, surface: 'tar' },
        middle2.roof,
        bottom2.roof,
        // Top roof: open on the left, toward the bottom roof.
        parapet([1, 8], [6, 8], 6),
        parapet([6, 1], [6, 8], 6),
        parapet([1, 1], [2, 1], 6),
        parapet([5, 1], [6, 1], 6),
        // Ramp
        { type: 'wall', from: [2, -3], to: [2, 1], y: [4, 6], surface: 'parapet' },
        { type: 'wall', from: [5, -3], to: [5, 1], y: [4, 6], surface: 'parapet' },
        // Middle roof: open toward the bottom roof.
        parapet([-5, -8], [6, -8], 4, 0.7),
        parapet([-5, -8], [-5, -3], 4),
        parapet([6, -8], [6, -3], 4),
        parapet([1, -3], [2, -3], 4),
        parapet([5, -3], [6, -3], 4),
        // Bottom roof: walled in front, open on the far left.
        parapet([-5, 8], [1, 8], 2),
        parapet([-5, -3], [-5, 2], 2),
        vent(-0.8, 3.5, 2),
      ],
      decor: [
        top2.lights,
        middle2.lights,
        bottom2.lights,
        ...towers([-12, 2, 5, 6, 8, 0x8a7f74], [12, 3, 5, 9, 6, 0x66788c], [12.5, -7, 5, 7, 6, 0x857a8c], [-3, -15, 8, 8, 5, 0x6c7f94], [7.5, -15, 5, 10, 5, 0x70828f]),
        { type: 'antenna', at: [12, 9, 3] },
        { type: 'waterTank', at: [-3, 8, -15] },
      ],
      zones: [STREET],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: four separate buildings, each lower than the last, with alleys
    //    between them. Hopping roof to roof is safe and slow. Each roof also overlooks
    //    one further on: the jump is there for a ball hit exactly hard enough.
    {
      id: 'city-3',
      par: 4,
      tee: [0, 8, 8.5],
      goal: { type: 'cup', position: [6.5, 2, -7], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        ...b3.map((b) => b.roof),
        // First roof: open ahead.
        parapet([-2, 10], [2, 10], 8),
        parapet([-2, 5], [-2, 10], 8),
        parapet([2, 5], [2, 10], 8),
        // Second: a backstop ahead, open on the right.
        parapet([-2, -1], [3, -1], 6, 0.5),
        parapet([-2, -1], [-2, 4], 6),
        // Third: a backstop on the right, open ahead.
        parapet([9, -2], [9, 3], 4, 0.5),
        parapet([4, 3], [9, 3], 4),
        // Last: walled on three sides.
        parapet([4, -9], [9, -9], 2, 0.6),
        parapet([4, -9], [4, -3], 2),
        parapet([9, -9], [9, -3], 2),
        vent(0.5, 1, 6),
        acUnit(6.5, 1.8, 4),
      ],
      decor: [
        ...b3.map((b) => b.lights),
        ...towers([-8.5, 0, 5, 10, 7, 0x66788c], [-7.5, -11, 6, 9, 6, 0x8a7f74], [15, 2, 5, 7, 7, 0x857a8c], [15, -8, 5, 6, 6, 0x6c7f94], [6, -16, 8, 9, 4, 0x70828f]),
        { type: 'antenna', at: [-8.5, 10, 0] },
        { type: 'waterTank', at: [15, 7, 2] },
      ],
      zones: [STREET],
      outOfBounds: 'lastPosition',
    },
  ],
};
