import type { WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';
import { wallWithDoors } from './ruins';

/**
 * World 16: light opens gates (SPEC v4 3.4). A lantern shines a beam; a crystal sends
 * on the light that reaches it the way it points, and a ball that knocks it turns it to
 * its next facing. The marks on the ground round a crystal show every way it can point.
 * Once light has reached a receiver, the gate it opens stays open.
 */
export const CAVERN_WORLD: WorldDef = {
  id: 'cavern',
  name: { en: 'Crystal Cavern', zh: '水晶矿洞' },
  theme: 'cavern',
  ruleCard: {
    en: 'Hit a crystal to turn it. Guide the light to open the gate.',
    zh: '撞击水晶使它转动，把光引到接收器打开闸门。',
  },
  ruleTag: { en: 'LIGHT', zh: '光路' },
  holes: [
    // 1. Teaching: one crystal, pointing the wrong way. One knock turns it to the receiver.
    {
      id: 'cavern-1',
      par: 3,
      tee: [0, 0, 6.5],
      goal: { type: 'cup', position: [1.5, 0, -4], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-3, -7], max: [3, 8], surface: 'cavernFloor' },
        { type: 'wall', from: [-3, 8], to: [3, 8], surface: 'cavernWall' },
        { type: 'wall', from: [3, 8], to: [3, -7], surface: 'cavernWall' },
        { type: 'wall', from: [3, -7], to: [-3, -7], surface: 'cavernWall' },
        { type: 'wall', from: [-3, -7], to: [-3, 8], surface: 'cavernWall' },
        ...wallWithDoors([-3, 0], [3, 0], [[2.9, 4.1]], 'cavernWall', { height: 0.8 }),
      ],
      field: {
        parts: [
          { kind: 'emitter', at: [-2.6, 0, 3], heading: 90 },
          { kind: 'crystal', id: 'crystal', at: [-1, 0, 3], facings: [90, 0] },
          { kind: 'receiver', id: 'receiver', at: [-1, 0, 0.5] },
          { kind: 'gate', id: 'gate', from: [-0.1, 0], to: [1.1, 0], when: 'receiver' },
        ],
      },
      decor: [
        { type: 'crystals', at: [-4.4, -0.9, 5], size: [1.8, 0, 0] },
        { type: 'crystals', at: [4.4, -0.9, -2], size: [2.2, 0, 0] },
        { type: 'crystals', at: [-4.6, -0.9, -5], size: [1.4, 0, 0] },
        { type: 'crystals', at: [4.3, -0.9, 6], size: [1.5, 0, 0] },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: two crystals, one after the other. The light has to be passed from
    //    the first to the second and from there to the receiver across the room.
    {
      id: 'cavern-2',
      par: 4,
      tee: [0, 0, 7.5],
      goal: { type: 'cup', position: [1.1, 0, -4.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        { type: 'floor', min: [-4, -7], max: [4, 9], surface: 'cavernFloor' },
        { type: 'wall', from: [-4, 9], to: [4, 9], surface: 'cavernWall' },
        { type: 'wall', from: [4, 9], to: [4, -7], surface: 'cavernWall' },
        { type: 'wall', from: [4, -7], to: [-4, -7], surface: 'cavernWall' },
        { type: 'wall', from: [-4, -7], to: [-4, 9], surface: 'cavernWall' },
        ...wallWithDoors([-4, 0], [4, 0], [[4.5, 5.7]], 'cavernWall', { height: 0.8 }),
      ],
      field: {
        parts: [
          { kind: 'emitter', at: [-3.6, 0, 5], heading: 90 },
          { kind: 'crystal', id: 'first', at: [-1.5, 0, 5], facings: [180, 0] },
          { kind: 'crystal', id: 'second', at: [-1.5, 0, 2], facings: [270, 90] },
          { kind: 'receiver', id: 'receiver', at: [3.5, 0, 2] },
          { kind: 'gate', id: 'gate', from: [0.5, 0], to: [1.7, 0], when: 'receiver', via: [[3.5, 0.6], [1.1, 0.6]] },
        ],
      },
      decor: [
        { type: 'crystals', at: [-5.5, -0.9, 6], size: [2, 0, 0] },
        { type: 'crystals', at: [5.5, -0.9, 3], size: [1.6, 0, 0] },
        { type: 'crystals', at: [-5.6, -0.9, -4], size: [2.3, 0, 0] },
        { type: 'crystals', at: [5.4, -0.9, -6], size: [1.5, 0, 0] },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: the light can go two ways from the first crystal, and the gate wants
    //    both receivers lit. Send it one way, then the other; which first is the puzzle.
    {
      id: 'cavern-3',
      par: 5,
      tee: [0, 0, 8],
      goal: { type: 'cup', position: [0.5, 0, -5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        { type: 'floor', min: [-4, -7], max: [4, 9], surface: 'cavernFloor' },
        { type: 'wall', from: [-4, 9], to: [4, 9], surface: 'cavernWall' },
        { type: 'wall', from: [4, 9], to: [4, -7], surface: 'cavernWall' },
        { type: 'wall', from: [4, -7], to: [-4, -7], surface: 'cavernWall' },
        { type: 'wall', from: [-4, -7], to: [-4, 9], surface: 'cavernWall' },
        ...wallWithDoors([-4, 0], [4, 0], [[3.9, 5.1]], 'cavernWall', { height: 0.8 }),
      ],
      field: {
        parts: [
          { kind: 'emitter', at: [-3.6, 0, 5], heading: 90 },
          { kind: 'crystal', id: 'fork', at: [-1, 0, 5], facings: [0, 90] },
          { kind: 'crystal', id: 'west', at: [-1, 0, 2], facings: [90, 270] },
          { kind: 'crystal', id: 'east', at: [2.5, 0, 5], facings: [0, 180] },
          { kind: 'receiver', id: 'left', at: [-3.5, 0, 2] },
          { kind: 'receiver', id: 'right', at: [2.5, 0, 1] },
          {
            kind: 'gate',
            id: 'gate',
            from: [-0.1, 0],
            to: [1.1, 0],
            when: { all: ['left', 'right'] },
            via: [[-3.5, 0.6], [0.5, 0.6]],
          },
        ],
      },
      decor: [
        { type: 'crystals', at: [-5.5, -0.9, 7], size: [1.6, 0, 0] },
        { type: 'crystals', at: [5.6, -0.9, 0.5], size: [2.3, 0, 0] },
        { type: 'crystals', at: [-5.6, -0.9, -2], size: [1.5, 0, 0] },
        { type: 'crystals', at: [5.4, -0.9, -6], size: [1.9, 0, 0] },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },
  ],
};
