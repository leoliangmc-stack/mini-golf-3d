import type { Vec2, Vec3 } from '../../core/types';
import type { DecorDef, MoverDef, PhantomDef, WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';
import { wallWithDoors } from './ruins';

const FLOOR = 'voidstone';
const WALL = 'voidWall';
/** The banks are tall: there is a long way down between them. */
const TALL = 3;
/** How thick a bridge is, how far its top stands above the ground it joins, and how far it reaches under that ground at each end. */
const THICK = 0.3;
const LIFT = 0.004;
const LAP = 0.1;

/**
 * A bridge that comes and goes (SPEC v8 3.2), from one point on the ground to another
 * and `width` across. It is a platform like any other (physics/movers.ts): a hair
 * proud of the ground, and reaching a little under it at both ends.
 */
export function phantomBridge(
  from: Vec2,
  to: Vec2,
  width: number,
  phantom: PhantomDef,
  rest?: readonly Vec3[],
  y = 0,
): MoverDef {
  const alongZ = from[0] === to[0];
  const length = (alongZ ? Math.abs(to[1] - from[1]) : Math.abs(to[0] - from[0])) + 2 * LAP;
  return {
    role: 'platform',
    size: alongZ ? [width, THICK, length] : [length, THICK, width],
    position: [(from[0] + to[0]) / 2, y + LIFT - THICK / 2, (from[1] + to[1]) / 2],
    surface: 'phantom',
    // It goes nowhere: all it does is come and go.
    motion: { type: 'slide', offset: [0, 0, 0], period: 1 },
    phantom,
    rest,
  };
}

/** What stands in the dark below: shards and broken columns. */
const DEEP = -3.6;
const shard = (x: number, z: number, height = 6): DecorDef => ({ type: 'obelisk', at: [x, DEEP, z], size: [1.3, height, 0], color: 0x4a3f8f });
const gems = (x: number, z: number): DecorDef => ({ type: 'crystals', at: [x, DEEP, z], size: [2.2, 0, 0], color: 0x7ff0e0 });

/**
 * World 31: bridges that come and go (SPEC v8 3.2). A phantom bridge is there for a
 * while and then is not, on the hole's clock, and gives fair warning before it goes.
 * A ball that stops on one of the first two holes' bridges is set down on the bank;
 * on the third the bridge keeps it, and takes it down.
 */
export const PHANTOM_WORLD: WorldDef = {
  id: 'phantom',
  name: { en: 'Phantom Bridges', zh: '幻影桥' },
  theme: 'phantom',
  ruleCard: {
    en: "Phantom bridges come and go. Don't stop on them.",
    zh: '幻影桥时隐时现，别停在上面。',
  },
  ruleTag: { en: 'PHANTOM BRIDGES', zh: '幻影桥' },
  holes: [
    // 1. Teaching: one bridge, the cup straight across. Wait for it, then go.
    {
      id: 'phantom-1',
      par: 2,
      tee: [0, 0, 7],
      goal: { type: 'cup', position: [0, 0, -5.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: [
        { type: 'floor', min: [-2.5, 3], max: [2.5, 9], depth: TALL, surface: FLOOR },
        { type: 'wall', from: [-2.5, 9], to: [2.5, 9], surface: WALL },
        { type: 'wall', from: [-2.5, 3], to: [-2.5, 9], surface: WALL },
        { type: 'wall', from: [2.5, 9], to: [2.5, 3], surface: WALL },
        ...wallWithDoors([-2.5, 3], [2.5, 3], [[1.6, 3.4]], WALL),
        { type: 'floor', min: [-2.5, -8], max: [2.5, -2], depth: TALL, surface: FLOOR },
        ...wallWithDoors([-2.5, -2], [2.5, -2], [[1.6, 3.4]], WALL),
        { type: 'wall', from: [-2.5, -8], to: [2.5, -8], height: 0.8, surface: WALL },
        { type: 'wall', from: [-2.5, -8], to: [-2.5, -2], surface: WALL },
        { type: 'wall', from: [2.5, -2], to: [2.5, -8], surface: WALL },
      ],
      movers: [
        phantomBridge([0, 3], [0, -2], 1.8, { period: 5, shown: 0.55 }, [
          [0, 0, 3.8],
          [0, 0, -2.8],
        ]),
      ],
      decor: [shard(-5.5, 5), gems(5, 1), shard(5.5, -6, 7), gems(-5, -4)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: two bridges, and never both at once. As the first goes the second
    //    comes: cross one, wait on the island, cross the other. Or be on the island at
    //    the very moment they change over, and do it in one.
    {
      id: 'phantom-2',
      par: 3,
      tee: [0, 0, 9.5],
      goal: { type: 'cup', position: [1.2, 0, -8], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-2.5, 7], max: [2.5, 11.5], depth: TALL, surface: FLOOR },
        { type: 'wall', from: [-2.5, 11.5], to: [2.5, 11.5], surface: WALL },
        { type: 'wall', from: [-2.5, 7], to: [-2.5, 11.5], surface: WALL },
        { type: 'wall', from: [2.5, 11.5], to: [2.5, 7], surface: WALL },
        ...wallWithDoors([-2.5, 7], [2.5, 7], [[1.6, 3.4]], WALL),
        // The island between
        { type: 'floor', min: [-2.5, -1], max: [2.5, 3], depth: TALL, surface: FLOOR },
        ...wallWithDoors([-2.5, 3], [2.5, 3], [[1.6, 3.4]], WALL),
        ...wallWithDoors([-2.5, -1], [2.5, -1], [[1.6, 3.4]], WALL),
        { type: 'wall', from: [-2.5, -1], to: [-2.5, 3], surface: WALL },
        { type: 'wall', from: [2.5, 3], to: [2.5, -1], surface: WALL },
        // The far bank
        { type: 'floor', min: [-2.5, -10], max: [2.5, -5], depth: TALL, surface: FLOOR },
        ...wallWithDoors([-2.5, -5], [2.5, -5], [[1.6, 3.4]], WALL),
        { type: 'wall', from: [-2.5, -10], to: [2.5, -10], height: 0.8, surface: WALL },
        { type: 'wall', from: [-2.5, -10], to: [-2.5, -5], surface: WALL },
        { type: 'wall', from: [2.5, -5], to: [2.5, -10], surface: WALL },
      ],
      movers: [
        phantomBridge([0, 7], [0, 3], 1.8, { period: 5, shown: 0.5 }, [
          [0, 0, 7.8],
          [0, 0, 2.2],
        ]),
        phantomBridge([0, -1], [0, -5], 1.8, { period: 5, shown: 0.5, phase: 0.5 }, [
          [0, 0, -0.2],
          [0, 0, -5.8],
        ]),
      ],
      decor: [shard(-5.5, 9), gems(5, 5), shard(5.5, 0, 7), gems(-5, -3), shard(-5.5, -8, 5), gems(5, -8)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 32 },
    },

    // 3. Challenge: a run of bridges that keep what stops on them, coming and going one
    //    after another like a wave. Ride the wave to the island, where the dust will
    //    stop a ball; then round the corner on two more, to the cup.
    {
      id: 'phantom-3',
      par: 3,
      tee: [0, 0, 11],
      goal: { type: 'cup', position: [10.2, 0, -1.5], ...CUP },
      challenge: { type: 'noOutOfBounds', text: { en: 'Never fall', zh: '一次都不掉下去' } },
      pieces: [
        { type: 'floor', min: [-2, 9], max: [2, 13], depth: TALL, surface: FLOOR },
        { type: 'wall', from: [-2, 13], to: [2, 13], surface: WALL },
        { type: 'wall', from: [-2, 9], to: [-2, 13], surface: WALL },
        { type: 'wall', from: [2, 13], to: [2, 9], surface: WALL },
        ...wallWithDoors([-2, 9], [2, 9], [[1.1, 2.9]], WALL),
        // The island: dust to stop in, and a wall behind it
        { type: 'floor', min: [-2, -3], max: [2, 0], depth: TALL, surface: 'ash' },
        ...wallWithDoors([-2, 0], [2, 0], [[1.1, 2.9]], WALL),
        { type: 'wall', from: [-2, -3], to: [2, -3], height: 0.8, surface: WALL },
        { type: 'wall', from: [-2, -3], to: [-2, 0], surface: WALL },
        ...wallWithDoors([2, 0], [2, -3], [[0.6, 2.4]], WALL),
        // The far bank, round the corner
        { type: 'floor', min: [8, -4], max: [12.5, 1], depth: TALL, surface: FLOOR },
        ...wallWithDoors([8, 1], [8, -4], [[1.6, 3.4]], WALL),
        { type: 'wall', from: [8, 1], to: [12.5, 1], surface: WALL },
        { type: 'wall', from: [12.5, 1], to: [12.5, -4], height: 0.8, surface: WALL },
        { type: 'wall', from: [12.5, -4], to: [8, -4], surface: WALL },
      ],
      movers: [
        phantomBridge([0, 9], [0, 6], 1.8, { period: 4.8, shown: 0.5, holds: true }),
        phantomBridge([0, 6], [0, 3], 1.8, { period: 4.8, shown: 0.5, phase: 0.875, holds: true }),
        phantomBridge([0, 3], [0, 0], 1.8, { period: 4.8, shown: 0.5, phase: 0.75, holds: true }),
        phantomBridge([2, -1.5], [5, -1.5], 1.8, { period: 4.8, shown: 0.5, phase: 0.5, holds: true }),
        phantomBridge([5, -1.5], [8, -1.5], 1.8, { period: 4.8, shown: 0.5, phase: 0.375, holds: true }),
      ],
      decor: [shard(-5, 10), gems(4.5, 7), shard(-4.5, 2, 7), gems(5, 3.5), shard(5, -6, 5), gems(-5, -5), shard(14.5, -6, 7), gems(10, 4)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 36 },
    },
  ],
};
