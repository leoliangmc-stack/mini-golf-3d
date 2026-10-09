import type { Vec3 } from '../../core/types';
import type { PartDef, TrainLineDef, When } from '../../level/field';
import type { DecorDef, MoverDef, WorldDef } from '../../level/schema';
import { CUP, FALL, walledRoom } from './common';
import { wallWithDoors } from './ruins';
import { LINE_AMBER } from './subway';

const FLOOR = 'setts';
const WALL = 'brick';
/** The colours of the lines out of a station: the one the points stand for, and the one a lever sets them to. */
export const LINE_BLUE = 0x3f8fe0;
export const LINE_ORANGE = LINE_AMBER;
export const LINE_PINK = 0xe85fa8;

/** The lever of a junction. A knock throws the points, and the next throws them back. */
export const points = (id: string, at: Vec3, thrown = false): PartDef => ({ kind: 'valve', id, at, look: 'points', open: thrown });

/** A train that waits at `home` for a ball to roll onto the platform at `board`. */
export const train = (id: string, board: Vec3, home: Vec3, lines: readonly TrainLineDef[]): PartDef => ({
  kind: 'train',
  id,
  board,
  home,
  lines,
});

/** One line of a train: where it pulls up, where it sets the ball down, and the lever that sends it there, if any. */
export const line = (stop: Vec3, drop: Vec3, color: number, when?: When, via?: readonly Vec3[]): TrainLineDef => ({
  stop,
  drop,
  color,
  ...(when === undefined ? {} : { when }),
  ...(via === undefined ? {} : { via }),
});

/**
 * A train that crosses the course on a line of its own, out and back, on the hole's
 * clock (SPEC v7 3.3). It is a moving part like any other: it shoves a ball it meets,
 * and a ball may not be left on its track.
 */
export const passingTrain = (z: number, from: number, to: number, period: number, rest: readonly Vec3[]): MoverDef => ({
  role: 'pusher',
  look: 'train',
  size: [5, 0.7, 1],
  position: [from, 0.35, z],
  surface: 'carriage',
  motion: { type: 'slide', offset: [to - from, 0, 0], period, hold: [0.15, 0.15] },
  sweep: { kind: 'box', center: [0, 0.35, z], halfExtents: [3.6, 0.6, 1.1] },
  rest,
});

/** The town, far below: roofs, a water tower, a chimney. */
const FLOOR_Y = -3.6;
const house = (x: number, z: number, color: number, height = 2.6): DecorDef => ({ type: 'tower', at: [x, FLOOR_Y, z], size: [3, height, 3], color });
const chimney = (x: number, z: number): DecorDef => ({ type: 'column', at: [x, FLOOR_Y, z], size: [0.45, 3.4, 0], color: 0x8a4a3a });
const tank = (x: number, z: number): DecorDef => ({ type: 'waterTank', at: [x, FLOOR_Y, z] });

/**
 * World 28: trains and points (SPEC v7 3.3). A ball that rolls onto a platform is put
 * aboard and carried to the station the points are set for. The platform shows which:
 * its colour is that station's. A lever throws the points.
 */
export const RAIL_WORLD: WorldDef = {
  id: 'rail',
  name: { en: 'Railway Town', zh: '铁路小镇' },
  theme: 'railway',
  ruleCard: { en: 'Switch the points, then roll into the station.', zh: '先扳道岔，再进站。' },
  ruleTag: { en: 'TRAINS', zh: '列车' },
  holes: [
    // 1. Teaching: one platform, two stations. The points stand for the west one, which
    //    has nothing on it but the long way round to the other. Throw them and the
    //    train goes east, to the cup.
    {
      id: 'rail-1',
      par: 3,
      tee: [0, 0, 7.5],
      goal: { type: 'cup', position: [6, 0, -6.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-3, 3], max: [3, 9], surface: FLOOR },
        { type: 'wall', from: [-3, 9], to: [3, 9], surface: WALL },
        { type: 'wall', from: [-3, 3], to: [-3, 9], surface: WALL },
        { type: 'wall', from: [3, 9], to: [3, 3], surface: WALL },
        ...wallWithDoors([-3, 3], [3, 3], [[2.4, 3.6]], WALL),
        // The two stations, and the footbridge between them
        { type: 'floor', min: [-8, -9], max: [-3, -4], surface: FLOOR },
        { type: 'floor', min: [3, -9], max: [8, -4], surface: FLOOR },
        { type: 'floor', min: [-3, -9], max: [3, -8], surface: FLOOR },
        { type: 'wall', from: [-8, -9], to: [8, -9], surface: WALL },
        { type: 'wall', from: [8, -9], to: [8, -4], surface: WALL },
        { type: 'wall', from: [8, -4], to: [3, -4], surface: WALL },
        { type: 'wall', from: [3, -4], to: [3, -8], surface: WALL },
        { type: 'wall', from: [3, -8], to: [-3, -8], surface: WALL },
        { type: 'wall', from: [-3, -8], to: [-3, -4], surface: WALL },
        { type: 'wall', from: [-3, -4], to: [-8, -4], surface: WALL },
        { type: 'wall', from: [-8, -4], to: [-8, -9], surface: WALL },
      ],
      field: {
        parts: [
          points('points', [2.2, 0, 5.5]),
          train('train', [0, 0, 3.6], [0, 0, 2.3], [
            line([-2.3, 0, -6.5], [-3.8, 0, -6.5], LINE_BLUE, undefined, [[0, 0, -2.5], [-1.4, 0, -4.8]]),
            line([2.3, 0, -6.5], [3.8, 0, -6.5], LINE_ORANGE, 'points', [[0, 0, -2.5], [1.4, 0, -4.8]]),
          ]),
        ],
      },
      decor: [house(-7, 6, 0xd98a5a), house(7, 5, 0x8fb7c9, 3.2), chimney(-6, 0), tank(6.5, -1), house(0, -13, 0xc9b48a)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58 },
    },

    // 2. Variation: two trains, one after the other. The first sets its ball down on
    //    the second's platform, or, with its points as they stand, at the depot; the
    //    second runs on to the cup, or, with its points as they stand, to the depot
    //    too. And from the depot a third train brings the ball home again. Both levers
    //    are by the tee, and one of them starts thrown.
    {
      id: 'rail-2',
      par: 5,
      tee: [0, 0, 8.8],
      goal: { type: 'cup', position: [1.5, 0, -11.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 4, text: { en: 'Finish in four strokes', zh: '四杆完成' } },
      pieces: [
        { type: 'floor', min: [-3, 4], max: [3, 10], surface: FLOOR },
        { type: 'wall', from: [-3, 10], to: [3, 10], surface: WALL },
        { type: 'wall', from: [-3, 4], to: [-3, 10], surface: WALL },
        { type: 'wall', from: [3, 10], to: [3, 4], surface: WALL },
        ...wallWithDoors([-3, 4], [3, 4], [[2.4, 3.6]], WALL),
        // The halt where the trains meet, and the depot
        { type: 'floor', min: [-1, -3], max: [1, -1], surface: FLOOR },
        { type: 'floor', min: [6, -4], max: [9, -1], surface: FLOOR },
        // The station with the cup
        ...walledRoom([-3, -13], [3, -8], FLOOR, WALL),
      ],
      field: {
        parts: [
          points('first', [-2.2, 0, 6.5]),
          points('second', [2.2, 0, 6.5], true),
          train('local', [0, 0, 4.6], [0, 0, 3.3], [
            line([5.3, 0, -1.8], [6.8, 0, -2.5], LINE_BLUE, undefined, [[0, 0, 1.5], [4, 0, -1]]),
            line([0, 0, -0.3], [0, 0, -1.7], LINE_ORANGE, 'first'),
          ]),
          train('express', [0, 0, -1.7], [0, 0, -3.7], [
            line([0, 0, -7.3], [0, 0, -8.7], LINE_ORANGE),
            line([5.3, 0, -3.2], [6.8, 0, -2.5], LINE_BLUE, 'second', [[2, 0, -4.6]]),
          ]),
          train('home', [6.8, 0, -2.5], [7.5, 0, -0.3], [
            line([3.7, 0, 8.5], [2.2, 0, 8.5], LINE_PINK, undefined, [[7.5, 0, 6.5], [5.5, 0, 8.5]]),
          ]),
        ],
      },
      decor: [house(-7, 7, 0x8fb7c9), house(-6.5, -3, 0xd98a5a, 3.4), chimney(-6, -9), tank(8, -9), house(8.5, 12, 0xc9b48a)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 34 },
    },

    // 3. Challenge: the way to the platform is over a level crossing, and a train on a
    //    line of its own goes through it and comes back, again and again. Get across
    //    between two passes, and onto the platform, with the points already thrown.
    {
      id: 'rail-3',
      par: 4,
      tee: [0, 0, 8.5],
      goal: { type: 'cup', position: [-5, 0, -9.5], ...CUP },
      challenge: { type: 'noMoverHits', text: { en: 'Never touch the passing train', zh: '不碰过路的列车' } },
      pieces: [
        { type: 'floor', min: [-3, -2.5], max: [3, 10], surface: FLOOR },
        { type: 'wall', from: [-3, 10], to: [3, 10], surface: WALL },
        // Both sides are open at the crossing, for the train to come through.
        { type: 'wall', from: [-3, 4.2], to: [-3, 10], surface: WALL },
        { type: 'wall', from: [3, 10], to: [3, 4.2], surface: WALL },
        { type: 'wall', from: [-3, -2.5], to: [-3, 0.8], surface: WALL },
        { type: 'wall', from: [3, 0.8], to: [3, -2.5], surface: WALL },
        ...wallWithDoors([-3, -2.5], [3, -2.5], [[2.4, 3.6]], WALL),
        // The two stations beyond, and the footbridge between them
        { type: 'floor', min: [-7, -12], max: [-2, -7], surface: FLOOR },
        { type: 'floor', min: [2, -12], max: [7, -7], surface: FLOOR },
        { type: 'floor', min: [-2, -12], max: [2, -11], surface: FLOOR },
        { type: 'wall', from: [-7, -12], to: [7, -12], surface: WALL },
        { type: 'wall', from: [7, -12], to: [7, -7], surface: WALL },
        { type: 'wall', from: [7, -7], to: [2, -7], surface: WALL },
        { type: 'wall', from: [2, -7], to: [2, -11], surface: WALL },
        { type: 'wall', from: [2, -11], to: [-2, -11], surface: WALL },
        { type: 'wall', from: [-2, -11], to: [-2, -7], surface: WALL },
        { type: 'wall', from: [-2, -7], to: [-7, -7], surface: WALL },
        { type: 'wall', from: [-7, -7], to: [-7, -12], surface: WALL },
      ],
      movers: [
        passingTrain(2.5, -9, 9, 6, [
          [0, 0, 4.7],
          [0, 0, 0.3],
        ]),
      ],
      field: {
        parts: [
          points('points', [-2.2, 0, 6.5]),
          train('train', [0, 0, -1.5], [0, 0, -3.2], [
            line([1.3, 0, -9.5], [2.8, 0, -9.5], LINE_BLUE, undefined, [[0, 0, -5.8], [1, 0, -7.8]]),
            line([-1.3, 0, -9.5], [-2.8, 0, -9.5], LINE_ORANGE, 'points', [[0, 0, -5.8], [-1, 0, -7.8]]),
          ]),
        ],
      },
      decor: [
        // The line the passing train runs on, through the crossing and out of sight either way
        { type: 'track', at: [0, 0, 2.5], size: [24, 3.6, 0] },
        house(-8, 7.5, 0xd98a5a),
        house(8, 8, 0x8fb7c9, 3.2),
        chimney(7, -3),
        tank(-8, -3),
        house(0, -16, 0xc9b48a),
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 34 },
    },
  ],
};
