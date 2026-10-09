import type { Vec2 } from '../../core/types';
import type { PartDef } from '../../level/field';
import type { DecorDef, PieceDef, WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';
import { wallWithDoors } from './ruins';

const FLOOR = 'lawn';
const WALL = 'hedge';
/** Half the width of a garden room, how far a rotor's arms reach in one, and where the hedge stubs they meet stop. */
export const ROOM = 3;
export const ARM = 2.2;
const STUB = 2.25;

/** A group of walls on a pivot in the middle of a room. `arms` are the compass headings they start along. */
export const rotor = (id: string, at: Vec2, arms: readonly number[], length = ARM): PartDef => ({
  kind: 'rotor',
  id,
  at: [at[0], 0, at[1]],
  arms,
  length,
});

/**
 * The four stubs of hedge in a room, one from the middle of each wall toward the
 * pivot. An arm that points at one closes the gap between it and the pivot, so the arms
 * of a rotor divide a room into quarters, or halves, as they stand.
 */
export function stubs([cx, cz]: Vec2, y = 0): PieceDef[] {
  const stub = (from: Vec2, to: Vec2): PieceDef => ({ type: 'wall', from, to, y, surface: WALL });
  return [
    stub([cx, cz - ROOM], [cx, cz - STUB]),
    stub([cx, cz + STUB], [cx, cz + ROOM]),
    stub([cx - ROOM, cz], [cx - STUB, cz]),
    stub([cx + STUB, cz], [cx + ROOM, cz]),
  ];
}

/** The garden beyond the hedges: trees and bushes. */
const FLOOR_Y = -3.6;
const tree = (x: number, z: number, height = 4.6): DecorDef => ({ type: 'pine', at: [x, FLOOR_Y, z], size: [height * 0.27, height, 0] });
const shrub = (x: number, z: number): DecorDef => ({ type: 'bush', at: [x, FLOOR_Y, z], size: [1.6, 0, 0] });

/**
 * World 30: walls that turn (SPEC v7 3.5). A tap on a glowing group of walls gives it a
 * quarter turn. Only while the ball is at rest, only so many times a hole, and never a
 * group the ball is lying under the arms of. A turn is not a stroke.
 */
export const MAZE_WORLD: WorldDef = {
  id: 'maze',
  name: { en: 'Maze Course', zh: '迷宫球场' },
  theme: 'garden',
  ruleCard: { en: 'Tap a glowing wall to turn it. Turns are limited.', zh: '点亮起的墙可以转动，次数有限。' },
  ruleTag: { en: 'TURNING WALLS', zh: '旋转墙' },
  holes: [
    // 1. Teaching: a gate across the lane, hinged at one side. One tap swings it back
    //    against the hedge, and the way is open. There are two turns, in case.
    {
      id: 'maze-1',
      par: 2,
      tee: [0, 0, 6.5],
      goal: { type: 'cup', position: [0, 0, -6.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: [
        { type: 'floor', min: [-1.5, -8], max: [1.5, 8], surface: FLOOR },
        { type: 'wall', from: [-1.5, 8], to: [1.5, 8], surface: WALL },
        { type: 'wall', from: [1.5, 8], to: [1.5, -8], surface: WALL },
        { type: 'wall', from: [1.5, -8], to: [-1.5, -8], surface: WALL },
        { type: 'wall', from: [-1.5, -8], to: [-1.5, 8], surface: WALL },
      ],
      field: { turns: 2, parts: [rotor('gate', [-1.4, 0], [90], 2.75)] },
      decor: [tree(-5, 5), tree(5.5, 1), shrub(-4.5, -3), shrub(4.5, -6), tree(-5.5, -8, 3.8)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: three rooms round a corner, a group of walls in each. Each has to
    //    stand one particular way for the ball to get from the door it comes in by to
    //    the door it goes out by, and there are four turns for the three of them.
    {
      id: 'maze-2',
      par: 5,
      tee: [-5, 0, 5],
      goal: { type: 'cup', position: [5, 0, -1], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 4, text: { en: 'Finish in four strokes', zh: '四杆完成' } },
      pieces: [
        { type: 'floor', min: [-6, -6], max: [0, 6], surface: FLOOR },
        { type: 'floor', min: [0, -6], max: [6, 0], surface: FLOOR },
        { type: 'wall', from: [-6, -6], to: [-6, 6], surface: WALL },
        { type: 'wall', from: [-6, 6], to: [0, 6], surface: WALL },
        { type: 'wall', from: [0, 6], to: [0, 0], surface: WALL },
        { type: 'wall', from: [0, 0], to: [6, 0], surface: WALL },
        { type: 'wall', from: [6, 0], to: [6, -6], surface: WALL },
        { type: 'wall', from: [6, -6], to: [-6, -6], surface: WALL },
        // Between the first room and the second, and between the second and the third
        ...wallWithDoors([-6, 0], [0, 0], [[3.9, 5.1]], WALL),
        ...wallWithDoors([0, -6], [0, 0], [[0.9, 2.1]], WALL),
        ...stubs([-3, 3]),
        ...stubs([-3, -3]),
        ...stubs([3, -3]),
      ],
      field: {
        turns: 4,
        parts: [rotor('first', [-3, 3], [0, 90]), rotor('second', [-3, -3], [90, 270]), rotor('third', [3, -3], [90, 180])],
      },
      decor: [tree(-9.5, 4), tree(4, 4.5), shrub(8.5, -8), tree(-9, -6, 3.8), shrub(3, 9), tree(9.5, 2)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 62 },
    },

    // 3. Challenge: two rooms and two turns. In the first the walls are a revolving
    //    door: the ball has to be moved into the right half of the room before the
    //    door is turned, and wait clear of the arms while it turns. In the second the
    //    same again, with three arms.
    {
      id: 'maze-3',
      par: 5,
      tee: [-5.3, 0, 2.3],
      goal: { type: 'cup', position: [4.5, 0, 2.2], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 4, text: { en: 'Finish in four strokes', zh: '四杆完成' } },
      pieces: [
        { type: 'floor', min: [-6, -3], max: [6, 3], surface: FLOOR },
        { type: 'wall', from: [-6, 3], to: [6, 3], surface: WALL },
        { type: 'wall', from: [6, 3], to: [6, -3], surface: WALL },
        { type: 'wall', from: [6, -3], to: [-6, -3], surface: WALL },
        { type: 'wall', from: [-6, -3], to: [-6, 3], surface: WALL },
        ...wallWithDoors([0, -3], [0, 3], [[0.9, 2.1]], WALL),
        ...stubs([-3, 0]),
        ...stubs([3, 0]),
      ],
      field: {
        turns: 2,
        parts: [rotor('door', [-3, 0], [0, 180]), rotor('tee', [3, 0], [90, 180, 270])],
      },
      decor: [tree(-9.5, 0), tree(9.5, -1), shrub(-3, 6.5), shrub(3, -6.5), tree(0, 8, 3.8), tree(-1, -8)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 62 },
    },
  ],
};
