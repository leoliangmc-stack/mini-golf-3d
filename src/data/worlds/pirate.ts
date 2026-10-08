import type { WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';

/**
 * World 4: moving parts. Everything here runs on a fixed rhythm and keeps running
 * while you aim, so the question is not only where to hit the ball but when.
 */
export const PIRATE_WORLD: WorldDef = {
  id: 'pirate',
  name: { en: 'Pirate Island', zh: '海盗岛' },
  theme: 'pirate',
  ruleCard: { en: 'Watch the rhythm. Timing is everything!', zh: '看准节奏，把握时机！' },
  ruleTag: { en: 'TIMING', zh: '时机' },
  holes: [
    // 1. Teaching: one sliding gate across a straight lane. It parks on the left, then on
    //    the right; the middle is never clear for long.
    {
      id: 'pirate-1',
      par: 2,
      tee: [0, 0, 4.5],
      goal: { type: 'cup', position: [0, 0, -8], ...CUP },
      challenge: { type: 'noMoverHits', text: { en: 'Never touch the gate', zh: '全程不碰闸板' } },
      pieces: [
        { type: 'floor', min: [-2, -10], max: [2, 6], surface: 'deck' },
        { type: 'wall', from: [-2, 6], to: [2, 6], surface: 'plank' },
        { type: 'wall', from: [2, 6], to: [2, -10], surface: 'plank' },
        { type: 'wall', from: [2, -10], to: [-2, -10], surface: 'plank' },
        { type: 'wall', from: [-2, -10], to: [-2, 6], surface: 'plank' },
      ],
      movers: [
        {
          role: 'pusher',
          size: [2, 0.6, 0.4],
          position: [-0.6, 0.3, -2],
          surface: 'driftwood',
          motion: { type: 'slide', offset: [1.2, 0, 0], period: 4, hold: [0.3, 0.3] },
          sweep: { kind: 'box', center: [0, 0.3, -2], halfExtents: [2, 0.5, 0.5] },
          rest: [
            [0, 0, -0.5],
            [0, 0, -3.5],
          ],
        },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: two decks and open water. The only way across is a bridge that lines
    //    up for a few seconds, then swings away.
    {
      id: 'pirate-2',
      par: 2,
      tee: [0, 0, 7.5],
      goal: { type: 'cup', position: [0, 0, -7], ...CUP },
      challenge: {
        type: 'noWallHits',
        text: { en: 'Hole out without touching a rail', zh: '不碰任何围栏进洞' },
      },
      pieces: [
        { type: 'floor', min: [-3, 4], max: [3, 9], surface: 'deck' },
        { type: 'floor', min: [-3, -10], max: [3, -3], surface: 'deck' },
        { type: 'wall', from: [-3, 9], to: [3, 9], surface: 'plank' },
        { type: 'wall', from: [-3, 4], to: [-3, 9], surface: 'plank' },
        { type: 'wall', from: [3, 4], to: [3, 9], surface: 'plank' },
        { type: 'wall', from: [-3, -10], to: [3, -10], surface: 'plank' },
        { type: 'wall', from: [-3, -3], to: [-3, -10], surface: 'plank' },
        { type: 'wall', from: [3, -3], to: [3, -10], surface: 'plank' },
      ],
      movers: [
        {
          // Top sits 6 mm above the decks and overlaps each by 30 cm.
          role: 'platform',
          size: [1.6, 0.3, 7.6],
          position: [0, -0.144, 0.5],
          surface: 'driftwood',
          motion: { type: 'swing', pivot: [0, 0.5], angle: 70, period: 8, hold: [0.35, 0.15] },
          rest: [
            [0, 0, 5],
            [0, 0, -4],
          ],
        },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: get past a gate into the cannon, fly over the water, then deal with
    //    a second gate patrolling in front of the cup.
    {
      id: 'pirate-3',
      par: 3,
      tee: [0, 0, 6.5],
      // Off the cannon's line, so the flight alone does not find it.
      goal: { type: 'cup', position: [2, 0, -16.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-3, 1], max: [3, 8], surface: 'deck' },
        { type: 'floor', min: [-3, -18], max: [3, -9], surface: 'deck' },
        { type: 'wall', from: [-3, 8], to: [3, 8], surface: 'plank' },
        { type: 'wall', from: [-3, 1], to: [-3, 8], surface: 'plank' },
        { type: 'wall', from: [3, 1], to: [3, 8], surface: 'plank' },
        { type: 'wall', from: [-3, -18], to: [3, -18], surface: 'plank' },
        { type: 'wall', from: [-3, -9], to: [-3, -18], surface: 'plank' },
        { type: 'wall', from: [3, -9], to: [3, -18], surface: 'plank' },
      ],
      movers: [
        {
          role: 'pusher',
          size: [2.4, 0.6, 0.4],
          position: [-1.4, 0.3, 3.2],
          surface: 'driftwood',
          motion: { type: 'slide', offset: [2.8, 0, 0], period: 5, hold: [0.3, 0.3] },
          sweep: { kind: 'box', center: [0, 0.3, 3.2], halfExtents: [3, 0.5, 0.5] },
          rest: [[0, 0, 4.5]],
        },
        {
          role: 'pusher',
          size: [1.6, 0.6, 0.4],
          position: [-1.2, 0.3, -14],
          surface: 'driftwood',
          motion: { type: 'slide', offset: [2.4, 0, 0], period: 3 },
          sweep: { kind: 'box', center: [0, 0.3, -14], halfExtents: [3, 0.5, 0.5] },
          rest: [
            [0, 0, -12.5],
            [0, 0, -15.2],
          ],
        },
      ],
      zones: [
        FALL,
        {
          type: 'launcher',
          shape: { kind: 'sphere', center: [0, 0.15, 1.6], radius: 0.45 },
          params: { exit: [0, 1.1, 1], direction: [0, 0.6, -0.8], speed: 11, delay: 40 },
        },
      ],
      outOfBounds: 'lastPosition',
    },
  ],
};
