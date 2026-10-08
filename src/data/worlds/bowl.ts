import type { WorldDef } from '../../level/schema';
import { FALL, rack, walledRoom } from './common';

/**
 * World 14: there is no cup. The hole is finished when every pin is down; a pin counts
 * as down once it leans past 60 degrees, or leaves the course. After each stroke the
 * fallen pins are cleared away and the standing ones stay where they were knocked to.
 * Strokes are counted against par as on any other hole. The lane is oiled: the ball
 * keeps its speed.
 */
export const BOWL_WORLD: WorldDef = {
  id: 'bowl',
  name: { en: 'Golf Bowling', zh: '高尔夫保龄球' },
  theme: 'alley',
  ruleCard: { en: 'No hole here — knock down every pin!', zh: '这里没有球洞，撞倒所有木桩！' },
  ruleTag: { en: 'PINS', zh: '木桩' },
  holes: [
    // 1. Teaching: one lane, ten pins. Dead centre leaves pins standing; just off the
    //    head pin takes them all.
    {
      id: 'bowl-1',
      par: 2,
      tee: [0, 0, 6.5],
      goal: { type: 'knockdown', pins: rack([0, 0, -5], 4) },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Strike: all ten with one stroke', zh: '一杆全倒' } },
      pieces: walledRoom([-1.5, -8], [1.5, 8], 'lane', 'gutter'),
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: six pins down the lane and six more round the corner. The slanted
    //    wall at the end turns a ball that has gone through the first group into the second.
    {
      id: 'bowl-2',
      par: 3,
      tee: [0, 0, 7],
      goal: { type: 'knockdown', pins: [...rack([0, 0, 1.5], 3), ...rack([5, 0, -4.5], 3, 270)] },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-1.5, -6], max: [1.5, 8.5], surface: 'lane' },
        { type: 'floor', min: [1.5, -6], max: [8, -3], surface: 'lane' },
        { type: 'wall', from: [-1.5, 8.5], to: [1.5, 8.5], surface: 'gutter' },
        { type: 'wall', from: [-1.5, 8.5], to: [-1.5, -3], surface: 'gutter' },
        { type: 'wall', from: [1.5, 8.5], to: [1.5, -3], surface: 'gutter' },
        { type: 'wall', from: [1.5, -3], to: [8, -3], surface: 'gutter' },
        { type: 'wall', from: [8, -3], to: [8, -6], surface: 'gutter' },
        { type: 'wall', from: [8, -6], to: [1.5, -6], surface: 'gutter' },
        // The deflector
        { type: 'wall', from: [-1.5, -3], to: [1.5, -6], surface: 'rail' },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: three pins on the deck by the tee, twelve on the floor below. A ball
    //    that drops off the deck has a long way round to get back up, by the ramp on the
    //    right: the pins up here come first.
    {
      id: 'bowl-3',
      par: 4,
      tee: [0, 1, 8],
      goal: {
        type: 'knockdown',
        pins: [...rack([0, 1, 4], 2), ...rack([-1.4, 0, -2.5], 3), ...rack([1.2, 0, -6], 3)],
      },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        // The deck, and the landing the ramp comes up to
        { type: 'floor', min: [-2, 2.5], max: [2, 9.5], y: 1, depth: 1.45, surface: 'lane' },
        { type: 'floor', min: [2, 7.5], max: [3.5, 9.5], y: 1, depth: 1.45, surface: 'lane' },
        { type: 'ramp', min: [2.5, 2.5], max: [3.5, 7.5], along: 'z', yFrom: 0, yTo: 1, surface: 'lane' },
        { type: 'wall', from: [-2, 9.5], to: [3.5, 9.5], y: 1, surface: 'gutter' },
        { type: 'wall', from: [-2, 9.5], to: [-2, 2.5], y: 1, surface: 'gutter' },
        { type: 'wall', from: [3.5, 9.5], to: [3.5, 7.5], y: 1, surface: 'gutter' },
        { type: 'wall', from: [3.5, 7.5], to: [3.5, 2.5], y: [1, 0], surface: 'gutter' },
        { type: 'wall', from: [2, 7.5], to: [2, 2.5], y: 1, surface: 'gutter' },
        // The floor below
        { type: 'floor', min: [-2, -9], max: [3.5, 2.5], surface: 'lane' },
        { type: 'wall', from: [-2, 2.5], to: [-2, -9], surface: 'gutter' },
        { type: 'wall', from: [-2, -9], to: [3.5, -9], surface: 'gutter' },
        { type: 'wall', from: [3.5, -9], to: [3.5, 2.5], surface: 'gutter' },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58 },
    },
  ],
};
