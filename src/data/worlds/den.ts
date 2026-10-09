import type { Cell, PartDef } from '../../level/field';
import type { DecorDef, WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';

const FLOOR = 'denFloor';
const WALL = 'denWall';

/** A monster that walks a path and back. */
export const patrol = (id: string, path: readonly Cell[]): PartDef => ({ kind: 'monster', id, mode: 'patrol', path });
/** A monster that steps toward the ball. */
export const chaser = (id: string, cell: Cell): PartDef => ({ kind: 'monster', id, mode: 'chase', cell });

const DEEP = -3.6;
const rock = (x: number, z: number, size = 2.4): DecorDef => ({ type: 'rock', at: [x, DEEP, z], size: [size, 0, 0], color: 0x4b4149 });
const fang = (x: number, z: number, height = 5): DecorDef => ({ type: 'obelisk', at: [x, DEEP, z], size: [1.2, height, 0], color: 0x3a3340 });

/**
 * World 36: the monster den (SPEC v9 3.4). Monsters stand still while the ball rolls
 * and take one step each time it has stopped: along a path and back, or toward the
 * ball. A step onto the ball's cell catches it, and the stroke is taken back.
 */
export const DEN_WORLD: WorldDef = {
  id: 'den',
  name: { en: 'Monster Den', zh: '怪兽巢穴' },
  theme: 'den',
  ruleCard: {
    en: 'Monsters move one step each time your ball stops.',
    zh: '每次球停下，怪兽走一步。',
  },
  ruleTag: { en: 'MONSTERS', zh: '怪兽' },
  holes: [
    // 1. Teaching: one monster walks across the hall and back. Go while it is at the
    //    side, or wait a stroke for it to be.
    {
      id: 'den-1',
      par: 2,
      tee: [0, 0, 5],
      goal: { type: 'cup', position: [0, 0, -5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: [
        { type: 'floor', min: [-2.5, -6], max: [2.5, 6], surface: FLOOR },
        { type: 'wall', from: [-2.5, 6], to: [2.5, 6], surface: WALL },
        { type: 'wall', from: [2.5, 6], to: [2.5, -6], surface: WALL },
        { type: 'wall', from: [2.5, -6], to: [-2.5, -6], surface: WALL },
        { type: 'wall', from: [-2.5, -6], to: [-2.5, 6], surface: WALL },
      ],
      field: {
        grid: { origin: [-2, -4], cols: 5, rows: 9 },
        parts: [patrol('walker', [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]])],
      },
      decor: [rock(-5, 4), fang(5, 2), rock(5, -4), fang(-5, -3, 4)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 30 },
    },

    // 2. Variation: a monster that comes for the ball, and a wall across the room
    //    with its gap on the right. It is kept behind the wall for as long as the ball
    //    is straight below it: it wants to come down, cannot, and sidles instead.
    {
      id: 'den-2',
      par: 3,
      tee: [-2, 0, -4],
      goal: { type: 'cup', position: [-2.5, 0, 3.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-3.5, -4.5], max: [3.5, 4.5], surface: FLOOR },
        { type: 'wall', from: [-3.5, 4.5], to: [3.5, 4.5], surface: WALL },
        { type: 'wall', from: [3.5, 4.5], to: [3.5, -4.5], surface: WALL },
        { type: 'wall', from: [3.5, -4.5], to: [-3.5, -4.5], surface: WALL },
        { type: 'wall', from: [-3.5, -4.5], to: [-3.5, 4.5], surface: WALL },
        // Across the middle, through the centres of row 4, with the gap at the right.
        { type: 'wall', from: [-3.5, 0], to: [1.5, 0], surface: WALL },
      ],
      field: {
        grid: { origin: [-3, -4], cols: 7, rows: 9, blocked: [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]] },
        parts: [chaser('hunter', [2, 7])],
      },
      decor: [rock(-6, 3), fang(6, 4), rock(6, -3), fang(-6, -4, 4), rock(0, -7, 2)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 60, maxDistance: 30 },
    },

    // 3. Challenge: one that walks the middle of the hall and one that comes for the
    //    ball, with the cup in a bay at the far end. Every stop has to be chosen.
    {
      id: 'den-3',
      par: 4,
      tee: [0, 0, 6],
      goal: { type: 'cup', position: [3, 0, -6.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        { type: 'floor', min: [-3.5, -7.5], max: [3.5, 7.5], surface: FLOOR },
        { type: 'wall', from: [-3.5, 7.5], to: [3.5, 7.5], surface: WALL },
        { type: 'wall', from: [3.5, 7.5], to: [3.5, -7.5], surface: WALL },
        { type: 'wall', from: [3.5, -7.5], to: [-3.5, -7.5], surface: WALL },
        { type: 'wall', from: [-3.5, -7.5], to: [-3.5, 7.5], surface: WALL },
        // A pillar of rock through the centres of column 3, rows 5 to 7.
        { type: 'wall', from: [0, -2], to: [0, 0], surface: WALL },
      ],
      field: {
        grid: { origin: [-3, -7], cols: 7, rows: 15, blocked: [[3, 5], [3, 6], [3, 7]] },
        parts: [patrol('walker', [[0, 9], [1, 9], [2, 9], [3, 9], [4, 9], [5, 9], [6, 9]]), chaser('hunter', [1, 2])],
      },
      decor: [rock(-6, 6), fang(6, 5), rock(6, -2), fang(-6, -1, 4), rock(-6, -7, 2), fang(6, -8, 4)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 36 },
    },
  ],
};
