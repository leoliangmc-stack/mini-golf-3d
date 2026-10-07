import type { Vec2, Vec3 } from '../core/types';
import type { DecorDef, FinaleDef, PieceDef } from '../level/schema';
import type { ZoneDef } from '../physics/zones';
import { headingVector, tunnelPair, type TunnelEnd } from '../physics/zones/tunnel';
import { CUP, FALL, STREET } from './worlds/common';

const magnet = (x: number, z: number, strength: number, reach: number): { post: PieceDef; field: ZoneDef } => ({
  post: { type: 'pillar', at: [x, z], radius: 0.35, surface: strength > 0 ? 'magnetRed' : 'magnetBlue' },
  field: { type: 'magnet', shape: { kind: 'sphere', center: [x, 0, z], radius: reach }, params: { strength } },
});

// Neither stands on the way through (SPEC 3): the blue one nudges a passing ball toward
// the lane, the red one catches a ball that overshoots it.
const gauntletMagnets = [magnet(18, -6.6, 9, 3.2), magnet(14.5, -1.8, -10, 3.4)];
/** "Down" leaning hard to the right: the ball slides that way across the floor. */
const PULL_RIGHT: Vec3 = [5.5, -8.1, 0];

/**
 * Chapter 1, hole 19: one stretch of each of the six worlds, in the order they were
 * learned. Ice with nothing to stop a fall, a bank off stone, a gate on a rhythm,
 * a pair of magnets, and a gravity zone pulling toward an open edge.
 */
export const GAUNTLET: FinaleDef = {
  id: 'ch1-finale',
  name: { en: 'The Gauntlet', zh: '终极试炼' },
  theme: 'summit',
  ruleCard: { en: "Everything you've learned, in one hole.", zh: '学过的一切，都在这一洞。' },
  ruleTag: { en: 'FINALE', zh: '终局' },
  holes: [
    {
      id: 'ch1-finale',
      par: 5,
      tee: [0, 0, 10.5],
      cup: { position: [15, 0, -18.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 4, text: { en: 'Finish in four strokes', zh: '四杆完成' } },
      pieces: [
        // Snow pad and the ice bridge off it: no rails.
        { type: 'floor', min: [-2, 8], max: [2, 12], surface: 'snow' },
        { type: 'floor', min: [-1, 2], max: [1, 8], surface: 'ice' },
        { type: 'wall', from: [-2, 12], to: [2, 12], surface: 'woodRail' },
        { type: 'wall', from: [-2, 8], to: [-2, 12], surface: 'woodRail' },
        { type: 'wall', from: [2, 8], to: [2, 12], surface: 'woodRail' },
        // Stone room: the slanted wall turns a ball off the bridge toward the way out.
        { type: 'floor', min: [-3, -6], max: [5, 2], surface: 'sandstone' },
        { type: 'wall', from: [-3, 2], to: [-1, 2], surface: 'stone' },
        { type: 'wall', from: [1, 2], to: [5, 2], surface: 'stone' },
        { type: 'wall', from: [-3, 2], to: [-3, -6], surface: 'stone' },
        { type: 'wall', from: [-3, -6], to: [5, -6], surface: 'stone' },
        { type: 'wall', from: [5, 2], to: [5, -2.5], surface: 'stone' },
        { type: 'wall', from: [5, -5.5], to: [5, -6], surface: 'stone' },
        { type: 'wall', from: [-3, -2], to: [1, -6], surface: 'stone' },
        // Deck corridor, with the gate across it.
        { type: 'floor', min: [5, -5.5], max: [11, -2.5], surface: 'deck' },
        { type: 'wall', from: [5, -2.5], to: [11, -2.5], surface: 'plank' },
        { type: 'wall', from: [5, -5.5], to: [11, -5.5], surface: 'plank' },
        // Steel hall with the magnets.
        { type: 'floor', min: [11, -8], max: [19, 0], surface: 'steel' },
        { type: 'wall', from: [11, 0], to: [19, 0], surface: 'iron' },
        { type: 'wall', from: [19, 0], to: [19, -8], surface: 'iron' },
        { type: 'wall', from: [11, 0], to: [11, -2.5], surface: 'iron' },
        { type: 'wall', from: [11, -5.5], to: [11, -8], surface: 'iron' },
        { type: 'wall', from: [11, -8], to: [13, -8], surface: 'iron' },
        { type: 'wall', from: [17, -8], to: [19, -8], surface: 'iron' },
        ...gauntletMagnets.map((m) => m.post),
        // Neon lane: a rail on the left only. The zone pulls toward the open side.
        { type: 'floor', min: [13, -20], max: [17, -8], surface: 'neonFloor' },
        { type: 'wall', from: [13, -8], to: [13, -20], surface: 'padded' },
        { type: 'wall', from: [13, -20], to: [17, -20], height: 0.6, surface: 'padded' },
        { type: 'wall', from: [17, -17], to: [17, -20], surface: 'padded' },
        { type: 'wall', from: [17, -8], to: [17, -10], surface: 'padded' },
      ],
      movers: [
        {
          role: 'pusher',
          size: [0.4, 0.6, 1.4],
          position: [8, 0.3, -4.4],
          surface: 'driftwood',
          motion: { type: 'slide', offset: [0, 0, 0.8], period: 4, hold: [0.3, 0.3] },
          sweep: { kind: 'box', center: [8, 0.3, -4], halfExtents: [0.5, 0.5, 1.5] },
          rest: [
            [6.5, 0, -4],
            [9.5, 0, -4],
          ],
        },
      ],
      zones: [
        FALL,
        ...gauntletMagnets.map((m) => m.field),
        { type: 'gravity', shape: { kind: 'box', center: [15, 1, -13.5], halfExtents: [2, 2, 3] }, params: { gravity: PULL_RIGHT } },
      ],
      outOfBounds: 'lastPosition',
    },
  ],
};

const TRUNK_RADIUS = 0.55;
const TRUNK_HEIGHT = 2.2;

/** A tree in a planter on a roof at height `y`, with a hollow facing the compass heading `facing`. */
function roofTree(x: number, z: number, y: number, facing: number): { trunk: PieceDef; leaves: DecorDef; end: TunnelEnd } {
  const dir = headingVector(facing);
  return {
    trunk: { type: 'pillar', at: [x, z], y, radius: TRUNK_RADIUS, height: TRUNK_HEIGHT, surface: 'bark' },
    leaves: { type: 'canopy', at: [x, y + TRUNK_HEIGHT, z], size: [1.05, 1.6, 0] },
    end: { at: [x + dir.x * TRUNK_RADIUS, y, z + dir.z * TRUNK_RADIUS], facing },
  };
}

function building(min: Vec2, max: Vec2, y: number, surface: string): { roof: PieceDef; lights: DecorDef } {
  return {
    roof: { type: 'floor', min, max, y, depth: y, surface },
    lights: {
      type: 'windows',
      at: [(min[0] + max[0]) / 2, 0, (min[1] + max[1]) / 2],
      size: [max[0] - min[0], y, max[1] - min[1]],
    },
  };
}

const parapet = (from: Vec2, to: Vec2, y: number, height?: number): PieceDef => ({
  type: 'wall',
  from,
  to,
  y,
  height,
  surface: 'parapet',
});

const clock = (x: number, y: number, z: number, seconds: number): ZoneDef => ({
  type: 'timeBonus',
  shape: { kind: 'sphere', center: [x, y, z], radius: 0.55 },
  params: { seconds },
});

const garden = building([-3, 3], [3, 10], 6, 'tar');
const terrace = building([6, -6], [12, 2], 4, 'terracotta');
const plaza = building([-2, -14], [12, -6], 2, 'rooftop');
const treeIn = roofTree(0, 3.75, 6, 180);
const treeOut = roofTree(11.25, -2, 4, 270);

/**
 * Chapter 2, hole 13: the four worlds at once, at night. A fuse is burning from the
 * first stroke. The only way off the roof garden is the hollow tree, which comes out
 * on another building; from there it is a drop to the plaza, where the cup will not
 * keep still.
 */
export const COUNTDOWN_RUN: FinaleDef = {
  id: 'ch2-finale',
  name: { en: 'Countdown Run', zh: '倒数冲刺' },
  theme: 'midnight',
  ruleCard: {
    en: 'A tunnel, a drop, a moving hole — all against the clock.',
    zh: '树洞、落差、移动球洞——全程与倒计时赛跑。',
  },
  ruleTag: { en: 'FINALE', zh: '终局' },
  holes: [
    {
      id: 'ch2-finale',
      par: 3,
      timer: { seconds: 20 },
      tee: [0, 6, 8.5],
      cup: {
        position: [1, 2, -11],
        ...CUP,
        motion: { type: 'slide', offset: [6, 0, 0], period: 8, hold: [0.1, 0.1] },
      },
      challenge: { type: 'timeLeft', seconds: 10, text: { en: 'Finish with 10 seconds left', zh: '剩余 10 秒以上完成' } },
      pieces: [
        garden.roof,
        terrace.roof,
        plaza.roof,
        // Roof garden: walled all round. The tree is the way out.
        parapet([-3, 10], [3, 10], 6),
        parapet([-3, 3], [-3, 10], 6),
        parapet([3, 3], [3, 10], 6),
        parapet([-3, 3], [3, 3], 6),
        treeIn.trunk,
        // Terrace: open toward the plaza below.
        parapet([6, 2], [12, 2], 4),
        parapet([12, -6], [12, 2], 4),
        parapet([6, -6], [6, 2], 4, 0.5),
        treeOut.trunk,
        // Plaza: walled on the three outer sides.
        parapet([-2, -14], [12, -14], 2, 0.6),
        parapet([-2, -14], [-2, -6], 2),
        parapet([12, -14], [12, -6], 2),
        parapet([-2, -6], [6, -6], 2),
        { type: 'pillar', at: [8.5, -8.8], y: 2, radius: 0.3, height: 0.8, surface: 'duct' },
      ],
      decor: [
        garden.lights,
        terrace.lights,
        plaza.lights,
        treeIn.leaves,
        treeOut.leaves,
        { type: 'tower', at: [-9, 0, 0], size: [5, 9, 8], color: 0x2c3558 },
        { type: 'tower', at: [-9, 0, -11], size: [6, 5, 6], color: 0x343c63 },
        { type: 'tower', at: [17, 0, 4], size: [5, 11, 6], color: 0x2a3152 },
        { type: 'tower', at: [17.5, 0, -8], size: [5, 6, 8], color: 0x363f69 },
        { type: 'tower', at: [5, 0, -19], size: [10, 7, 4], color: 0x2c3558 },
        { type: 'antenna', at: [17, 11, 4] },
        { type: 'waterTank', at: [-9, 9, 0] },
      ],
      zones: [
        STREET,
        tunnelPair(treeIn.end, treeOut.end, { color: 0x7ee0a1 }),
        clock(2, 6, 6, 6),
        clock(9, 4, -4.5, 8),
      ],
      outOfBounds: 'lastPosition',
    },
  ],
};
