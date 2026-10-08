import type { WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';

/** Thick enough that a one-metre step between islands is a solid cliff. */
const ISLAND = 1.2;

/**
 * World 3: falling. Islands have no rails, so every stroke is a question of how hard
 * you dare to hit it. Heights matter: the ball flies off edges and ramps.
 */
export const SKY_WORLD: WorldDef = {
  id: 'sky',
  name: { en: 'Sky Island', zh: '浮空岛' },
  theme: 'sky',
  ruleCard: { en: "No rails up here. Don't fall!", zh: '这里没有围栏，小心坠落！' },
  ruleTag: { en: 'NO RAILS', zh: '无围栏' },
  holes: [
    // 1. Teaching: a bridge to an island with nothing around the cup. Too hard and it is gone.
    {
      id: 'sky-1',
      par: 2,
      tee: [0, 0, 6],
      goal: { type: 'cup', position: [0, 0, -8], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: [
        { type: 'floor', min: [-2.5, 3], max: [2.5, 8], depth: ISLAND, surface: 'grass' },
        { type: 'floor', min: [-1, -5], max: [1, 3], surface: 'grass' },
        { type: 'floor', min: [-3, -11], max: [3, -5], depth: ISLAND, surface: 'grass' },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: a downhill ramp throws the ball across a gap. The far island has a
    //    stone backstop, the only wall in the hole.
    {
      id: 'sky-2',
      par: 3,
      tee: [0, 2, 8.5],
      goal: { type: 'cup', position: [-2.5, 0, -5.5], ...CUP },
      challenge: {
        type: 'noWallHits',
        text: { en: 'Land the jump without using the backstop', zh: '飞跃后不碰挡墙' },
      },
      pieces: [
        { type: 'floor', min: [-2, 6], max: [2, 10], y: 2, depth: ISLAND, surface: 'grass' },
        { type: 'ramp', min: [-1.5, 2], max: [1.5, 6], along: 'z', yFrom: 1, yTo: 2, surface: 'grass' },
        { type: 'floor', min: [-4, -8], max: [4, 0], depth: ISLAND, surface: 'grass' },
        { type: 'wall', from: [-4, -8], to: [4, -8], height: 0.8, surface: 'stone' },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: four small islands stepping down in a zigzag, one backstop each.
    //    Walking the steps costs four strokes; par needs a drop that skips one, and a
    //    brave shot can fall straight from the top to the green. A fall off the course
    //    sends the ball all the way back to the tee.
    {
      id: 'sky-3',
      par: 3,
      tee: [0, 3, 7],
      goal: { type: 'cup', position: [3.5, 0, -5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-1.5, 4], max: [1.5, 8], y: 3, depth: ISLAND, surface: 'grass' },
        { type: 'floor', min: [-1.5, 0], max: [1.5, 4], y: 2, depth: ISLAND, surface: 'grass' },
        { type: 'floor', min: [1.5, -2], max: [5.5, 2], y: 1, depth: ISLAND, surface: 'grass' },
        { type: 'floor', min: [1.5, -7], max: [5.5, -2], depth: ISLAND, surface: 'grass' },
        { type: 'wall', from: [-1.5, 0], to: [1.5, 0], y: 2, height: 0.5, surface: 'stone' },
        { type: 'wall', from: [5.5, -2], to: [5.5, 2], y: 1, height: 0.5, surface: 'stone' },
        { type: 'wall', from: [1.5, -7], to: [5.5, -7], height: 0.5, surface: 'stone' },
      ],
      zones: [FALL],
      outOfBounds: 'tee',
    },
  ],
};
