import type { PieceDef, WorldDef } from '../../level/schema';
import { tunnelPair } from '../../physics/zones/tunnel';
import { CUP, FALL } from './common';

/** Thick enough to read as a tower from the side. */
const TOWER = 1.6;

/**
 * A railed runway one metre wide, heading -Z from `fromZ` to its open end at `toZ`. The
 * rails keep the ball straight: the only way off is the end, and beyond it is thin air.
 */
function runway(fromZ: number, toZ: number, y: number): PieceDef[] {
  return [
    { type: 'floor', min: [-0.5, toZ], max: [0.5, fromZ], y, depth: TOWER, surface: 'marble' },
    { type: 'wall', from: [-0.5, fromZ], to: [0.5, fromZ], y, surface: 'bronze' },
    { type: 'wall', from: [-0.5, fromZ], to: [-0.5, toZ], y, surface: 'bronze' },
    { type: 'wall', from: [0.5, fromZ], to: [0.5, toZ], y, surface: 'bronze' },
  ];
}

/**
 * World 12: the player can stop time. While a ball is under way, the freeze button
 * stops everything; the ball can then be struck again from wherever it is, in mid-air
 * included, and that stroke replaces its speed outright. Every hole here launches the
 * ball off the end of a runway into thin air: the way on is a turn made in the air.
 * A fall costs a stroke and goes back to the tee.
 */
export const FREEZE_WORLD: WorldDef = {
  id: 'freeze',
  name: { en: 'Time Freeze', zh: '时间暂停' },
  theme: 'observatory',
  ruleCard: {
    en: 'Tap ⏸ to freeze time — then shoot again from mid-air!',
    zh: '点击 ⏸ 冻结时间，然后在空中再打一杆！',
  },
  ruleTag: { en: 'FREEZE', zh: '暂停' },
  holes: [
    // 1. Teaching: the runway ends over nothing, and the green is off to the right.
    //    Freeze once the ball is in the air and strike it to the right.
    {
      id: 'freeze-1',
      par: 3,
      tee: [0, 1.5, 8],
      goal: { type: 'cup', position: [6, 0, -3], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      skills: { freeze: 2 },
      pieces: [
        ...runway(9, 1, 1.5),
        { type: 'floor', min: [2.5, -6], max: [8.5, 0], depth: TOWER, surface: 'marble' },
        { type: 'wall', from: [2.5, 0], to: [8.5, 0], surface: 'bronze' },
        { type: 'wall', from: [8.5, 0], to: [8.5, -6], height: 0.8, surface: 'bronze' },
        { type: 'wall', from: [8.5, -6], to: [2.5, -6], surface: 'bronze' },
      ],
      zones: [FALL],
      outOfBounds: 'tee',
      camera: { pitch: 58, maxDistance: 34 },
    },

    // 2. Variation: a ramp throws the ball a long way, past three places to come down.
    //    The near island on the right is easy to reach but a long bridge from the cup;
    //    the island on the left has a tunnel to it; the far one on the right is the green.
    {
      id: 'freeze-2',
      par: 4,
      tee: [0, 2, 9],
      goal: { type: 'cup', position: [4.5, 0, -11], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      skills: { freeze: 2 },
      pieces: [
        ...runway(10, 5, 2),
        { type: 'ramp', min: [-0.5, 1], max: [0.5, 5], along: 'z', yFrom: 3, yTo: 2, depth: TOWER, surface: 'marble' },
        { type: 'wall', from: [-0.5, 5], to: [-0.5, 1], y: [2, 3], surface: 'bronze' },
        { type: 'wall', from: [0.5, 5], to: [0.5, 1], y: [2, 3], surface: 'bronze' },
        // Near island, and the bridge from it to the green
        { type: 'floor', min: [2, -4], max: [6, 0], depth: TOWER, surface: 'marble' },
        { type: 'wall', from: [6, 0], to: [6, -4], height: 0.8, surface: 'bronze' },
        { type: 'wall', from: [2, 0], to: [6, 0], surface: 'bronze' },
        { type: 'floor', min: [3.5, -9], max: [4.5, -4], surface: 'marble' },
        // The green
        { type: 'floor', min: [2, -13], max: [6, -9], depth: TOWER, surface: 'marble' },
        { type: 'wall', from: [6, -9], to: [6, -13], height: 0.8, surface: 'bronze' },
        { type: 'wall', from: [6, -13], to: [2, -13], surface: 'bronze' },
        // Left island, with the tunnel
        { type: 'floor', min: [-6, -8], max: [-2, -4], depth: TOWER, surface: 'marble' },
        { type: 'wall', from: [-6, -4], to: [-6, -8], height: 0.8, surface: 'bronze' },
        { type: 'wall', from: [-6, -8], to: [-2, -8], surface: 'bronze' },
      ],
      zones: [FALL, tunnelPair({ at: [-5.4, 0, -6], facing: 90 }, { at: [2.6, 0, -11], facing: 90 })],
      outOfBounds: 'tee',
      camera: { pitch: 58, maxDistance: 38 },
    },

    // 3. Challenge: the green lies behind a tall screen, and the only way in is round
    //    the near end of it. Out, across, and back down the far side: two turns in the
    //    air, which is every freeze the hole gives.
    {
      id: 'freeze-3',
      par: 4,
      tee: [0, 5, 8],
      goal: { type: 'cup', position: [8.5, 0, -12], ...CUP },
      challenge: { type: 'noOutOfBounds', text: { en: 'Never fall off', zh: '全程不坠落' } },
      skills: { freeze: 2 },
      pieces: [
        ...runway(9, 4, 5),
        { type: 'ramp', min: [-0.5, 1], max: [0.5, 4], along: 'z', yFrom: 5.6, yTo: 5, depth: TOWER, surface: 'marble' },
        { type: 'wall', from: [-0.5, 4], to: [-0.5, 1], y: [5, 5.6], surface: 'bronze' },
        { type: 'wall', from: [0.5, 4], to: [0.5, 1], y: [5, 5.6], surface: 'bronze' },
        // The green and its backstops
        { type: 'floor', min: [5.5, -15], max: [11.5, -8], depth: TOWER, surface: 'marble' },
        { type: 'wall', from: [11.5, -8], to: [11.5, -15], height: 0.8, surface: 'bronze' },
        { type: 'wall', from: [11.5, -15], to: [5.5, -15], height: 0.8, surface: 'bronze' },
        // The screen: far too tall to fly over
        { type: 'wall', from: [5.5, -15], to: [5.5, -3], height: 9, thickness: 0.3, surface: 'bronze' },
      ],
      zones: [FALL],
      outOfBounds: 'tee',
      camera: { pitch: 60, maxDistance: 44 },
    },
  ],
};
