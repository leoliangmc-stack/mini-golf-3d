import type { Vec3 } from '../../core/types';
import type { PartDef } from '../../level/field';
import type { DecorDef, WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';
import { wallWithDoors } from './ruins';

const FLOOR = 'boards2';
const WALL = 'panel';
/** What the ghost world is made of. */
const GHOST_WALL = 'ectoplasm';
const GHOST_FLOOR = 'ectoFloor';
/** The banks are tall where there is a pit between them. */
const TALL = 3;

/** A lever on a post: a knock swaps the worlds. */
export const swapLever = (id: string, at: Vec3): PartDef => ({ kind: 'valve', id, at, look: 'lever' });

const DEEP = -3.6;
const column = (x: number, z: number, height = 2.8): DecorDef => ({ type: 'column', at: [x, DEEP, z], size: [0.45, height, 0], color: 0x5a4a52 });
const tomb = (x: number, z: number): DecorDef => ({ type: 'obelisk', at: [x, DEEP, z], size: [1.1, 2.6, 0], color: 0x6e6676 });

/**
 * World 35: the haunted house (SPEC v9 3.3). Two worlds stand in one place, the real
 * one and the ghost one, and only one of them is solid at a time; a knock on a lever
 * swaps them. The rest of the house is in both.
 */
export const HAUNTED_WORLD: WorldDef = {
  id: 'haunted',
  name: { en: 'Haunted House', zh: '鬼屋' },
  theme: 'haunted',
  ruleCard: {
    en: 'Hit the lever to swap worlds. Only one is solid.',
    zh: '撞拨杆切换两个世界，只有一个是实体。',
  },
  ruleTag: { en: 'TWO WORLDS', zh: '表里世界' },
  holes: [
    // 1. Teaching: a wall of the real world stands across the hall. Knock the lever
    //    and it is a ghost; the ghost world's own wall leaves the right-hand side open.
    {
      id: 'haunted-1',
      par: 3,
      tee: [0, 0, 7],
      goal: { type: 'cup', position: [1, 0, -6], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-2.5, -7.5], max: [2.5, 8.5], surface: FLOOR },
        { type: 'wall', from: [-2.5, 8.5], to: [2.5, 8.5], surface: WALL },
        { type: 'wall', from: [2.5, 8.5], to: [2.5, -7.5], surface: WALL },
        { type: 'wall', from: [2.5, -7.5], to: [-2.5, -7.5], surface: WALL },
        { type: 'wall', from: [-2.5, -7.5], to: [-2.5, 8.5], surface: WALL },
      ],
      field: {
        parts: [
          swapLever('lever', [1.7, 0, 5]),
          {
            kind: 'realm',
            id: 'house',
            levers: ['lever'],
            real: { walls: [{ from: [-2.5, 2], to: [2.5, 2], surface: WALL }] },
            ghost: { walls: [{ from: [-2.5, -2], to: [0.2, -2], surface: GHOST_WALL }] },
          },
        ],
      },
      decor: [column(-4.5, 6), column(4.5, 6), tomb(-4.6, -3), column(4.5, -6, 2.2)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 30 },
    },

    // 2. Variation: a pit between two banks, and a bridge over it that is only in the
    //    ghost world. On the far bank the ghost world has a wall across; the lever there
    //    brings the real world back, which has none. Swap while on the bridge and it is gone.
    {
      id: 'haunted-2',
      par: 4,
      tee: [0, 0, 8],
      goal: { type: 'cup', position: [0, 0, -7], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        { type: 'floor', min: [-2.5, 2.5], max: [2.5, 9.5], depth: TALL, surface: FLOOR },
        { type: 'wall', from: [-2.5, 9.5], to: [2.5, 9.5], surface: WALL },
        { type: 'wall', from: [-2.5, 2.5], to: [-2.5, 9.5], surface: WALL },
        { type: 'wall', from: [2.5, 9.5], to: [2.5, 2.5], surface: WALL },
        ...wallWithDoors([-2.5, 2.5], [2.5, 2.5], [[1.5, 3.5]], WALL),
        { type: 'floor', min: [-2.5, -8.5], max: [2.5, -2.5], depth: TALL, surface: FLOOR },
        ...wallWithDoors([-2.5, -2.5], [2.5, -2.5], [[1.5, 3.5]], WALL),
        { type: 'wall', from: [-2.5, -8.5], to: [2.5, -8.5], surface: WALL },
        { type: 'wall', from: [-2.5, -8.5], to: [-2.5, -2.5], surface: WALL },
        { type: 'wall', from: [2.5, -2.5], to: [2.5, -8.5], surface: WALL },
      ],
      field: {
        parts: [
          swapLever('near', [1.8, 0, 6]),
          swapLever('far', [-1.8, 0, -4]),
          {
            kind: 'realm',
            id: 'house',
            levers: ['near', 'far'],
            real: {},
            ghost: {
              floors: [{ min: [-1, -2.6], max: [1, 2.6], surface: GHOST_FLOOR }],
              walls: [{ from: [-2.5, -5.5], to: [2.5, -5.5], surface: GHOST_WALL }],
            },
          },
        ],
      },
      decor: [column(-4.5, 7), column(4.5, 7), tomb(4.6, 0), tomb(-4.6, -1), column(-4.5, -7, 2.2), column(4.5, -7, 2.2)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 34 },
    },

    // 3. Challenge: swap twice, each in its place. The real world's wall stands across
    //    the first hall: the first lever makes it a ghost. Beyond, the bridge over the
    //    pit is in the real world only: the second lever brings that back, and must be
    //    knocked before the bridge, not after.
    {
      id: 'haunted-3',
      par: 5,
      tee: [-1, 0, 10],
      goal: { type: 'cup', position: [0, 0, -9], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 4, text: { en: 'Finish in four strokes', zh: '四杆完成' } },
      pieces: [
        // The first hall
        { type: 'floor', min: [-2.5, 0.5], max: [2.5, 11.5], depth: TALL, surface: FLOOR },
        { type: 'wall', from: [-2.5, 11.5], to: [2.5, 11.5], surface: WALL },
        { type: 'wall', from: [-2.5, 0.5], to: [-2.5, 11.5], surface: WALL },
        { type: 'wall', from: [2.5, 11.5], to: [2.5, 0.5], surface: WALL },
        ...wallWithDoors([-2.5, 0.5], [2.5, 0.5], [[1.5, 3.5]], WALL),
        // The far hall
        { type: 'floor', min: [-2.5, -10.5], max: [2.5, -4.5], depth: TALL, surface: FLOOR },
        ...wallWithDoors([-2.5, -4.5], [2.5, -4.5], [[1.5, 3.5]], WALL),
        { type: 'wall', from: [-2.5, -10.5], to: [2.5, -10.5], surface: WALL },
        { type: 'wall', from: [-2.5, -10.5], to: [-2.5, -4.5], surface: WALL },
        { type: 'wall', from: [2.5, -4.5], to: [2.5, -10.5], surface: WALL },
      ],
      field: {
        parts: [
          swapLever('first', [1.8, 0, 8.5]),
          swapLever('second', [-1.8, 0, 2.5]),
          {
            kind: 'realm',
            id: 'house',
            levers: ['first', 'second'],
            real: {
              walls: [{ from: [-2.5, 6], to: [2.5, 6], surface: WALL }],
              floors: [{ min: [-1, -4.6], max: [1, 0.6], surface: FLOOR }],
            },
            ghost: {
              walls: [{ from: [-2.5, 4], to: [0.5, 4], surface: GHOST_WALL }],
            },
          },
        ],
      },
      decor: [column(-4.5, 10), column(4.5, 10), tomb(4.6, 4), tomb(-4.6, -2), column(4.5, -3, 2.4), column(-4.5, -9, 2.2), column(4.5, -9, 2.2)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 38 },
    },
  ],
};
