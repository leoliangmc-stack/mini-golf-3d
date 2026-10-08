import type { PieceDef, WorldDef } from '../../level/schema';
import { splitPad } from '../../physics/zones/pads';
import { tunnelPair } from '../../physics/zones/tunnel';
import { CUP, FALL, walledRoom } from './common';

/**
 * A wall across the course at `z` with a doorway a metre wide at `x`. A split pad goes
 * in the doorway, so every ball that comes through comes through as two.
 */
function doorway(z: number, minX: number, maxX: number, x = 0): PieceDef[] {
  return [
    { type: 'wall', from: [minX, z], to: [x - 0.6, z], surface: 'mirror' },
    { type: 'wall', from: [x + 0.6, z], to: [maxX, z], surface: 'mirror' },
  ];
}

/**
 * World 13: one ball becomes several. A ball rolling over a split pad comes apart into
 * two, heading 20 degrees to either side of the way it was going. Any one of them
 * finishing the hole finishes it; when they have all stopped, the player picks one to
 * play on with and the rest vanish. A ball that falls off costs nothing while another
 * is still on the course.
 */
export const CLONE_WORLD: WorldDef = {
  id: 'clone',
  name: { en: 'Clone Ball', zh: '分身球' },
  theme: 'mirrors',
  ruleCard: { en: 'Split the ball — any one in the hole wins.', zh: '分裂球——任意一个进洞就算赢。' },
  ruleTag: { en: 'CLONES', zh: '分身' },
  holes: [
    // 1. Teaching: a pillar stands on the straight line to the cup. Split, the two
    //    halves go round it, one off each mirror, and meet again where the cup is.
    {
      id: 'clone-1',
      par: 2,
      tee: [0, 0, 7],
      goal: { type: 'cup', position: [0, 0, -7.1], ...CUP },
      challenge: {
        type: 'minCues',
        cue: 'holed',
        count: 2,
        text: { en: 'Sink both halves with one stroke', zh: '一杆让两个分身都进洞' },
      },
      maxBalls: 2,
      pieces: [
        ...walledRoom([-2, -11], [2, 8.5], 'tile', 'mirror'),
        ...doorway(4, -2, 2),
        { type: 'pillar', at: [0, -3], radius: 0.6, surface: 'mirror' },
      ],
      zones: [FALL, splitPad([0, 0, 4], 20, 0.5)],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: past the doorway the room is split down the middle. The left side
    //    is the short way but a band of sand lies across it; the right side is clear
    //    but comes out at the far corner. Whichever half ends up better placed plays on.
    {
      id: 'clone-2',
      par: 3,
      tee: [0, 0, 8],
      goal: { type: 'cup', position: [-2, 0, -7.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      maxBalls: 2,
      pieces: [
        // Listed first so the sand wins where it overlaps the room.
        { type: 'floor', min: [-4, -2], max: [0, 0], surface: 'sand' },
        ...walledRoom([-4, -9], [4, 9.5], 'tile', 'mirror'),
        ...doorway(5, -4, 4),
        // The divider, and the wall that closes the bottom of the right-hand side
        { type: 'wall', from: [0, 3], to: [0, -5], surface: 'mirror' },
        { type: 'wall', from: [0, -5], to: [2.5, -5], surface: 'mirror' },
      ],
      zones: [FALL, splitPad([0, 0, 5], 20, 0.5)],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: three pads make four balls, fanning out across the room. The far
    //    left one rolls into a tunnel that comes out on the raised green; the two in the
    //    middle run up the ramps to it; the far right one finds the gap in the wall.
    {
      id: 'clone-3',
      par: 3,
      tee: [0, 0, 9],
      goal: { type: 'cup', position: [0.5, 1, -10], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      maxBalls: 4,
      pieces: [
        { type: 'floor', min: [-5, -4], max: [5, 10.5], surface: 'tile' },
        { type: 'wall', from: [-5, 10.5], to: [5, 10.5], surface: 'mirror' },
        { type: 'wall', from: [-5, 10.5], to: [-5, -4], surface: 'mirror' },
        // The right-hand wall stops short: the gap is the way off the course.
        { type: 'wall', from: [5, 10.5], to: [5, 0.5], surface: 'mirror' },
        ...doorway(6.5, -5, 5),
        // Two ramps up to the green, with a block between them
        { type: 'ramp', min: [-2, -8], max: [-0.5, -4], along: 'z', yFrom: 1, yTo: 0, surface: 'tile' },
        { type: 'ramp', min: [0.5, -8], max: [2, -4], along: 'z', yFrom: 1, yTo: 0, surface: 'tile' },
        { type: 'wall', from: [-5, -4], to: [-2, -4], surface: 'mirror' },
        { type: 'wall', from: [2, -4], to: [5, -4], surface: 'mirror' },
        { type: 'wall', from: [-0.5, -4], to: [0.5, -4], surface: 'mirror' },
        // The green
        { type: 'floor', min: [-3, -12], max: [3, -8], y: 1, depth: 1.45, surface: 'tile' },
        { type: 'wall', from: [-3, -8], to: [-3, -12], y: 1, surface: 'mirror' },
        { type: 'wall', from: [-3, -12], to: [3, -12], y: 1, height: 0.6, surface: 'mirror' },
        { type: 'wall', from: [3, -12], to: [3, -8], y: 1, surface: 'mirror' },
        { type: 'wall', from: [-3, -8], to: [-2, -8], y: 1, surface: 'mirror' },
        { type: 'wall', from: [2, -8], to: [3, -8], y: 1, surface: 'mirror' },
      ],
      zones: [
        FALL,
        splitPad([0, 0, 6.5], 20, 0.5),
        splitPad([-1.27, 0, 3], 20, 0.5),
        splitPad([1.27, 0, 3], 20, 0.5),
        tunnelPair({ at: [-4.6, 0, -1], facing: 90 }, { at: [-2.4, 1, -10.5], facing: 90 }),
      ],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 34 },
    },
  ],
};
