import type { WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';

/**
 * World 2: bouncing. Stone walls return most of the ball's speed, and the cup is
 * rarely in a straight line from the ball. Sand kills the ball almost on the spot.
 */
export const DESERT_WORLD: WorldDef = {
  id: 'desert',
  name: { en: 'Desert Ruins', zh: '沙漠遗迹' },
  theme: 'desert',
  ruleCard: { en: 'Walls are your friend. Bounce it!', zh: '善用墙壁，反弹进洞！' },
  ruleTag: { en: 'BOUNCE', zh: '反弹' },
  holes: [
    // 1. Teaching: the cup is around a corner. A slanted wall turns a straight shot toward it.
    {
      id: 'desert-1',
      par: 2,
      tee: [0, 0, 5],
      goal: { type: 'cup', position: [8, 0, -6], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: [
        { type: 'floor', min: [-2, -4], max: [2, 7], surface: 'sandstone' },
        { type: 'floor', min: [-2, -8], max: [10, -4], surface: 'sandstone' },
        { type: 'wall', from: [-2, 7], to: [2, 7], surface: 'stone' },
        { type: 'wall', from: [2, 7], to: [2, -4], surface: 'stone' },
        { type: 'wall', from: [2, -4], to: [10, -4], surface: 'stone' },
        { type: 'wall', from: [10, -4], to: [10, -8], surface: 'stone' },
        { type: 'wall', from: [10, -8], to: [-2, -8], surface: 'stone' },
        { type: 'wall', from: [-2, -8], to: [-2, 7], surface: 'stone' },
        // The deflector
        { type: 'wall', from: [-2, -4], to: [2, -8], surface: 'stone' },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: a wall splits the room and a sand pit fills the straight line to the
    //    cup. The clean way is the narrow strip beside the pit and a bank off the side wall.
    {
      id: 'desert-2',
      par: 3,
      tee: [0, 0, 4.5],
      goal: { type: 'cup', position: [2.5, 0, -5], ...CUP },
      challenge: { type: 'avoidSurface', surface: 'sand', text: { en: 'Never touch the sand', zh: '全程不碰沙坑' } },
      pieces: [
        // Listed first so the sand wins where it overlaps the room.
        { type: 'floor', min: [1, -3], max: [3.5, -0.5], surface: 'sand' },
        { type: 'floor', min: [-5, -8], max: [5, 6], surface: 'sandstone' },
        { type: 'wall', from: [-5, 6], to: [5, 6], surface: 'stone' },
        { type: 'wall', from: [5, 6], to: [5, -8], surface: 'stone' },
        { type: 'wall', from: [5, -8], to: [-5, -8], surface: 'stone' },
        { type: 'wall', from: [-5, -8], to: [-5, 6], surface: 'stone' },
        { type: 'wall', from: [-5, -1], to: [1, -1], surface: 'stone' },
        { type: 'pillar', at: [-1.5, -5], radius: 0.5, surface: 'stone' },
        { type: 'pillar', at: [-3.5, -3], radius: 0.4, surface: 'stone' },
        { type: 'pillar', at: [-3, 3], radius: 0.4, surface: 'stone' },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: a zigzag corridor with two deflectors, then a band of sand and a
    //    narrow gate in front of the cup.
    {
      id: 'desert-3',
      par: 3,
      tee: [0, 0, 5],
      goal: { type: 'cup', position: [8, 0, -12.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-1, -6], max: [1, 6], surface: 'sandstone' },
        { type: 'floor', min: [1, -6], max: [9, -4], surface: 'sandstone' },
        { type: 'floor', min: [7, -8], max: [9, -6], surface: 'sandstone' },
        { type: 'floor', min: [7, -9], max: [9, -8], surface: 'sand' },
        { type: 'floor', min: [7, -14], max: [9, -9], surface: 'sandstone' },
        // First leg
        { type: 'wall', from: [-1, 6], to: [1, 6], surface: 'stone' },
        { type: 'wall', from: [-1, 6], to: [-1, -4], surface: 'stone' },
        { type: 'wall', from: [1, 6], to: [1, -4], surface: 'stone' },
        { type: 'wall', from: [-1, -4], to: [1, -6], surface: 'stone' },
        // Second leg
        { type: 'wall', from: [1, -4], to: [7, -4], surface: 'stone' },
        { type: 'wall', from: [1, -6], to: [7, -6], surface: 'stone' },
        { type: 'wall', from: [7, -4], to: [9, -6], surface: 'stone' },
        // Third leg and the gate
        { type: 'wall', from: [7, -6], to: [7, -14], surface: 'stone' },
        { type: 'wall', from: [9, -6], to: [9, -14], surface: 'stone' },
        { type: 'wall', from: [7, -14], to: [9, -14], surface: 'stone' },
        { type: 'wall', from: [7, -10], to: [7.5, -10], surface: 'stone' },
        { type: 'wall', from: [8.5, -10], to: [9, -10], surface: 'stone' },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },
  ],
};
