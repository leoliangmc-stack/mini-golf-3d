import type { Vec2, Vec3 } from '../../core/types';
import type { KeyColor, PartDef } from '../../level/field';
import type { DecorDef, WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';
import { patrol } from './den';
import { doorway, wallWithDoors } from './ruins';

const FLOOR = 'flagstone';
const WALL = 'masonry';

/** A key on the ground. */
export const key = (id: string, at: Vec3, color: KeyColor): PartDef => ({ kind: 'key', id, at, color });
/** A locked door in the doorway `door` cut by `wallWithDoors` in the wall from `from` to `to`. */
export const lockedDoor = (id: string, from: Vec2, to: Vec2, door: readonly [number, number], color: KeyColor): PartDef => ({
  kind: 'door',
  id,
  ...doorway(from, to, door),
  color,
});

const DEEP = -3.6;
const pillar = (x: number, z: number, height = 3): DecorDef => ({ type: 'column', at: [x, DEEP, z], size: [0.5, height, 0], color: 0x5b5663 });
const block = (x: number, z: number): DecorDef => ({ type: 'crate', at: [x, DEEP, z], size: [1.6, 2.2, 1.6], color: 0x4a4650 });

/**
 * World 37: the dungeon (SPEC v9 3.5). A ball that rolls over a key takes it; a door
 * of that key's colour opens as the ball arrives, and the key is spent. One key, one
 * door.
 */
export const DUNGEON_WORLD: WorldDef = {
  id: 'dungeon',
  name: { en: 'Dungeon', zh: '地牢' },
  theme: 'dungeon',
  ruleCard: {
    en: 'Roll over a key to take it. A key opens one door of its colour.',
    zh: '滚过钥匙就能拿到，一把钥匙开一扇同色的门。',
  },
  ruleTag: { en: 'KEYS', zh: '钥匙' },
  holes: [
    // 1. Teaching: the key lies to one side of the first room; the door to the cup is
    //    straight ahead. Key first.
    {
      id: 'dungeon-1',
      par: 3,
      tee: [0, 0, 6],
      goal: { type: 'cup', position: [0, 0, -5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-3, 0], max: [3, 7.5], surface: FLOOR },
        { type: 'wall', from: [-3, 7.5], to: [3, 7.5], surface: WALL },
        { type: 'wall', from: [3, 7.5], to: [3, 0], surface: WALL },
        { type: 'wall', from: [-3, 0], to: [-3, 7.5], surface: WALL },
        ...wallWithDoors([-3, 0], [3, 0], [[2.4, 3.6]], WALL, { height: 0.8 }),
        { type: 'floor', min: [-2, -6.5], max: [2, 0], surface: FLOOR },
        { type: 'wall', from: [-2, 0], to: [-2, -6.5], surface: WALL },
        { type: 'wall', from: [-2, -6.5], to: [2, -6.5], surface: WALL },
        { type: 'wall', from: [2, -6.5], to: [2, 0], surface: WALL },
      ],
      field: {
        parts: [key('key', [-2, 0, 3], 'red'), lockedDoor('door', [-3, 0], [3, 0], [2.4, 3.6], 'red')],
      },
      decor: [pillar(-5, 6), pillar(5, 6), block(5, 1), pillar(-4, -5, 2.4), pillar(4, -5, 2.4)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 30 },
    },

    // 2. Variation: two red doors and one red key. Behind one is the blue key, behind
    //    the other a dead end that looks like the way; the cup is behind a blue door.
    //    Open the wrong red door and the key is gone with it.
    {
      id: 'dungeon-2',
      par: 5,
      tee: [0, 0, 2],
      goal: { type: 'cup', position: [0, 0, -7], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 4, text: { en: 'Finish in four strokes', zh: '四杆完成' } },
      pieces: [
        // The middle room
        { type: 'floor', min: [-3, -3], max: [3, 3], surface: FLOOR },
        { type: 'wall', from: [-3, 3], to: [3, 3], surface: WALL },
        ...wallWithDoors([3, 3], [3, -3], [[2.4, 3.6]], WALL, { height: 0.8 }),
        ...wallWithDoors([-3, -3], [-3, 3], [[2.4, 3.6]], WALL, { height: 0.8 }),
        ...wallWithDoors([-3, -3], [3, -3], [[2.4, 3.6]], WALL, { height: 0.8 }),
        // West: the blue key
        { type: 'floor', min: [-8, -2], max: [-3, 2], surface: FLOOR },
        { type: 'wall', from: [-8, 2], to: [-3, 2], surface: WALL },
        { type: 'wall', from: [-8, -2], to: [-8, 2], surface: WALL },
        { type: 'wall', from: [-3, -2], to: [-8, -2], surface: WALL },
        // East: nothing
        { type: 'floor', min: [3, -2], max: [8, 2], surface: FLOOR },
        { type: 'wall', from: [3, 2], to: [8, 2], surface: WALL },
        { type: 'wall', from: [8, 2], to: [8, -2], surface: WALL },
        { type: 'wall', from: [8, -2], to: [3, -2], surface: WALL },
        // North: the cup
        { type: 'floor', min: [-2, -8.5], max: [2, -3], surface: FLOOR },
        { type: 'wall', from: [-2, -3], to: [-2, -8.5], surface: WALL },
        { type: 'wall', from: [-2, -8.5], to: [2, -8.5], surface: WALL },
        { type: 'wall', from: [2, -8.5], to: [2, -3], surface: WALL },
      ],
      field: {
        parts: [
          key('red', [-2, 0, 2.2], 'red'),
          key('blue', [-6.5, 0, 0], 'blue'),
          lockedDoor('west', [-3, -3], [-3, 3], [2.4, 3.6], 'red'),
          lockedDoor('east', [3, 3], [3, -3], [2.4, 3.6], 'red'),
          lockedDoor('north', [-3, -3], [3, -3], [2.4, 3.6], 'blue'),
        ],
      },
      decor: [pillar(-5, 5), pillar(5, 5), block(-10, 0), block(10, 0), pillar(-4, -7, 2.4), pillar(4, -7, 2.4)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 60, maxDistance: 34, keep: [[-7, 0, 0], [7, 0, 0]] },
    },

    // 3. Challenge: three rooms in a row. The key lies in the middle one, where a
    //    monster walks up and down over it; the door to the cup is at the far end.
    {
      id: 'dungeon-3',
      par: 4,
      tee: [0, 0, 8],
      goal: { type: 'cup', position: [0, 0, -8], ...CUP },
      challenge: { type: 'noCaught', text: { en: 'Never get caught', zh: '一次都不被抓' } },
      pieces: [
        { type: 'floor', min: [-2.5, 4], max: [2.5, 9.5], surface: FLOOR },
        { type: 'wall', from: [-2.5, 9.5], to: [2.5, 9.5], surface: WALL },
        { type: 'wall', from: [2.5, 9.5], to: [2.5, 4], surface: WALL },
        { type: 'wall', from: [-2.5, 4], to: [-2.5, 9.5], surface: WALL },
        ...wallWithDoors([-2.5, 4], [2.5, 4], [[1.9, 3.1]], WALL),
        // The guard room
        { type: 'floor', min: [-3.5, -3], max: [3.5, 4], surface: FLOOR },
        { type: 'wall', from: [-3.5, 4], to: [-2.5, 4], surface: WALL },
        { type: 'wall', from: [2.5, 4], to: [3.5, 4], surface: WALL },
        { type: 'wall', from: [3.5, 4], to: [3.5, -3], surface: WALL },
        { type: 'wall', from: [-3.5, -3], to: [-3.5, 4], surface: WALL },
        ...wallWithDoors([-3.5, -3], [3.5, -3], [[2.9, 4.1]], WALL, { height: 0.8 }),
        // The far room
        { type: 'floor', min: [-2, -9.5], max: [2, -3], surface: FLOOR },
        { type: 'wall', from: [-2, -3], to: [-2, -9.5], surface: WALL },
        { type: 'wall', from: [-2, -9.5], to: [2, -9.5], surface: WALL },
        { type: 'wall', from: [2, -9.5], to: [2, -3], surface: WALL },
      ],
      field: {
        grid: { origin: [-3, -2], cols: 7, rows: 6 },
        parts: [
          key('key', [-1, 0, 0], 'gold'),
          patrol('guard', [[2, 5], [2, 4], [2, 3], [2, 2], [2, 1], [2, 0]]),
          lockedDoor('door', [-3.5, -3], [3.5, -3], [2.9, 4.1], 'gold'),
        ],
      },
      decor: [pillar(-4.5, 8), pillar(4.5, 8), block(6, 0), block(-6, 1), pillar(-4, -8, 2.4), pillar(4, -8, 2.4)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 36 },
    },
  ],
};
