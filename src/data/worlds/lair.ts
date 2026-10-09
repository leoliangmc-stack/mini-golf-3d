import type { Cell, KeyColor, PartDef } from '../../level/field';
import type { DecorDef, WorldDef } from '../../level/schema';
import { FALL } from './common';
import { key } from './dungeon';

const FLOOR = 'lairFloor';
const WALL = 'lairWall';

/** A boss on the four cells from `cell`, facing a compass heading, with so much health. */
export const boss = (id: string, cell: Cell, hp: number, extra: { facing?: number; shield?: KeyColor } = {}): PartDef => ({
  kind: 'boss',
  id,
  cell,
  hp,
  ...extra,
});

const DEEP = -3.6;
const spike = (x: number, z: number, height = 5): DecorDef => ({ type: 'obelisk', at: [x, DEEP, z], size: [1.3, height, 0], color: 0x2c1f2e });
const ember = (x: number, z: number): DecorDef => ({ type: 'crystals', at: [x, DEEP, z], size: [2, 0, 0], color: 0xff6a3d });

/**
 * World 38: the boss lair (SPEC v9 3.6). The boss turns to face the ball each time it
 * stops, and its weak spot is on its back: strike it off a wall. Once struck it comes
 * for the ball; struck twice, it shields its back, and only a key opens the shield.
 */
export const LAIR_WORLD: WorldDef = {
  id: 'lair',
  name: { en: 'Boss Lair', zh: 'Boss 战' },
  theme: 'lair',
  ruleCard: {
    en: 'Its weak spot is on its back, and it always turns to face you.',
    zh: '弱点在背后，而它永远转身面对你。',
  },
  ruleTag: { en: 'BOSS', zh: 'BOSS' },
  holes: [
    // 1. Teaching: one strike. It faces the tee; go up the side and off the far wall,
    //    onto its back.
    {
      id: 'lair-1',
      par: 3,
      tee: [0, 0, 5],
      goal: { type: 'boss', part: 'boss' },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Beat it in two strokes', zh: '两杆击败' } },
      pieces: [
        { type: 'floor', min: [-4, -6], max: [4, 6], surface: FLOOR },
        { type: 'wall', from: [-4, 6], to: [4, 6], surface: WALL },
        { type: 'wall', from: [4, 6], to: [4, -6], surface: WALL },
        { type: 'wall', from: [4, -6], to: [-4, -6], surface: WALL },
        { type: 'wall', from: [-4, -6], to: [-4, 6], surface: WALL },
      ],
      field: {
        grid: { origin: [-3.5, -5.5], cols: 8, rows: 12 },
        parts: [boss('boss', [3, 5], 1)],
      },
      decor: [spike(-6.5, 4), ember(6.5, 3), spike(6.5, -4, 6), ember(-6.5, -4)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 60, maxDistance: 32 },
    },

    // 2. Variation: two strikes. After the first it comes for the ball, a cell a
    //    stroke, and a step onto the ball catches it. Keep moving, and keep a wall at
    //    its back.
    {
      id: 'lair-2',
      par: 5,
      tee: [0, 0, 6],
      goal: { type: 'boss', part: 'boss' },
      challenge: { type: 'noCaught', text: { en: 'Never get caught', zh: '一次都不被抓' } },
      pieces: [
        { type: 'floor', min: [-4, -7], max: [4, 7], surface: FLOOR },
        { type: 'wall', from: [-4, 7], to: [4, 7], surface: WALL },
        { type: 'wall', from: [4, 7], to: [4, -7], surface: WALL },
        { type: 'wall', from: [4, -7], to: [-4, -7], surface: WALL },
        { type: 'wall', from: [-4, -7], to: [-4, 7], surface: WALL },
      ],
      field: {
        grid: { origin: [-3.5, -6.5], cols: 8, rows: 14 },
        parts: [boss('boss', [3, 6], 2)],
      },
      decor: [spike(-7, 5), ember(7, 4), spike(7, -5, 6), ember(-7, -5), spike(0, -9.5, 4)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 60, maxDistance: 34 },
    },

    // 3. Challenge: three strikes. After the second a shield covers its back; the gold
    //    key in the corner opens it, once.
    {
      id: 'lair-3',
      par: 7,
      tee: [0, 0, 6],
      goal: { type: 'boss', part: 'boss' },
      challenge: { type: 'maxStrokes', strokes: 5, text: { en: 'Beat it in five strokes', zh: '五杆击败' } },
      pieces: [
        { type: 'floor', min: [-4, -7], max: [4, 7], surface: FLOOR },
        { type: 'wall', from: [-4, 7], to: [4, 7], surface: WALL },
        { type: 'wall', from: [4, 7], to: [4, -7], surface: WALL },
        { type: 'wall', from: [4, -7], to: [-4, -7], surface: WALL },
        { type: 'wall', from: [-4, -7], to: [-4, 7], surface: WALL },
      ],
      field: {
        grid: { origin: [-3.5, -6.5], cols: 8, rows: 14 },
        parts: [key('key', [-3.2, 0, -6], 'gold'), boss('boss', [3, 6], 3, { shield: 'gold' })],
      },
      decor: [spike(-7, 5), ember(7, 4), spike(7, -5, 6), ember(-7, -5), spike(0, -9.5, 4)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 60, maxDistance: 34 },
    },
  ],
};
