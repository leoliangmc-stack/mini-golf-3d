import type { DecorDef, WorldDef } from '../../level/schema';
import { coaster } from '../../physics/zones/coaster';
import { CUP, FALL } from './common';
import { wallWithDoors } from './ruins';

const FLOOR = 'boards';
const WALL = 'fence';
/** Something soft at the end of a platform: a ball that reaches it stops there. */
const SOFT = 'sawdust';

/** The fairground below: tents and stalls, and lamps on their poles. */
const FLOOR_Y = -3.6;
const tent = (x: number, z: number, color: number, radius = 2.4): DecorDef => ({ type: 'tent', at: [x, FLOOR_Y, z], size: [radius, 3, 0], color });
const stall = (x: number, z: number, color: number): DecorDef => ({ type: 'crate', at: [x, FLOOR_Y, z], size: [2.4, 2, 2.4], color });
const lamp = (x: number, z: number): DecorDef => ({ type: 'column', at: [x, FLOOR_Y, z], size: [0.14, 4.2, 0], color: 0xf7e7a8 });

/**
 * World 29: roller coasters (SPEC v7 3.4). A ball that rolls onto the track is carried
 * along it. How fast it was going when it rolled on is all that counts: enough, and it
 * goes round the loop and off the far end; too little, and it comes back. The gauge at
 * the entry shows how fast is enough.
 */
export const FAIR_WORLD: WorldDef = {
  id: 'fair',
  name: { en: 'Carnival', zh: '游乐园' },
  theme: 'funfair',
  ruleCard: { en: 'Hit hard enough to make the loop.', zh: '力度够大才能翻过回环。' },
  ruleTag: { en: 'COASTERS', zh: '过山车' },
  holes: [
    // 1. Teaching: one loop between the tee and the cup. Too soft a stroke rolls back
    //    out of the entry; a firm one goes round and off the end, toward the cup.
    {
      id: 'fair-1',
      par: 3,
      tee: [0, 0, 8.5],
      goal: { type: 'cup', position: [0.6, 0, -5.2], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-2, 4], max: [2, 10], surface: FLOOR },
        { type: 'wall', from: [-2, 10], to: [2, 10], surface: WALL },
        { type: 'wall', from: [-2, 4], to: [-2, 10], surface: WALL },
        { type: 'wall', from: [2, 10], to: [2, 4], surface: WALL },
        ...wallWithDoors([-2, 4], [2, 4], [[1.5, 2.5]], WALL),
        { type: 'floor', min: [-2, -7], max: [3, 1], surface: FLOOR },
        { type: 'wall', from: [-2, -7], to: [-2, 1], surface: WALL },
        { type: 'wall', from: [3, 1], to: [3, -7], surface: WALL },
        { type: 'wall', from: [3, -7], to: [-2, -7], surface: WALL },
        ...wallWithDoors([-2, 1], [3, 1], [[2.1, 3.1]], WALL),
      ],
      zones: [FALL, coaster([0, 0, 4.3], 0, [{ run: 1.4 }, { loop: 0.8 }, { run: 2.8 }])],
      decor: [tent(-6.5, 6, 0xe5484d), tent(7, -3, 0x3f8fe0, 2), stall(-6, -4, 0xf2c14e), lamp(5, 6), lamp(-4.5, 1)],
      outOfBounds: 'lastPosition',
      // Seen from one side, so that a loop reads as a loop and not as a line.
      camera: { pitch: 50, yaw: 38 },
    },

    // 2. Variation: two loops, with a platform between them where the ball has to be
    //    stopped and turned. The second loop is the bigger and wants the harder stroke,
    //    from a shorter run at it.
    {
      id: 'fair-2',
      par: 4,
      tee: [0, 0, 10.5],
      goal: { type: 'cup', position: [-10.2, 0, -0.1], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        { type: 'floor', min: [-2, 6], max: [2, 12], surface: FLOOR },
        { type: 'wall', from: [-2, 12], to: [2, 12], surface: WALL },
        { type: 'wall', from: [-2, 6], to: [-2, 12], surface: WALL },
        { type: 'wall', from: [2, 12], to: [2, 6], surface: WALL },
        ...wallWithDoors([-2, 6], [2, 6], [[1.5, 2.5]], WALL),
        // The platform between the loops
        { type: 'floor', min: [-3, -2.5], max: [3, 3], surface: FLOOR },
        ...wallWithDoors([-3, 3], [3, 3], [[3.1, 4.1]], WALL),
        { type: 'wall', from: [3, 3], to: [3, -2.5], surface: WALL },
        { type: 'wall', from: [3, -2.5], to: [-3, -2.5], surface: WALL },
        ...wallWithDoors([-3, -2.5], [-3, 3], [[2.5, 3.5]], WALL),
        // Where the second loop comes down
        { type: 'floor', min: [-12, -3], max: [-6, 3], surface: FLOOR },
        { type: 'wall', from: [-12, -3], to: [-6, -3], surface: WALL },
        { type: 'wall', from: [-12, 3], to: [-12, -3], surface: WALL },
        { type: 'wall', from: [-6, 3], to: [-12, 3], surface: WALL },
        ...wallWithDoors([-6, -3], [-6, 3], [[2.4, 3.4]], WALL),
      ],
      zones: [
        FALL,
        coaster([0, 0, 6.3], 0, [{ run: 1.4 }, { loop: 0.7 }, { run: 2.6 }]),
        coaster([-2.7, 0, 0.5], 270, [{ run: 1.3 }, { loop: 0.9 }, { run: 2.9 }], { color: 0x3f8fe0 }),
      ],
      decor: [tent(7, 8, 0xe5484d), tent(-8, 9, 0xf2c14e, 2), stall(7, -5, 0x3f8fe0), lamp(-4.5, 7), lamp(5.5, 0), tent(-9, -8, 0x9b5de5, 2.2)],
      outOfBounds: 'lastPosition',
      camera: { pitch: 50, yaw: 38, maxDistance: 30 },
    },

    // 3. Challenge: the track divides. A ball going fast enough at the fork climbs to
    //    the platform with the cup; a slower one is turned off onto the low road, which
    //    gets there in the end by the ramp. The high platform has no wall at its far
    //    end, only sawdust: too hard a stroke goes over.
    {
      id: 'fair-3',
      par: 4,
      tee: [0, 0, 10.5],
      goal: { type: 'cup', position: [0, 1.2, -5.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-2, 6], max: [2, 12], surface: FLOOR },
        { type: 'wall', from: [-2, 12], to: [2, 12], surface: WALL },
        { type: 'wall', from: [-2, 6], to: [-2, 12], surface: WALL },
        { type: 'wall', from: [2, 12], to: [2, 6], surface: WALL },
        ...wallWithDoors([-2, 6], [2, 6], [[1.5, 2.5]], WALL),
        // The high platform: boards, then sawdust, then the edge
        { type: 'floor', min: [-2, -6.5], max: [2, -1], y: 1.2, depth: 1.6, surface: FLOOR },
        { type: 'floor', min: [-2, -8], max: [2, -6.5], y: 1.2, depth: 1.6, surface: SOFT },
        { type: 'wall', from: [2, -1], to: [2, -8], y: 1.2, surface: WALL },
        { type: 'wall', from: [-2, -4], to: [-2, -1], y: 1.2, surface: WALL },
        { type: 'wall', from: [-2, -8], to: [-2, -6], y: 1.2, surface: WALL },
        // The low road: where the low branch comes out, round the corner, and up the ramp
        { type: 'floor', min: [-9, 0], max: [-3.5, 4.5], surface: FLOOR },
        { type: 'floor', min: [-9, -6], max: [-6, 0], surface: FLOOR },
        { type: 'ramp', min: [-6, -6], max: [-2, -4], along: 'x', yFrom: 0, yTo: 1.2, surface: FLOOR },
        { type: 'wall', from: [-9, 4.5], to: [-3.5, 4.5], surface: WALL },
        { type: 'wall', from: [-9, -6], to: [-9, 4.5], surface: WALL },
        { type: 'wall', from: [-3.5, 0], to: [-6, 0], surface: WALL },
        ...wallWithDoors([-3.5, 4.5], [-3.5, 0], [[1.8, 2.8]], WALL),
        { type: 'wall', from: [-6, 0], to: [-6, -4], surface: WALL },
        { type: 'wall', from: [-9, -6], to: [-6, -6], surface: WALL },
        { type: 'wall', from: [-6, -6], to: [-2, -6], y: [0, 1.2], surface: WALL },
        { type: 'wall', from: [-6, -4], to: [-2, -4], y: [0, 1.2], surface: WALL },
      ],
      zones: [
        FALL,
        coaster([0, 0, 6.3], 0, [{ run: 2.6 }], {
          fork: {
            speed: 6.5,
            high: [{ run: 3, rise: 1.2 }, { run: 2 }],
            low: [{ bend: -90, radius: 1.5 }, { run: 2.6 }],
          },
        }),
      ],
      decor: [tent(7, 8, 0xe5484d), tent(7.5, -3, 0xf2c14e, 2.6), stall(-7, 9, 0x3f8fe0), lamp(4.5, 3), lamp(-11.5, -3), tent(-11, 8, 0x9b5de5, 2)],
      outOfBounds: 'lastPosition',
      camera: { pitch: 50, yaw: 38, maxDistance: 30 },
    },
  ],
};
