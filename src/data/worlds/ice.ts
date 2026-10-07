import type { WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';


/**
 * World 1: ground surfaces. Snow rolls normally, ice barely slows the ball.
 * +X is right, -Z is away from the camera, units are metres.
 */
export const ICE_WORLD: WorldDef = {
  id: 'ice',
  name: { en: 'Snow & Ice', zh: '冰雪' },
  theme: 'ice',
  ruleCard: { en: 'Ice is slippery!', zh: '冰面很滑！' },
  ruleTag: { en: 'ICE', zh: '冰面' },
  holes: [
    // 1. Teaching: one straight lane. The same pull goes much further once it reaches the ice.
    {
      id: 'ice-1',
      par: 2,
      tee: [0, 0, 4.5],
      cup: { position: [0, 0, -7], ...CUP },
      hints: ['slingshot'],
      challenge: {
        type: 'noWallHits',
        text: { en: 'Hole out without touching a rail', zh: '不碰任何围栏进洞' },
      },
      pieces: [
        { type: 'floor', min: [-2, 3], max: [2, 6], surface: 'snow' },
        { type: 'floor', min: [-2, -4], max: [2, 3], surface: 'ice' },
        { type: 'floor', min: [-2, -10], max: [2, -4], surface: 'snow' },
        { type: 'wall', from: [-2, 6], to: [2, 6], surface: 'woodRail' },
        { type: 'wall', from: [2, 6], to: [2, -10], surface: 'woodRail' },
        { type: 'wall', from: [2, -10], to: [-2, -10], surface: 'woodRail' },
        { type: 'wall', from: [-2, -10], to: [-2, 6], surface: 'woodRail' },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: an ice ramp. Too soft and the ball slides all the way back down;
    //    then a strip of ice lies between the landing and the cup.
    {
      id: 'ice-2',
      par: 2,
      tee: [0, 0, 4.5],
      cup: { position: [5.5, 1, -6], ...CUP },
      challenge: {
        type: 'firstStrokeInto',
        shape: { kind: 'box', center: [5.5, 1, -6], halfExtents: [1.5, 1, 2] },
        text: { en: 'Reach the far green in one stroke', zh: '一杆打上远端果岭' },
      },
      pieces: [
        { type: 'floor', min: [-2, 2], max: [2, 6], surface: 'snow' },
        { type: 'ramp', min: [-2, -4], max: [2, 2], along: 'z', yFrom: 1, yTo: 0, surface: 'ice' },
        { type: 'floor', min: [-2, -8], max: [2, -4], y: 1, surface: 'snow' },
        { type: 'floor', min: [2, -8], max: [4, -4], y: 1, surface: 'ice' },
        { type: 'floor', min: [4, -8], max: [7, -4], y: 1, surface: 'snow' },
        // Lower pad
        { type: 'wall', from: [-2, 6], to: [2, 6], surface: 'woodRail' },
        { type: 'wall', from: [-2, 6], to: [-2, 2], surface: 'woodRail' },
        { type: 'wall', from: [2, 6], to: [2, 2], surface: 'woodRail' },
        // Ramp rails
        { type: 'wall', from: [-2, 2], to: [-2, -4], y: [0, 1], surface: 'woodRail' },
        { type: 'wall', from: [2, 2], to: [2, -4], y: [0, 1], surface: 'woodRail' },
        // Upper level. The back rail is taller to catch balls that leave the ramp airborne.
        { type: 'wall', from: [-2, -4], to: [-2, -8], y: 1, surface: 'woodRail' },
        { type: 'wall', from: [-2, -8], to: [7, -8], y: 1, height: 0.6, surface: 'woodRail' },
        { type: 'wall', from: [7, -8], to: [7, -4], y: 1, surface: 'woodRail' },
        { type: 'wall', from: [7, -4], to: [2, -4], y: 1, surface: 'woodRail' },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: a narrow ice bridge with no rails leads straight to a walled ice
    //    rink with the cup in a snow corner. The long snow lane on the left is safe but slow.
    {
      id: 'ice-3',
      par: 3,
      tee: [0, 0, 5.5],
      cup: { position: [2, 0, -8], ...CUP },
      challenge: {
        type: 'firstStrokeInto',
        shape: { kind: 'box', center: [0, 0, -6], halfExtents: [3, 1, 3] },
        text: { en: 'Cross the bridge in one stroke', zh: '一杆过桥' },
      },
      pieces: [
        { type: 'floor', min: [-2, 3], max: [2, 7], surface: 'snow' },
        { type: 'floor', min: [-0.5, -3], max: [0.5, 3], surface: 'ice' },
        // Listed before the rink so the snow wins where they overlap.
        { type: 'floor', min: [1, -9], max: [3, -7], surface: 'snow' },
        { type: 'floor', min: [-3, -9], max: [3, -3], surface: 'ice' },
        // Safe route
        { type: 'floor', min: [-6, 3], max: [-2, 7], surface: 'snow' },
        { type: 'floor', min: [-6, -9], max: [-3, 3], surface: 'snow' },
        // Start side
        { type: 'wall', from: [-6, 7], to: [2, 7], surface: 'woodRail' },
        { type: 'wall', from: [2, 7], to: [2, 3], surface: 'woodRail' },
        { type: 'wall', from: [2, 3], to: [1, 3], surface: 'woodRail' },
        { type: 'wall', from: [-1, 3], to: [-3, 3], surface: 'woodRail' },
        { type: 'wall', from: [-6, 7], to: [-6, -9], surface: 'woodRail' },
        // Divider between the safe lane and the gap, open at the far end
        { type: 'wall', from: [-3, 3], to: [-3, -6.5], surface: 'woodRail' },
        // Rink
        { type: 'wall', from: [-6, -9], to: [3, -9], surface: 'iceWall' },
        { type: 'wall', from: [3, -9], to: [3, -3], surface: 'iceWall' },
        { type: 'wall', from: [3, -3], to: [1, -3], surface: 'iceWall' },
        { type: 'wall', from: [-1, -3], to: [-3, -3], surface: 'iceWall' },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },
  ],
};
