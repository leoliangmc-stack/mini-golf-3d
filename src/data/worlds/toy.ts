import type { Vec2, Vec3 } from '../../core/types';
import type { PartDef, When } from '../../level/field';
import type { DecorDef, PieceDef, WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';

const FLOOR = 'toyFloor';
const WALL = 'toyBlockRed';
const TRIM = 'toyBlock';
/** How fast every belt of the chapter runs, in m/s. A ball on one settles at about four fifths of it. */
export const BELT_SPEED = 3;

/** The floor under a belt. A belt is laid over a piece of ground of its own size. */
export const beltFloor = (min: Vec2, max: Vec2, y = 0): PieceDef => ({ type: 'floor', min, max, y, surface: 'belt' });

/** A conveyor belt that runs `toward` ([x, z], one of them zero) until `when` is on, and the other way while it is. */
export const belt = (id: string, min: Vec2, max: Vec2, toward: Vec2, when?: When, y = 0): PartDef => ({
  kind: 'belt',
  id,
  min,
  max,
  y,
  velocity: [toward[0] * BELT_SPEED, toward[1] * BELT_SPEED],
  ...(when === undefined ? {} : { when }),
});

/** The switch of a belt: a lever on a post. A knock throws it, and the next throws it back. */
export const lever = (id: string, at: Vec3): PartDef => ({ kind: 'valve', id, at, look: 'lever' });

/** The shop floor is a long way down. What stands on it: stacks of crates, and cogs lying about. */
const FLOOR_Y = -3.6;
const stack = (x: number, z: number, color: number, height = 3.2): DecorDef => ({
  type: 'crate',
  at: [x, FLOOR_Y, z],
  size: [2, height, 2],
  color,
});
const cog = (x: number, z: number, color: number, radius = 2.2): DecorDef => ({
  type: 'gear',
  at: [x, FLOOR_Y + 0.05, z],
  size: [radius, 0, 0],
  color,
});

/**
 * World 23: conveyor belts (SPEC v6 3.2). A belt carries the ball whichever way it
 * runs, and a knock on its lever turns it round. The ball is never changed: the
 * machine is.
 */
export const TOY_WORLD: WorldDef = {
  id: 'toy',
  name: { en: 'Toy Factory', zh: '玩具工厂' },
  theme: 'toy',
  ruleCard: { en: 'Hit a switch to reverse the belt.', zh: '撞开关，输送带反转。' },
  ruleTag: { en: 'BELTS', zh: '输送带' },
  holes: [
    // 1. Teaching: one belt between the tee and the cup, running the wrong way. Nothing
    //    gets up it. Throw the lever and it carries the ball down to a funnel at the cup.
    {
      id: 'toy-1',
      par: 3,
      tee: [0, 0, 6.5],
      goal: { type: 'cup', position: [0, 0, -6.8], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-2.5, 3], max: [2.5, 8], surface: FLOOR },
        beltFloor([-1.5, -5], [1.5, 3]),
        { type: 'floor', min: [-1.5, -8], max: [1.5, -5], surface: FLOOR },
        { type: 'wall', from: [-2.5, 8], to: [2.5, 8], surface: WALL },
        { type: 'wall', from: [-2.5, 3], to: [-2.5, 8], surface: WALL },
        { type: 'wall', from: [2.5, 8], to: [2.5, 3], surface: WALL },
        { type: 'wall', from: [-2.5, 3], to: [-1.5, 3], surface: WALL },
        { type: 'wall', from: [1.5, 3], to: [2.5, 3], surface: WALL },
        { type: 'wall', from: [-1.5, 3], to: [-1.5, -8], surface: TRIM },
        { type: 'wall', from: [1.5, -8], to: [1.5, 3], surface: TRIM },
        { type: 'wall', from: [-1.5, -8], to: [1.5, -8], surface: WALL },
        // The funnel, and the pocket the cup lies in
        { type: 'wall', from: [-1.5, -5.5], to: [-0.5, -6.5], surface: WALL },
        { type: 'wall', from: [0.5, -6.5], to: [1.5, -5.5], surface: WALL },
        { type: 'wall', from: [-0.5, -6.5], to: [-0.5, -8], surface: WALL },
        { type: 'wall', from: [0.5, -8], to: [0.5, -6.5], surface: WALL },
      ],
      field: {
        parts: [lever('lever', [1.7, 0, 4.4]), belt('belt', [-1.5, -5], [1.5, 3], [0, 1], 'lever')],
      },
      decor: [stack(-5, 6, 0xf2c14e), stack(-5.4, 3.4, 0x4f9fe0, 2.2), cog(5, -1, 0xe2574c), cog(-5, -4, 0xf2c14e, 1.7)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: two belts that meet. The first leads up to the second, and the
    //    second runs either to the cup or off the end of the line into the bin. Each has
    //    a lever, and both start the wrong way.
    {
      id: 'toy-2',
      par: 4,
      tee: [0, 0, 6.5],
      goal: { type: 'cup', position: [5.6, 0, -5.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        { type: 'floor', min: [-4, 2], max: [4, 8], surface: FLOOR },
        beltFloor([-1, -5], [1, 2]),
        beltFloor([-4, -7], [4, -5]),
        { type: 'floor', min: [4, -8.5], max: [8, -3.5], surface: FLOOR },
        // The room the ball starts in
        { type: 'wall', from: [-4, 8], to: [4, 8], surface: WALL },
        { type: 'wall', from: [-4, 2], to: [-4, 8], surface: WALL },
        { type: 'wall', from: [4, 8], to: [4, 2], surface: WALL },
        { type: 'wall', from: [-4, 2], to: [-1, 2], surface: WALL },
        { type: 'wall', from: [1, 2], to: [4, 2], surface: WALL },
        // The first belt, and the second across the top of it. Its west end is open.
        { type: 'wall', from: [-1, 2], to: [-1, -5], surface: TRIM },
        { type: 'wall', from: [1, -5], to: [1, 2], surface: TRIM },
        { type: 'wall', from: [-4, -7], to: [4, -7], surface: TRIM },
        { type: 'wall', from: [-4, -5], to: [-1, -5], surface: TRIM },
        { type: 'wall', from: [1, -5], to: [4, -5], surface: TRIM },
        // The room with the cup
        { type: 'wall', from: [4, -8.5], to: [8, -8.5], surface: WALL },
        { type: 'wall', from: [8, -8.5], to: [8, -3.5], surface: WALL },
        { type: 'wall', from: [8, -3.5], to: [4, -3.5], surface: WALL },
        { type: 'wall', from: [4, -3.5], to: [4, -5], surface: WALL },
        { type: 'wall', from: [4, -7], to: [4, -8.5], surface: WALL },
      ],
      field: {
        parts: [
          lever('up', [2.7, 0, 3.6]),
          lever('across', [-2.7, 0, 3.6]),
          belt('first', [-1, -5], [1, 2], [0, 1], 'up'),
          belt('second', [-4, -7], [4, -5], [-1, 0], 'across'),
        ],
      },
      decor: [
        // The bin under the open end of the line
        { type: 'crate', at: [-5.8, FLOOR_Y, -6], size: [2.6, 1.8, 3], color: 0x59626d },
        cog(-7, 4.5, 0xf2c14e),
        stack(7, 5.5, 0x4f9fe0),
        stack(7.4, 2.6, 0xe2574c, 2.2),
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58 },
    },

    // 3. Challenge: two levers, and each belt listens to both. The side belt runs in
    //    only while the left lever is thrown and the far one is not; the far lever
    //    stands on its end, so the belt that brings a ball to it takes the ball away
    //    again once it is thrown. The main belt runs to the cup only while the far
    //    lever is thrown and the left one is not. So: left, ride in to the far one,
    //    left again, and go.
    {
      id: 'toy-3',
      par: 5,
      tee: [0, 0, 4.5],
      goal: { type: 'cup', position: [0, 0, -9.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 4, text: { en: 'Finish in four strokes', zh: '四杆完成' } },
      pieces: [
        { type: 'floor', min: [-3, 0], max: [3, 6], surface: FLOOR },
        beltFloor([-1, -8], [1, 0]),
        { type: 'floor', min: [-2, -11.5], max: [2, -8], surface: FLOOR },
        beltFloor([3, 2], [9.5, 4]),
        // The room the ball starts in
        { type: 'wall', from: [-3, 6], to: [3, 6], surface: WALL },
        { type: 'wall', from: [-3, 0], to: [-3, 6], surface: WALL },
        { type: 'wall', from: [3, 6], to: [3, 4], surface: WALL },
        { type: 'wall', from: [3, 2], to: [3, 0], surface: WALL },
        { type: 'wall', from: [-3, 0], to: [-1, 0], surface: WALL },
        { type: 'wall', from: [1, 0], to: [3, 0], surface: WALL },
        // The main belt and the room at its end
        { type: 'wall', from: [-1, 0], to: [-1, -8], surface: TRIM },
        { type: 'wall', from: [1, -8], to: [1, 0], surface: TRIM },
        { type: 'wall', from: [-2, -8], to: [-1, -8], surface: WALL },
        { type: 'wall', from: [1, -8], to: [2, -8], surface: WALL },
        { type: 'wall', from: [-2, -11.5], to: [-2, -8], surface: WALL },
        { type: 'wall', from: [2, -8], to: [2, -11.5], surface: WALL },
        { type: 'wall', from: [-2, -11.5], to: [2, -11.5], surface: WALL },
        // The side belt, with the far lever standing on the end of it
        { type: 'wall', from: [3, 2], to: [9.5, 2], surface: TRIM },
        { type: 'wall', from: [9.5, 4], to: [3, 4], surface: TRIM },
        { type: 'wall', from: [9.5, 2], to: [9.5, 4], surface: WALL },
      ],
      field: {
        parts: [
          lever('left', [-2, 0, 1.4]),
          lever('far', [9, 0, 3]),
          belt('side', [3, 2], [9.5, 4], [-1, 0], { all: ['left'], none: ['far'] }),
          belt('main', [-1, -8], [1, 0], [0, 1], { all: ['far'], none: ['left'] }),
        ],
      },
      decor: [cog(-6, 3, 0xf2c14e), stack(6, 7.5, 0x4f9fe0), stack(5, -4, 0xe2574c, 2.4), cog(-5, -7, 0x4f9fe0, 1.7)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58 },
    },
  ],
};
