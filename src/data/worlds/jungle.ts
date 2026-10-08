import type { PieceDef, WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';
import { wallWithDoors } from './ruins';

const FLOOR = 'jungleFloor';
const WALL = 'templeWall';

/**
 * The course holes 2 and 3 share: a room to start in, a corridor straight north to the
 * room with the cup, and a long way round by the east for when the corridor is shut.
 * `west` is how far the first room reaches to the left; `baffles` puts two walls in the
 * long way round, to make it longer still.
 */
function twoWays(west: number, baffles: boolean): PieceDef[] {
  return [
    // The first room
    { type: 'floor', min: [west, 4], max: [3, 9], surface: FLOOR },
    { type: 'wall', from: [west, 9], to: [3, 9], surface: WALL },
    { type: 'wall', from: [west, 4], to: [west, 9], surface: WALL },
    { type: 'wall', from: [west, 4], to: [-1, 4], surface: WALL },
    { type: 'wall', from: [1, 4], to: [3, 4], surface: WALL },
    ...wallWithDoors([3, 4], [3, 9], [[1.5, 3.5]], WALL),
    // The corridor
    { type: 'floor', min: [-1, -4], max: [1, 4], surface: 'templeStone' },
    { type: 'wall', from: [-1, 4], to: [-1, -4], surface: WALL },
    { type: 'wall', from: [1, 4], to: [1, -4], surface: WALL },
    // The room with the cup
    { type: 'floor', min: [-3, -9], max: [3, -4], surface: FLOOR },
    { type: 'wall', from: [-3, -4], to: [-1, -4], surface: WALL },
    { type: 'wall', from: [1, -4], to: [3, -4], surface: WALL },
    { type: 'wall', from: [-3, -9], to: [-3, -4], surface: WALL },
    { type: 'wall', from: [-3, -9], to: [3, -9], surface: WALL },
    ...wallWithDoors([3, -9], [3, -4], [[1.5, 3.5]], WALL),
    // The long way round
    { type: 'floor', min: [3, -8.5], max: [5, 8.5], surface: FLOOR },
    { type: 'wall', from: [3, 8.5], to: [5, 8.5], surface: WALL },
    { type: 'wall', from: [5, 8.5], to: [5, -8.5], surface: WALL },
    { type: 'wall', from: [5, -8.5], to: [3, -8.5], surface: WALL },
    { type: 'wall', from: [3, -4], to: [3, 4], surface: WALL },
    ...(baffles
      ? ([
          { type: 'wall', from: [3, 3], to: [4.2, 3], surface: WALL },
          { type: 'wall', from: [3.8, -1], to: [5, -1], surface: WALL },
        ] as const)
      : []),
  ];
}

/**
 * World 17: one switch, a chain of things (SPEC v4 3.5). Each part of a chain starts the
 * next when it has finished, and the vine between them lights up as the signal runs
 * along it. Some chains open the way. Some shut it: a red vine leads to a trap.
 */
export const JUNGLE_WORLD: WorldDef = {
  id: 'jungle',
  name: { en: 'Jungle Temple', zh: '丛林神庙' },
  theme: 'jungle',
  ruleCard: {
    en: 'One switch can start a chain. Watch the glowing vines.',
    zh: '一个机关能引发一连串反应，看发光的藤蔓。',
  },
  ruleTag: { en: 'CHAINS', zh: '连锁' },
  holes: [
    // 1. Teaching: every link helps. The plate opens the first gate; the gate raises the
    //    bridge; the bridge opens the last gate. A ball that runs on ahead of the chain
    //    finds the pit still open.
    {
      id: 'jungle-1',
      par: 3,
      tee: [0, 0, 8],
      goal: { type: 'cup', position: [0, 0, -7.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        // This side of the pit
        { type: 'floor', min: [-2, 0], max: [2, 9.5], surface: FLOOR },
        { type: 'wall', from: [-2, 9.5], to: [2, 9.5], surface: WALL },
        { type: 'wall', from: [-2, 0], to: [-2, 9.5], surface: WALL },
        { type: 'wall', from: [2, 9.5], to: [2, 0], surface: WALL },
        ...wallWithDoors([-2, 3.5], [2, 3.5], [[1.3, 2.7]], WALL, { height: 0.8 }),
        // The far side
        { type: 'floor', min: [-2, -9], max: [2, -2.5], surface: FLOOR },
        { type: 'wall', from: [-2, -9], to: [2, -9], surface: WALL },
        { type: 'wall', from: [-2, -9], to: [-2, -2.5], surface: WALL },
        { type: 'wall', from: [2, -2.5], to: [2, -9], surface: WALL },
        ...wallWithDoors([-2, -5], [2, -5], [[1.3, 2.7]], WALL, { height: 0.8 }),
      ],
      field: {
        parts: [
          { kind: 'plate', id: 'plate', at: [0, 0, 6], mode: 'latch' },
          { kind: 'gate', id: 'first', from: [-0.7, 3.5], to: [0.7, 3.5], when: 'plate', via: [[-1.3, 6], [-1.3, 3.9]] },
          {
            kind: 'slider',
            id: 'bridge',
            role: 'platform',
            look: 'bridge',
            size: [1.6, 0.4, 2.7],
            from: [0, -1.7, -1.25],
            to: [0, -0.196, -1.25],
            ticks: 50,
            when: 'first',
            delay: 20,
            via: [[1.3, 3.1], [1.3, 0.4]],
            surface: 'templeStone',
          },
          { kind: 'gate', id: 'last', from: [-0.7, -5], to: [0.7, -5], when: 'bridge', delay: 20, via: [[-1.3, -2.9], [-1.3, -4.6]] },
        ],
      },
      decor: [
        { type: 'palm', at: [-3.5, -0.9, 6], size: [3.6, 0, 0] },
        { type: 'palm', at: [3.5, -0.9, 1.5], size: [3.1, 0, 0] },
        { type: 'palm', at: [-3.6, -0.9, -4], size: [3.4, 0, 0] },
        { type: 'palm', at: [3.4, -0.9, -7.5], size: [3.8, 0, 0] },
        { type: 'column', at: [3.4, -0.9, 5.5], size: [0.35, 1.1, 0] },
        { type: 'bush', at: [-3.2, -0.9, 0.5], size: [0.7, 0, 0] },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: a trap. The plate in the corridor drops a boulder across its far
    //    end. It leaves a strip of floor along the left wall; a ball that keeps to it
    //    goes through, and one that does not has the long way round to go.
    {
      id: 'jungle-2',
      par: 3,
      // Room for the long way round after the trap has shut.
      strokeLimit: 8,
      tee: [0, 0, 8],
      goal: { type: 'cup', position: [0, 0, -7], ...CUP },
      challenge: { type: 'partOff', part: 'boulder', text: { en: "Don't spring the trap", zh: '不要触发陷阱' } },
      pieces: twoWays(-3, false),
      field: {
        parts: [
          { kind: 'plate', id: 'trip', at: [0.3, 0, 1], mode: 'latch', radius: 0.6 },
          { kind: 'gate', id: 'boulder', from: [-1, -3.4], to: [1, -3.4], when: 'trip', trap: true, look: 'boulder' },
        ],
      },
      decor: [
        { type: 'palm', at: [-4.6, -0.9, 7], size: [3.6, 0, 0] },
        { type: 'palm', at: [-2.2, -0.9, 0.5], size: [3.2, 0, 0] },
        { type: 'palm', at: [2, -0.9, -0.5], size: [3.5, 0, 0] },
        { type: 'palm', at: [6.4, -0.9, -3], size: [3.3, 0, 0] },
        { type: 'palm', at: [-4.5, -0.9, -7], size: [3.7, 0, 0] },
        { type: 'column', at: [6.3, -0.9, 5], size: [0.35, 1.2, 0] },
        { type: 'bush', at: [-2.3, -0.9, -2.6], size: [0.7, 0, 0] },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58 },
    },

    // 3. Challenge: here the plate covers the corridor from wall to wall. The plate in
    //    the corner of the first room raises a brace under the boulder; with that up,
    //    the trap does nothing. Brace first, corridor second.
    {
      id: 'jungle-3',
      par: 4,
      strokeLimit: 10,
      tee: [0, 0, 8],
      goal: { type: 'cup', position: [0, 0, -7], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: twoWays(-4, true),
      field: {
        parts: [
          { kind: 'plate', id: 'safety', at: [-2.8, 0, 5.4], mode: 'latch' },
          {
            kind: 'slider',
            id: 'brace',
            role: 'pusher',
            look: 'block',
            size: [0.5, 0.9, 0.5],
            from: [-1.15, -0.5, -3.4],
            to: [-1.15, 0.45, -3.4],
            ticks: 40,
            when: 'safety',
            via: [[-2.8, 4.4], [-1.5, 4.4], [-1.5, -3.4]],
            surface: 'templeStone',
          },
          { kind: 'plate', id: 'trip', at: [0, 0, 1.5], mode: 'latch', radius: 0.95 },
          {
            kind: 'gate',
            id: 'boulder',
            from: [-1, -3.4],
            to: [1, -3.4],
            when: { all: ['trip'], none: ['brace'] },
            trap: true,
            latch: true,
            look: 'boulder',
          },
        ],
      },
      decor: [
        { type: 'palm', at: [-5.6, -0.9, 7], size: [3.6, 0, 0] },
        { type: 'palm', at: [-2.8, -0.9, -0.6], size: [3.2, 0, 0] },
        { type: 'palm', at: [2, -0.9, -1.2], size: [3.5, 0, 0] },
        { type: 'palm', at: [6.4, -0.9, -4], size: [3.3, 0, 0] },
        { type: 'palm', at: [-4.5, -0.9, -7], size: [3.7, 0, 0] },
        { type: 'column', at: [6.3, -0.9, 6], size: [0.35, 2.4, 0] },
        { type: 'bush', at: [-2.4, -0.9, -1.8], size: [0.7, 0, 0] },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58 },
    },
  ],
};
