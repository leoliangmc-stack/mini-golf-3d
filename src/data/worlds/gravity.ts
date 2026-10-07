import type { Vec3 } from '../../core/types';
import type { WorldDef } from '../../level/schema';
import type { ZoneDef } from '../../physics/zones';
import { CUP, FALL } from './common';

/** "Down" leaning hard to the right or to the left: the ball slides that way across the floor. */
const PULL_RIGHT: Vec3 = [5.5, -8.1, 0];
const PULL_LEFT: Vec3 = [-5.5, -8.1, 0];
/** A quarter of normal gravity: jumps go a long way. */
const LIGHT: Vec3 = [0, -2.2, 0];

function zone(center: Vec3, halfExtents: Vec3, gravity: Vec3): ZoneDef {
  return { type: 'gravity', shape: { kind: 'box', center, halfExtents }, params: { gravity } };
}

/**
 * World 6: gravity zones. Inside a coloured zone "down" points somewhere else; the
 * arrows on its floor show where. Outside, everything is normal again.
 */
export const GRAVITY_WORLD: WorldDef = {
  id: 'gravity',
  name: { en: 'Gravity Shift', zh: '重力' },
  theme: 'gravity',
  ruleCard: { en: 'Inside a zone, down is where the arrows point.', zh: '进入彩色区域，重力朝箭头方向。' },
  ruleTag: { en: 'GRAVITY ZONES', zh: '重力区' },
  holes: [
    // 1. Teaching: one zone across a straight lane, pulling right. The cup sits on the
    //    right beyond it, where the pull was taking the ball anyway.
    {
      id: 'gravity-1',
      par: 2,
      tee: [0, 0, 4.5],
      cup: { position: [2, 0, -8], ...CUP },
      challenge: {
        type: 'noWallHits',
        text: { en: 'Hole out without touching a rail', zh: '不碰任何围栏进洞' },
      },
      pieces: [
        { type: 'floor', min: [-3, -10], max: [3, 6], surface: 'neonFloor' },
        { type: 'wall', from: [-3, 6], to: [3, 6], surface: 'padded' },
        { type: 'wall', from: [3, 6], to: [3, -10], surface: 'padded' },
        { type: 'wall', from: [3, -10], to: [-3, -10], surface: 'padded' },
        { type: 'wall', from: [-3, -10], to: [-3, 6], surface: 'padded' },
      ],
      zones: [FALL, zone([0, 1, -1], [3, 2, 3], PULL_RIGHT)],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: right, then left, with a post in the middle of each straight line.
    //    The ball has to be thrown into an S.
    {
      id: 'gravity-2',
      par: 3,
      tee: [0, 0, 4.5],
      cup: { position: [-2, 0, -12], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-3, -14], max: [3, 6], surface: 'neonFloor' },
        { type: 'wall', from: [-3, 6], to: [3, 6], surface: 'padded' },
        { type: 'wall', from: [3, 6], to: [3, -14], surface: 'padded' },
        { type: 'wall', from: [3, -14], to: [-3, -14], surface: 'padded' },
        { type: 'wall', from: [-3, -14], to: [-3, 6], surface: 'padded' },
        { type: 'pillar', at: [0, -3], radius: 0.5, surface: 'padded' },
        { type: 'pillar', at: [0, -9], radius: 0.5, surface: 'padded' },
      ],
      zones: [FALL, zone([0, 1, 0], [3, 2, 2], PULL_RIGHT), zone([0, 1, -6], [3, 2, 2], PULL_LEFT)],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: a ramp into a light-gravity zone floats the ball over a wide gap,
    //    onto an island that tips everything toward its left rail. The right side is open.
    {
      id: 'gravity-3',
      par: 3,
      tee: [0, 0, 7.5],
      cup: { position: [-2.4, 0, -11], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-2, 4], max: [2, 9], surface: 'neonFloor' },
        { type: 'ramp', min: [-1.5, 1], max: [1.5, 4], along: 'z', yFrom: 0.8, yTo: 0, surface: 'neonFloor' },
        { type: 'floor', min: [-3, -14], max: [3, -6], surface: 'neonFloor' },
        { type: 'wall', from: [-2, 9], to: [2, 9], surface: 'padded' },
        { type: 'wall', from: [-2, 4], to: [-2, 9], surface: 'padded' },
        { type: 'wall', from: [2, 4], to: [2, 9], surface: 'padded' },
        { type: 'wall', from: [-3, -14], to: [3, -14], height: 0.8, surface: 'padded' },
        { type: 'wall', from: [-3, -6], to: [-3, -14], surface: 'padded' },
      ],
      zones: [FALL, zone([0, 2.5, -2.5], [3, 4, 4.5], LIGHT), zone([0, 1, -10.5], [3, 2, 3.5], PULL_LEFT)],
      outOfBounds: 'lastPosition',
    },
  ],
};
