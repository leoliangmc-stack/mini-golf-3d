import type { WorldDef } from '../../level/schema';
import type { ZoneDef } from '../../physics/zones';
import { CUP } from './common';

const FLOOR = 'concrete';
const WALL = 'damWall';
/** The banks are thick: their sides are the walls of the pools. */
const BANK = 2.8;

/**
 * Out of bounds far below. The pools go deeper than the usual drop, and it is the water
 * in them that says when a ball is lost.
 */
const DEPTHS: ZoneDef = {
  type: 'outOfBounds',
  shape: { kind: 'box', center: [0, -9, 0], halfExtents: [80, 5, 80] },
};

/**
 * World 21: water levels (SPEC v5 3.4). Water is out of bounds, wherever its surface
 * is. A knock turns a valve, and turns it back; the water rises or falls, and a raft on
 * it with it, ball and all.
 */
export const DAM_WORLD: WorldDef = {
  id: 'dam',
  name: { en: 'Waterworks', zh: '水坝' },
  theme: 'dam',
  ruleCard: {
    en: 'Hit a valve to change the water level. Floats rise and fall with it.',
    zh: '撞阀门改变水位，浮台跟着升降。',
  },
  ruleTag: { en: 'WATER', zh: '水位' },
  holes: [
    // 1. Teaching: a pool across the way with a raft lying a metre down in it. The
    //    valve at the edge fills the pool, and the raft comes up to make the bridge.
    //    The valve reaches down into the pool, so a ball already on the raft can turn
    //    it too, and ride up.
    {
      id: 'dam-1',
      par: 3,
      tee: [0, 0, 6.5],
      goal: { type: 'cup', position: [0, 0, -6], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-2.5, 2], max: [2.5, 8], depth: BANK, surface: FLOOR },
        { type: 'floor', min: [-2.5, -8], max: [2.5, -2], depth: BANK, surface: FLOOR },
        { type: 'wall', from: [-2.5, 8], to: [2.5, 8], surface: WALL },
        { type: 'wall', from: [-2.5, -8], to: [2.5, -8], surface: WALL },
        { type: 'wall', from: [-2.5, 2], to: [-2.5, 8], surface: WALL },
        { type: 'wall', from: [2.5, 8], to: [2.5, 2], surface: WALL },
        { type: 'wall', from: [-2.5, -8], to: [-2.5, -2], surface: WALL },
        { type: 'wall', from: [2.5, -2], to: [2.5, -8], surface: WALL },
        // The sides of the pool, from its floor up
        { type: 'wall', from: [-2.5, -2], to: [-2.5, 2], y: -2.5, height: 2.85, surface: WALL },
        { type: 'wall', from: [2.5, 2], to: [2.5, -2], y: -2.5, height: 2.85, surface: WALL },
      ],
      field: {
        parts: [
          { kind: 'water', id: 'pool', min: [-2.5, -2], max: [2.5, 2], level: -1, levels: [{ level: -0.1, when: 'valve' }] },
          { kind: 'float', id: 'raft', water: 'pool', at: [0, 0], size: [2, 0.4, 4.2], freeboard: 0.104, surface: 'raft' },
          { kind: 'valve', id: 'valve', at: [1.3, 0, 1.95], depth: 1.2 },
        ],
      },
      decor: [
        { type: 'pipe', at: [-4.2, 0.0, 5], size: [4, 0.35, 0], yaw: 90 },
        { type: 'pipe', at: [4.2, 0.0, -5], size: [4, 0.35, 0], yaw: 90 },
        { type: 'column', at: [-4, -3.4, -6], size: [0.5, 3.6, 0], color: 0x9aa3ab },
        { type: 'column', at: [4, -3.4, 6], size: [0.5, 3.6, 0], color: 0x9aa3ab },
      ],
      zones: [DEPTHS],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: two valves and three levels. Left alone, the water stands half way.
    //    One valve fills the pool and the raft is a bridge; the other drains it and the
    //    walk along the bottom comes out of the water. Turn both, and it is half way again.
    {
      id: 'dam-2',
      par: 4,
      tee: [0, 0, 8],
      goal: { type: 'cup', position: [0, 0, -6.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        // The near bank, and the ramp down from it on the left
        { type: 'floor', min: [-2.5, 3], max: [2.5, 9], depth: BANK, surface: FLOOR },
        { type: 'floor', min: [-4.5, 6], max: [-2.5, 9], depth: BANK, surface: FLOOR },
        { type: 'ramp', min: [-4.5, 3], max: [-2.5, 6], along: 'z', yFrom: -1.5, yTo: 0, depth: 1.3, surface: FLOOR },
        // The walk along the bottom
        { type: 'floor', min: [-4.5, -3], max: [-2.5, 3], y: -1.5, depth: 1.3, surface: FLOOR },
        { type: 'wall', from: [-2.5, 3], to: [-2.5, -3], y: -1.5, surface: WALL },
        // The far bank, and the ramp up to it
        { type: 'ramp', min: [-4.5, -6], max: [-2.5, -3], along: 'z', yFrom: 0, yTo: -1.5, depth: 1.3, surface: FLOOR },
        { type: 'floor', min: [-4.5, -9], max: [-2.5, -6], depth: BANK, surface: FLOOR },
        { type: 'floor', min: [-2.5, -9], max: [2.5, -3], depth: BANK, surface: FLOOR },
        // Round the outside
        { type: 'wall', from: [-4.5, 9], to: [2.5, 9], surface: WALL },
        { type: 'wall', from: [2.5, 9], to: [2.5, 3], surface: WALL },
        { type: 'wall', from: [2.5, -3], to: [2.5, -9], surface: WALL },
        { type: 'wall', from: [2.5, -9], to: [-4.5, -9], surface: WALL },
        { type: 'wall', from: [-4.5, -9], to: [-4.5, -6], surface: WALL },
        { type: 'wall', from: [-4.5, 6], to: [-4.5, 9], surface: WALL },
        { type: 'wall', from: [-4.5, -6], to: [-4.5, 6], y: -2.5, height: 2.85, surface: WALL },
        { type: 'wall', from: [2.5, 3], to: [2.5, -3], y: -2.5, height: 2.85, surface: WALL },
      ],
      field: {
        parts: [
          {
            kind: 'water',
            id: 'pool',
            min: [-4.5, -4],
            max: [2.5, 4],
            level: -1.1,
            levels: [
              { level: -0.1, when: { all: ['fill'], none: ['drain'] } },
              { level: -2.1, when: { all: ['drain'], none: ['fill'] } },
            ],
          },
          { kind: 'float', id: 'raft', water: 'pool', at: [0.5, 0], size: [2, 0.4, 6.2], freeboard: 0.104, surface: 'raft' },
          { kind: 'valve', id: 'fill', at: [1.7, 0, 6] },
          { kind: 'valve', id: 'drain', at: [-1.7, 0, 6] },
        ],
      },
      decor: [
        { type: 'pipe', at: [4.3, 0.0, 6], size: [4, 0.35, 0], yaw: 90 },
        { type: 'pipe', at: [4.3, 0.0, -6], size: [4, 0.35, 0], yaw: 90 },
        { type: 'column', at: [-6.2, -3.4, 7.5], size: [0.5, 3.6, 0], color: 0x9aa3ab },
        { type: 'column', at: [-6.2, -3.4, -7.5], size: [0.5, 3.6, 0], color: 0x9aa3ab },
      ],
      zones: [DEPTHS],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58 },
    },

    // 3. Challenge: two pools. The first is filled by its valve. The second is a lock
    //    that fills and empties by itself, and its raft is a bridge only while it is up.
    //    A ball cannot wait on it: one that stops there is put back on the bank.
    {
      id: 'dam-3',
      par: 4,
      tee: [0, 0, 8.5],
      goal: { type: 'cup', position: [0, 0, -9.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        { type: 'floor', min: [-2.5, 5], max: [2.5, 10], depth: BANK, surface: FLOOR },
        { type: 'floor', min: [-2.5, -3], max: [2.5, 1], depth: BANK, surface: FLOOR },
        { type: 'floor', min: [-2.5, -12], max: [2.5, -7], depth: BANK, surface: FLOOR },
        { type: 'wall', from: [-2.5, 10], to: [2.5, 10], surface: WALL },
        { type: 'wall', from: [-2.5, -12], to: [2.5, -12], surface: WALL },
        { type: 'wall', from: [-2.5, 5], to: [-2.5, 10], surface: WALL },
        { type: 'wall', from: [2.5, 10], to: [2.5, 5], surface: WALL },
        { type: 'wall', from: [-2.5, -3], to: [-2.5, 1], surface: WALL },
        { type: 'wall', from: [2.5, 1], to: [2.5, -3], surface: WALL },
        { type: 'wall', from: [-2.5, -12], to: [-2.5, -7], surface: WALL },
        { type: 'wall', from: [2.5, -7], to: [2.5, -12], surface: WALL },
        // The sides of the two pools
        { type: 'wall', from: [-2.5, 1], to: [-2.5, 5], y: -2.5, height: 2.85, surface: WALL },
        { type: 'wall', from: [2.5, 5], to: [2.5, 1], y: -2.5, height: 2.85, surface: WALL },
        { type: 'wall', from: [-2.5, -7], to: [-2.5, -3], y: -2.5, height: 2.85, surface: WALL },
        { type: 'wall', from: [2.5, -3], to: [2.5, -7], y: -2.5, height: 2.85, surface: WALL },
      ],
      field: {
        parts: [
          { kind: 'water', id: 'basin', min: [-2.5, 1], max: [2.5, 5], level: -1, levels: [{ level: -0.1, when: 'valve' }] },
          { kind: 'float', id: 'raft', water: 'basin', at: [0, 3], size: [2, 0.4, 4.2], freeboard: 0.104, surface: 'raft' },
          { kind: 'valve', id: 'valve', at: [1.3, 0, 4.95], depth: 1.2 },
          {
            kind: 'water',
            id: 'lock',
            min: [-2.5, -7],
            max: [2.5, -3],
            level: -1,
            tide: { to: -0.1, period: 6, hold: [0.2, 0.3] },
          },
          {
            kind: 'float',
            id: 'ferry',
            water: 'lock',
            at: [0, -5],
            size: [2, 0.4, 4.2],
            freeboard: 0.104,
            rest: [[0, 0, -1.5]],
            surface: 'raft',
          },
        ],
      },
      decor: [
        { type: 'pipe', at: [-4.3, 0.0, 7.5], size: [4, 0.35, 0], yaw: 90 },
        { type: 'pipe', at: [4.3, 0.0, -1], size: [4, 0.35, 0], yaw: 90 },
        { type: 'pipe', at: [-4.3, 0.0, -9.5], size: [4, 0.35, 0], yaw: 90 },
        { type: 'column', at: [4, -3.4, 7.5], size: [0.5, 3.6, 0], color: 0x9aa3ab },
        { type: 'column', at: [4, -3.4, -9.5], size: [0.5, 3.6, 0], color: 0x9aa3ab },
      ],
      zones: [DEPTHS],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58 },
    },
  ],
};
