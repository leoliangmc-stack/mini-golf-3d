import type { WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';
import { wallWithDoors } from './ruins';

/**
 * World 15: plates open gates (SPEC v4 3.3). A plate with a gold rim stays down once
 * pressed; one with a blue rim holds its gate open only while something stands on it,
 * and a block of stone will. A ball that runs into a side of a block sends it one square
 * the other way.
 */
export const TOMB_WORLD: WorldDef = {
  id: 'tomb',
  name: { en: "Pharaoh's Tomb", zh: '法老陵墓' },
  theme: 'tomb',
  ruleCard: {
    en: 'Plates open gates. Stones can hold them down.',
    zh: '压力板能打开闸门，石块可以一直压住它。',
  },
  ruleTag: { en: 'PLATES', zh: '压力板' },
  holes: [
    // 1. Teaching: the plate lies on the line from the tee to the cup, and the gate
    //    between them is shut. A stroke at the cup rolls over the plate; the gate has
    //    sunk by the time the ball gets there.
    {
      id: 'tomb-1',
      par: 2,
      tee: [1, 0, 6.5],
      goal: { type: 'cup', position: [-1, 0, -5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: [
        { type: 'floor', min: [-2.5, -7], max: [2.5, 8], surface: 'tombFloor' },
        { type: 'wall', from: [-2.5, 8], to: [2.5, 8], surface: 'tombWall' },
        { type: 'wall', from: [2.5, 8], to: [2.5, -7], surface: 'tombWall' },
        { type: 'wall', from: [2.5, -7], to: [-2.5, -7], surface: 'tombWall' },
        { type: 'wall', from: [-2.5, -7], to: [-2.5, 8], surface: 'tombWall' },
        ...wallWithDoors([-2.5, 0], [2.5, 0], [[1.75, 3]], 'tombWall', { height: 0.8 }),
      ],
      field: {
        parts: [
          { kind: 'plate', id: 'plate', at: [0.4, 0, 3], mode: 'latch' },
          { kind: 'gate', id: 'gate', from: [-0.75, 0], to: [0.5, 0], when: 'plate' },
        ],
      },
      decor: [
        { type: 'obelisk', at: [-4.2, -0.9, -6], size: [0.8, 4.4, 0] },
        { type: 'obelisk', at: [4.2, -0.9, -6], size: [0.8, 4.4, 0] },
        { type: 'column', at: [-3.9, -0.9, 2], size: [0.35, 2.4, 0] },
        { type: 'column', at: [3.9, -0.9, 2], size: [0.35, 2.4, 0] },
        { type: 'column', at: [4.1, -0.9, 6.5], size: [0.35, 1.1, 0] },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: this plate holds the gate open only while something stands on it. A
    //    stroke straight ahead shoves the block onto it; the gate is round to the right.
    {
      id: 'tomb-2',
      par: 3,
      tee: [0, 0, 7.5],
      goal: { type: 'cup', position: [3.5, 0, -2], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        // The first room
        { type: 'floor', min: [-3, 2], max: [3, 9], surface: 'tombFloor' },
        { type: 'wall', from: [-3, 9], to: [3, 9], surface: 'tombWall' },
        { type: 'wall', from: [3, 9], to: [3, 2], surface: 'tombWall' },
        { type: 'wall', from: [-3, 2], to: [-3, 9], surface: 'tombWall' },
        // The wall between the rooms, with the doorway on the right
        ...wallWithDoors([-3, 2], [3, 2], [[4.2, 5.4]], 'tombWall', { height: 0.8 }),
        // The second room
        { type: 'floor', min: [-1, -4.5], max: [5, 2], surface: 'tombFloor' },
        { type: 'wall', from: [3, 2], to: [5, 2], surface: 'tombWall' },
        { type: 'wall', from: [5, 2], to: [5, -4.5], surface: 'tombWall' },
        { type: 'wall', from: [5, -4.5], to: [-1, -4.5], surface: 'tombWall' },
        { type: 'wall', from: [-1, -4.5], to: [-1, 2], surface: 'tombWall' },
      ],
      field: {
        grid: { origin: [-2, 3], cols: 5, rows: 5 },
        parts: [
          { kind: 'stone', id: 'stone', cell: [2, 2] },
          { kind: 'plate', id: 'plate', at: [0, 0, 4], mode: 'hold' },
          { kind: 'gate', id: 'gate', from: [1.2, 2], to: [2.4, 2], when: 'plate', via: [[1.8, 4]] },
        ],
      },
      decor: [
        { type: 'obelisk', at: [-4.6, -0.9, 7], size: [0.8, 4.2, 0] },
        { type: 'obelisk', at: [-2.8, -0.9, -2.5], size: [0.8, 3.6, 0] },
        { type: 'column', at: [6.4, -0.9, -3], size: [0.35, 2.4, 0] },
        { type: 'column', at: [4.6, -0.9, 5], size: [0.35, 1.2, 0] },
        { type: 'column', at: [6.4, -0.9, 0.5], size: [0.35, 2.4, 0] },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: two blocks, two plates, two gates, and an order. The left block on
    //    its plate opens the small gate; the middle block goes through that gate onto
    //    the plate behind it, which opens the way out.
    {
      id: 'tomb-3',
      par: 5,
      tee: [-2, 0, 8],
      goal: { type: 'cup', position: [3.6, 0, 1.1], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 4, text: { en: 'Finish in four strokes', zh: '四杆完成' } },
      pieces: [
        // The main room
        { type: 'floor', min: [-3.5, 2.5], max: [3.5, 9], surface: 'tombFloor' },
        { type: 'wall', from: [-3.5, 9], to: [3.5, 9], surface: 'tombWall' },
        { type: 'wall', from: [3.5, 9], to: [3.5, 2.5], surface: 'tombWall' },
        { type: 'wall', from: [-3.5, 2.5], to: [-3.5, 9], surface: 'tombWall' },
        // Its north wall: the small gate in the middle, the way out on the right
        ...wallWithDoors([-3.5, 2.5], [3.5, 2.5], [[3, 4], [4.9, 6.1]], 'tombWall', { height: 0.8 }),
        // The alcove behind the small gate, one square big
        { type: 'floor', min: [-0.5, 1.5], max: [0.5, 2.5], surface: 'tombFloor' },
        { type: 'wall', from: [-0.5, 2.5], to: [-0.5, 1.5], surface: 'tombWall', height: 0.8 },
        { type: 'wall', from: [-0.5, 1.5], to: [0.5, 1.5], surface: 'tombWall', height: 0.8 },
        { type: 'wall', from: [0.5, 1.5], to: [0.5, 2.5], surface: 'tombWall', height: 0.8 },
        // The burial chamber
        { type: 'floor', min: [1, -2], max: [5, 2.5], surface: 'tombFloor' },
        { type: 'wall', from: [3.5, 2.5], to: [5, 2.5], surface: 'tombWall' },
        { type: 'wall', from: [5, 2.5], to: [5, -2], surface: 'tombWall' },
        { type: 'wall', from: [5, -2], to: [1, -2], surface: 'tombWall' },
        { type: 'wall', from: [1, -2], to: [1, 2.5], surface: 'tombWall' },
      ],
      field: {
        // The top row is the far side of the north wall: only the alcove's square is open.
        grid: {
          origin: [-3, 2],
          cols: 7,
          rows: 7,
          blocked: [[0, 0], [1, 0], [2, 0], [4, 0], [5, 0], [6, 0]],
        },
        parts: [
          { kind: 'stone', id: 'left', cell: [1, 2] },
          { kind: 'stone', id: 'middle', cell: [3, 2] },
          { kind: 'plate', id: 'first', at: [-2, 0, 3], mode: 'hold' },
          { kind: 'plate', id: 'second', at: [0, 0, 2], mode: 'hold' },
          { kind: 'gate', id: 'small', from: [-0.5, 2.5], to: [0.5, 2.5], when: 'first', via: [[-1, 3]] },
          { kind: 'gate', id: 'exit', from: [1.4, 2.5], to: [2.6, 2.5], when: 'second', via: [[1, 2]] },
        ],
      },
      decor: [
        { type: 'obelisk', at: [-5.2, -0.9, 4], size: [0.8, 4.4, 0] },
        { type: 'obelisk', at: [-1.6, -0.9, -0.6], size: [0.8, 3.6, 0] },
        { type: 'column', at: [6.4, -0.9, 0], size: [0.35, 2.4, 0] },
        { type: 'column', at: [5.2, -0.9, 7], size: [0.35, 2.4, 0] },
        { type: 'column', at: [-5, -0.9, 8], size: [0.35, 1.1, 0] },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58 },
    },
  ],
};
