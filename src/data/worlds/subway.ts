import type { Vec3 } from '../../core/types';
import type { PartDef, TunnelMouthDef } from '../../level/field';
import type { DecorDef, WorldDef } from '../../level/schema';
import { CUP, FALL, walledRoom } from './common';

const FLOOR = 'concourse';
const WALL = 'tiling';
/** How far a kiosk reaches from its middle: where a wall that runs up to one has to stop. */
const KIOSK = 0.55;
/** The colours of the two lines of the town. */
export const LINE_GREEN = 0x3fbf7f;
export const LINE_AMBER = 0xffb020;

/** A subway line: a pair of mouths, each in a kiosk, one or both of which a lever turns. */
export const subway = (id: string, a: TunnelMouthDef, b: TunnelMouthDef, color = LINE_GREEN): PartDef => ({
  kind: 'tunnel',
  id,
  a,
  b,
  color,
});

/** What stands in the dark under the concourse: the pillars of the station, and a pipe or two. */
const FLOOR_Y = -3.6;
const pier = (x: number, z: number, height = 3.2): DecorDef => ({ type: 'column', at: [x, FLOOR_Y, z], size: [0.55, height, 0], color: 0x56636f });
const main = (x: number, z: number, yaw = 0): DecorDef => ({ type: 'pipe', at: [x, FLOOR_Y, z], size: [6, 0.4, 0], yaw, color: 0x2f7f8c });
const lever = (x: number, z: number): Vec3 => [x, 0, z];

/**
 * World 27: subway mouths that turn (SPEC v7 3.2). They are the tunnels of the Forest,
 * except that a knock on a mouth's lever turns the mouth to face another way: the ball
 * comes out where the arrow on the ground points, and the faint arrow is where the next
 * knock will point it.
 */
export const SUBWAY_WORLD: WorldDef = {
  id: 'subway',
  name: { en: 'Subway', zh: '地铁换乘' },
  theme: 'subway',
  ruleCard: { en: 'Hit the lever to turn the exit.', zh: '撞拨杆，转动出口。' },
  ruleTag: { en: 'TURNING EXITS', zh: '转向出口' },
  holes: [
    // 1. Teaching: one line. The far mouth stands in a wall and opens into the half of
    //    the hall with nothing in it; a knock on the lever turns it round to the half
    //    with the cup. A ball that went the wrong way rolls back into the mouth.
    {
      id: 'subway-1',
      par: 3,
      tee: [0, 0, 6.5],
      goal: { type: 'cup', position: [2.8, 0, -4.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        ...walledRoom([-3, 2], [3, 8], FLOOR, WALL),
        ...walledRoom([-4, -7], [4, -2], FLOOR, WALL),
        // The wall the far kiosk stands in
        { type: 'wall', from: [0, -7], to: [0, -4.5 - KIOSK], surface: WALL },
        { type: 'wall', from: [0, -4.5 + KIOSK], to: [0, -2], surface: WALL },
      ],
      field: {
        parts: [
          subway(
            'line',
            { at: [0, 0, 2.8], facings: [180] },
            { at: [0, 0, -4.5], facings: [270, 90], lever: lever(2.2, 4.6) },
          ),
        ],
      },
      decor: [pier(-6, 5), pier(6, 5), pier(-7, -4.5), pier(7, -4.5), main(0, 0, 90)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: three ways out. West is an empty platform. North is a pen right
    //    beside the cup, with a wall between. East is the long way round, and the only
    //    one that gets there. The lever goes west, east, north, and round again.
    {
      id: 'subway-2',
      par: 4,
      tee: [0, 0, 9.5],
      goal: { type: 'cup', position: [0, 0, -6], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        ...walledRoom([-3, 5], [3, 11], FLOOR, WALL),
        { type: 'floor', min: [-6, -1.5], max: [6, 1.5], surface: FLOOR },
        { type: 'floor', min: [-1.5, -4.5], max: [1.5, -1.5], surface: FLOOR },
        { type: 'floor', min: [1.5, -7.5], max: [6, -1.5], surface: FLOOR },
        { type: 'floor', min: [-1.5, -7.5], max: [1.5, -4.5], surface: FLOOR },
        // Round the outside
        { type: 'wall', from: [-6, 1.5], to: [6, 1.5], surface: WALL },
        { type: 'wall', from: [6, 1.5], to: [6, -7.5], surface: WALL },
        { type: 'wall', from: [6, -7.5], to: [-1.5, -7.5], surface: WALL },
        { type: 'wall', from: [-1.5, -7.5], to: [-1.5, -1.5], surface: WALL },
        { type: 'wall', from: [-1.5, -1.5], to: [-6, -1.5], surface: WALL },
        { type: 'wall', from: [-6, -1.5], to: [-6, 1.5], surface: WALL },
        // The pen north of the kiosk
        { type: 'wall', from: [-1.5, -4.5], to: [1.5, -4.5], surface: WALL },
        { type: 'wall', from: [1.5, -4.5], to: [1.5, -1.5], surface: WALL },
        // What keeps the three ways apart at the kiosk
        { type: 'wall', from: [-1.5, -1.5], to: [-0.39, -0.39], surface: WALL },
        { type: 'wall', from: [1.5, -1.5], to: [0.39, -0.39], surface: WALL },
        { type: 'wall', from: [0, 1.5], to: [0, KIOSK], surface: WALL },
      ],
      field: {
        parts: [
          subway(
            'line',
            { at: [0, 0, 5.8], facings: [180] },
            { at: [0, 0, 0], facings: [270, 90, 0], lever: lever(-2.2, 7.4) },
            LINE_AMBER,
          ),
        ],
      },
      decor: [pier(-7.5, 6), pier(7.5, 6), pier(-8, -3), pier(8, -9), main(-4.5, 4, 0), main(4.5, 4, 0)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58 },
    },

    // 3. Challenge: both mouths turn, and the line is ridden both ways. The near kiosk
    //    stands in the wall between the start and the hall with the cup, and its lever
    //    is at the far end of the line; the far kiosk's lever is by the tee. So: set the
    //    far mouth, ride out, turn the near mouth from there, and ride back through it.
    {
      id: 'subway-3',
      par: 5,
      tee: [0, 0, 10.5],
      goal: { type: 'cup', position: [0, 0, 1.4], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 4, text: { en: 'Finish in four strokes', zh: '四杆完成' } },
      pieces: [
        { type: 'floor', min: [-3, 0], max: [3, 12], surface: FLOOR },
        { type: 'wall', from: [-3, 12], to: [3, 12], surface: WALL },
        { type: 'wall', from: [3, 12], to: [3, 0], surface: WALL },
        { type: 'wall', from: [3, 0], to: [-3, 0], surface: WALL },
        { type: 'wall', from: [-3, 0], to: [-3, 12], surface: WALL },
        // The wall the near kiosk stands in
        { type: 'wall', from: [-3, 6], to: [-KIOSK, 6], surface: WALL },
        { type: 'wall', from: [KIOSK, 6], to: [3, 6], surface: WALL },
        // The far platform, and the wall its kiosk stands in
        ...walledRoom([-12, 1], [-5, 5], FLOOR, WALL),
        { type: 'wall', from: [-8.5, 1], to: [-8.5, 3 - KIOSK], surface: WALL },
        { type: 'wall', from: [-8.5, 3 + KIOSK], to: [-8.5, 5], surface: WALL },
      ],
      field: {
        parts: [
          subway(
            'line',
            { at: [0, 0, 6], facings: [180, 0], lever: lever(-11.3, 1.8) },
            { at: [-8.5, 0, 3], facings: [90, 270], lever: lever(2.2, 8) },
          ),
        ],
      },
      decor: [pier(6, 9), pier(6, 3), pier(-8.5, 8), pier(-14, 3), main(-4, 9, 0)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 30 },
    },
  ],
};
