import type { WorldDef } from '../../level/schema';
import { bubbles, stream } from '../../physics/zones/water';
import { CUP, FALL } from './common';

const FLOOR = 'seabed';
const WALL = 'coral';
/** How thick a ledge is: thick enough to be a cliff down to the floor below it. */
const LEDGE = 2.45;

/**
 * World 19: moving water (SPEC v5 3.2). A current carries the ball along at its own
 * pace: going with it is no faster than the water, and going against it gets nowhere.
 * A column of bubbles lifts a ball that rolls into its foot and sets it down on the
 * ledge above, always in the same place.
 */
export const REEF_WORLD: WorldDef = {
  id: 'reef',
  name: { en: 'Reef', zh: '海底' },
  theme: 'reef',
  ruleCard: {
    en: 'Currents carry the ball. Bubbles lift it up.',
    zh: '水流会带着球走，气泡会把球托上去。',
  },
  ruleTag: { en: 'CURRENTS', zh: '水流' },
  holes: [
    // 1. Teaching: a channel that runs north and then turns east, and the water with it.
    //    A tap is enough: the current takes the ball round the corner to the cup.
    {
      id: 'reef-1',
      par: 2,
      tee: [0, 0, 6.5],
      goal: { type: 'cup', position: [4.7, 0, -3.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: [
        { type: 'floor', min: [-1.5, -6], max: [1.5, 8], surface: FLOOR },
        { type: 'floor', min: [1.5, -6], max: [7, -3], surface: FLOOR },
        { type: 'wall', from: [-1.5, 8], to: [1.5, 8], surface: WALL },
        { type: 'wall', from: [-1.5, -6], to: [-1.5, 8], surface: WALL },
        { type: 'wall', from: [1.5, 8], to: [1.5, -3], surface: WALL },
        { type: 'wall', from: [1.5, -3], to: [7, -3], surface: WALL },
        { type: 'wall', from: [7, -3], to: [7, -6], surface: WALL },
        { type: 'wall', from: [7, -6], to: [-1.5, -6], surface: WALL },
      ],
      decor: [
        { type: 'coral', at: [-3, -0.9, 3], size: [1.8, 0, 0] },
        { type: 'kelp', at: [-3.2, -0.9, -3], size: [3.2, 0, 0] },
        { type: 'coral', at: [3.4, -0.9, 1.5], size: [1.4, 0, 0], color: 0xf2a65a },
        { type: 'kelp', at: [8.5, -0.9, -4.5], size: [2.8, 0, 0] },
        { type: 'coral', at: [4, -0.9, -7.6], size: [1.7, 0, 0] },
      ],
      zones: [FALL, stream([-1.5, -3], [1.5, 4.5], [0, -3]), stream([-1.5, -6], [3.5, -3], [3, 0])],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: the cup is upstream, and no stroke gets up this water. The column
    //    in the corner lifts the ball onto the ledge that runs above it; the far end of
    //    the ledge drops to the still water where the cup is.
    {
      id: 'reef-2',
      par: 3,
      tee: [0, 0, 6.5],
      goal: { type: 'cup', position: [0, 0, -6.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        // The floor: where the ball starts, the water coming down, and the pool with the cup
        { type: 'floor', min: [-2, 3], max: [4, 8], surface: FLOOR },
        { type: 'floor', min: [-2, -4.5], max: [2, 3], surface: FLOOR },
        { type: 'floor', min: [-2, -8], max: [4, -4.5], surface: FLOOR },
        // The ledge above the east side
        { type: 'floor', min: [2, -4.5], max: [4, 3], y: 2, depth: LEDGE, surface: FLOOR },
        { type: 'wall', from: [4, 3], to: [4, -4.5], y: 2, surface: WALL },
        { type: 'wall', from: [2, 3], to: [2, -4.5], y: 2, surface: WALL },
        // Round the outside
        { type: 'wall', from: [-2, 8], to: [4, 8], surface: WALL },
        { type: 'wall', from: [4, 8], to: [4, 3], height: 0.8, surface: WALL },
        { type: 'wall', from: [-2, -8], to: [-2, 8], surface: WALL },
        { type: 'wall', from: [-2, -8], to: [4, -8], surface: WALL },
        { type: 'wall', from: [4, -8], to: [4, -4.5], height: 0.8, surface: WALL },
      ],
      decor: [
        { type: 'coral', at: [-3.7, -0.9, 5], size: [1.8, 0, 0] },
        { type: 'kelp', at: [-3.5, -0.9, -2], size: [3.4, 0, 0] },
        { type: 'coral', at: [5.7, -0.9, -6], size: [1.5, 0, 0], color: 0xf2a65a },
        { type: 'kelp', at: [5.6, -0.9, 6], size: [3, 0, 0] },
      ],
      zones: [FALL, stream([-2, -4.5], [2, 3], [0, 3.5]), bubbles([3, 0, 4.6], 2.5, [0, 0.6, -7.5])],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: two columns, two ledges and water going three ways. The current on
    //    the floor sweeps a ball to the east column, which is the wrong one: the water on
    //    the high ground runs from west to east, over the cup, and cannot be got up from
    //    its far end. The west column first.
    {
      id: 'reef-3',
      par: 3,
      tee: [0, 0, 6.5],
      goal: { type: 'cup', position: [0, 2, -6.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        // The floor
        { type: 'floor', min: [-5, 0.5], max: [5, 8], surface: FLOOR },
        { type: 'wall', from: [-5, 8], to: [5, 8], surface: WALL },
        { type: 'wall', from: [-5, 0.5], to: [-5, 8], height: 0.8, surface: WALL },
        { type: 'wall', from: [5, 8], to: [5, 0.5], height: 0.8, surface: WALL },
        // The high ground: a ledge up each side and the shelf across the far end
        { type: 'floor', min: [-5, -8], max: [-3, 0.5], y: 2, depth: LEDGE, surface: FLOOR },
        { type: 'floor', min: [3, -8], max: [5, 0.5], y: 2, depth: LEDGE, surface: FLOOR },
        { type: 'floor', min: [-3, -8], max: [3, -5], y: 2, depth: LEDGE, surface: FLOOR },
        { type: 'wall', from: [-5, 0.5], to: [-5, -8], y: 2, surface: WALL },
        { type: 'wall', from: [-5, -8], to: [5, -8], y: 2, surface: WALL },
        { type: 'wall', from: [5, -8], to: [5, 0.5], y: 2, surface: WALL },
        { type: 'wall', from: [-3, 0.5], to: [-3, -5], y: 2, surface: WALL },
        { type: 'wall', from: [-3, -5], to: [3, -5], y: 2, surface: WALL },
        { type: 'wall', from: [3, -5], to: [3, 0.5], y: 2, surface: WALL },
        // The cliff under the shelf, as seen from the floor
        { type: 'wall', from: [-3, 0.5], to: [3, 0.5], height: 0.8, surface: WALL },
      ],
      decor: [
        { type: 'coral', at: [-6.7, -0.9, 5], size: [1.8, 0, 0] },
        { type: 'kelp', at: [6.7, -0.9, 4], size: [3.2, 0, 0] },
        { type: 'coral', at: [6.6, -0.9, -5], size: [1.6, 0, 0], color: 0xf2a65a },
        { type: 'kelp', at: [-6.6, -0.9, -5], size: [3.4, 0, 0] },
        { type: 'coral', at: [0, -0.9, -1.8], size: [2.4, 0, 0], color: 0xd96fa8 },
      ],
      zones: [
        FALL,
        // On the floor, east, into the east column
        stream([-1.5, 1], [3.6, 2.6], [3, 0]),
        // On the east ledge, north
        stream([3, -5], [5, -1], [0, -2.5], { y: 2 }),
        // On the shelf, east: over the cup from the west, away from it from the east
        stream([-3, -8], [3, -5], [2.6, 0], { y: 2 }),
        bubbles([-4, 0, 1.6], 2.5, [0, 0.6, -6.3]),
        bubbles([4.3, 0, 1.8], 2.5, [0, 0.6, -6]),
      ],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58 },
    },
  ],
};
