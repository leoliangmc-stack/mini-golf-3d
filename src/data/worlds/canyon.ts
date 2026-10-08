import type { PartDef } from '../../level/field';
import type { WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';
import { wallWithDoors } from './ruins';

const FLOOR = 'mesa';
const WALL = 'canyonWall';
/** Mesas are tall: there is a long way down beside them. */
const TALL = 3;

/**
 * A run of cracked slabs from one point to another, `count` of them, `width` across.
 * Each reaches a little under its neighbours and under the ground at either end.
 */
function slabs(
  from: readonly [number, number],
  to: readonly [number, number],
  count: number,
  width: number,
  delay?: number,
): PartDef[] {
  const alongZ = from[0] === to[0];
  const length = (alongZ ? Math.abs(to[1] - from[1]) : Math.abs(to[0] - from[0])) / count;
  return Array.from({ length: count }, (_, i): PartDef => {
    const u = (i + 0.5) / count;
    const x = from[0] + (to[0] - from[0]) * u;
    const z = from[1] + (to[1] - from[1]) * u;
    return { kind: 'crumble', at: [x, 0, z], size: alongZ ? [width, length + 0.2] : [length + 0.2, width], delay };
  });
}

/**
 * World 22: ground that does not last (SPEC v5 3.5). A cracked slab holds for as long
 * as the ball is on it and falls once the ball has left, so every one of them can be
 * crossed exactly once. On the last hole they do not wait that long.
 */
export const CANYON_WORLD: WorldDef = {
  id: 'canyon',
  name: { en: 'Canyon', zh: '大峡谷' },
  theme: 'canyon',
  ruleCard: {
    en: 'Cracked bridges fall once you leave them.',
    zh: '有裂纹的桥，离开就会塌。',
  },
  ruleTag: { en: 'CRUMBLE', zh: '坍塌' },
  holes: [
    // 1. Teaching: one bridge, the cup on the far side. It is gone behind the ball.
    {
      id: 'canyon-1',
      par: 2,
      tee: [0, 0, 7.5],
      goal: { type: 'cup', position: [0, 0, -6.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: [
        { type: 'floor', min: [-2.5, 3], max: [2.5, 9], depth: TALL, surface: FLOOR },
        { type: 'floor', min: [-2.5, -9], max: [2.5, -3], depth: TALL, surface: FLOOR },
        { type: 'wall', from: [-2.5, 9], to: [2.5, 9], surface: WALL },
        { type: 'wall', from: [-2.5, 3], to: [-2.5, 9], surface: WALL },
        { type: 'wall', from: [2.5, 9], to: [2.5, 3], surface: WALL },
        ...wallWithDoors([-2.5, 3], [2.5, 3], [[1.6, 3.4]], WALL),
        ...wallWithDoors([-2.5, -3], [2.5, -3], [[1.6, 3.4]], WALL),
        { type: 'wall', from: [-2.5, -9], to: [2.5, -9], height: 0.8, surface: WALL },
        { type: 'wall', from: [-2.5, -9], to: [-2.5, -3], surface: WALL },
        { type: 'wall', from: [2.5, -3], to: [2.5, -9], surface: WALL },
      ],
      field: { parts: slabs([0, 3], [0, -3], 4, 1.8) },
      decor: [
        { type: 'rock', at: [-5.5, -3.6, 5], size: [2.6, 0, 0], color: 0xb8623a },
        { type: 'obelisk', at: [5, -3.6, 0], size: [1.6, 6.5, 0], color: 0xb8623a },
        { type: 'rock', at: [5.6, -3.6, -7], size: [2.2, 0, 0], color: 0xb8623a },
        { type: 'obelisk', at: [-5, -3.6, -4], size: [1.4, 5.5, 0], color: 0xb8623a },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: three bridges and a gate. The one straight ahead leads to the far
    //    mesa, where the cup is shut in. The plate that opens it is on the mesa to the
    //    east, which has a bridge of its own to the far side. East first, then across:
    //    go straight ahead and there is no way left to the plate.
    {
      id: 'canyon-2',
      par: 4,
      tee: [0, 0, 7],
      goal: { type: 'cup', position: [-0.5, 0, -3.4], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        // Where the ball starts
        { type: 'floor', min: [-2, 5], max: [2, 9], depth: TALL, surface: FLOOR },
        { type: 'wall', from: [-2, 9], to: [2, 9], surface: WALL },
        { type: 'wall', from: [-2, 5], to: [-2, 9], surface: WALL },
        ...wallWithDoors([-2, 5], [2, 5], [[1.1, 2.9]], WALL),
        ...wallWithDoors([2, 9], [2, 5], [[1.1, 2.9]], WALL),
        // The mesa to the east, with the plate
        { type: 'floor', min: [4.5, 5.5], max: [7, 8.5], depth: TALL, surface: FLOOR },
        { type: 'wall', from: [4.5, 8.5], to: [7, 8.5], surface: WALL },
        { type: 'wall', from: [7, 8.5], to: [7, 5.5], surface: WALL },
        ...wallWithDoors([4.5, 5.5], [4.5, 8.5], [[0.6, 2.4]], WALL),
        ...wallWithDoors([4.5, 5.5], [7, 5.5], [[0.35, 2.15]], WALL),
        // The far mesa
        { type: 'floor', min: [-2, -5], max: [6.5, 0.5], depth: TALL, surface: FLOOR },
        ...wallWithDoors([-2, 0.5], [6.5, 0.5], [[1.1, 2.9], [6.85, 8.65]], WALL),
        { type: 'wall', from: [6.5, 0.5], to: [6.5, -5], surface: WALL },
        { type: 'wall', from: [6.5, -5], to: [-2, -5], surface: WALL },
        { type: 'wall', from: [-2, -5], to: [-2, 0.5], surface: WALL },
        // The pen round the cup, with the gate in its east side
        { type: 'wall', from: [-2, -1.5], to: [1, -1.5], height: 0.8, surface: WALL },
        ...wallWithDoors([1, -1.5], [1, -5], [[1.3, 2.5]], WALL, { height: 0.8 }),
      ],
      field: {
        parts: [
          ...slabs([2, 7], [4.5, 7], 2, 1.8),
          ...slabs([5.75, 5.5], [5.75, 0.5], 3, 1.8),
          ...slabs([0, 5], [0, 0.5], 3, 1.8),
          { kind: 'plate', id: 'plate', at: [5.75, 0, 7], mode: 'latch', radius: 0.6 },
          { kind: 'gate', id: 'gate', from: [1, -2.8], to: [1, -4], when: 'plate', via: [[5.75, 4.9], [3.6, 4.9], [3.6, -3.4]] },
        ],
      },
      decor: [
        { type: 'rock', at: [-4.6, -3.6, 3], size: [2.4, 0, 0], color: 0xb8623a },
        { type: 'obelisk', at: [2.9, -3.6, 2.6], size: [1.4, 6, 0], color: 0xb8623a },
        { type: 'rock', at: [9, -3.6, 3], size: [2.6, 0, 0], color: 0xb8623a },
        { type: 'obelisk', at: [-4.4, -3.6, -7], size: [1.5, 6.5, 0], color: 0xb8623a },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58 },
    },

    // 3. Challenge: these slabs fall a moment after they are first touched, with the
    //    ball on them or not. A stroke that dawdles goes down with the bridge.
    {
      id: 'canyon-3',
      par: 3,
      tee: [0, 0, 10.5],
      goal: { type: 'cup', position: [1.5, 0, -11.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-2.5, 7], max: [2.5, 12], depth: TALL, surface: FLOOR },
        { type: 'wall', from: [-2.5, 12], to: [2.5, 12], surface: WALL },
        { type: 'wall', from: [-2.5, 7], to: [-2.5, 12], surface: WALL },
        { type: 'wall', from: [2.5, 12], to: [2.5, 7], surface: WALL },
        ...wallWithDoors([-2.5, 7], [2.5, 7], [[1.6, 3.4]], WALL),
        // The island half way
        { type: 'floor', min: [-2.5, -3], max: [2.5, 1], depth: TALL, surface: FLOOR },
        ...wallWithDoors([-2.5, 1], [2.5, 1], [[1.6, 3.4]], WALL),
        ...wallWithDoors([-2.5, -3], [2.5, -3], [[3.1, 4.9]], WALL, { height: 0.8 }),
        { type: 'wall', from: [-2.5, -3], to: [-2.5, 1], surface: WALL },
        { type: 'wall', from: [2.5, 1], to: [2.5, -3], surface: WALL },
        // The far mesa
        { type: 'floor', min: [-1, -14], max: [4, -9], depth: TALL, surface: FLOOR },
        ...wallWithDoors([-1, -9], [4, -9], [[1.6, 3.4]], WALL),
        { type: 'wall', from: [4, -9], to: [4, -14], surface: WALL },
        { type: 'wall', from: [4, -14], to: [-1, -14], height: 0.8, surface: WALL },
        { type: 'wall', from: [-1, -14], to: [-1, -9], surface: WALL },
      ],
      field: { parts: [...slabs([0, 7], [0, 1], 4, 1.8, 50), ...slabs([1.5, -3], [1.5, -9], 4, 1.8, 50)] },
      decor: [
        { type: 'rock', at: [-5.5, -3.6, 9], size: [2.6, 0, 0], color: 0xb8623a },
        { type: 'obelisk', at: [4.6, -3.6, 4], size: [1.5, 6.5, 0], color: 0xb8623a },
        { type: 'rock', at: [-4.4, -3.6, -6], size: [2.4, 0, 0], color: 0xb8623a },
        { type: 'obelisk', at: [6.2, -3.6, -11], size: [1.4, 6, 0], color: 0xb8623a },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 32 },
    },
  ],
};
