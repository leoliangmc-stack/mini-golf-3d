import type { Vec2, Vec3 } from '../core/types';
import type { DecorDef, FinaleDef, PieceDef } from '../level/schema';
import type { ZoneDef } from '../physics/zones';
import { growPad, shrinkPad, splitPad } from '../physics/zones/pads';
import { headingVector, tunnelPair, type TunnelEnd } from '../physics/zones/tunnel';
import { bubbles, stream } from '../physics/zones/water';
import { gusts } from '../physics/zones/wind';
import { CUP, FALL, rack, STREET } from './worlds/common';
import { wallWithDoors } from './worlds/ruins';

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
      goal: { type: 'cup', position: [15, 0, -18.5], ...CUP },
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
      goal: {
        type: 'cup',
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

/**
 * Chapter 3, hole 13: a goal in two steps (SPEC v3 2.6). The six pins come first; only
 * when the last one is down does the cup appear. On the way: a turn in mid-air off the
 * launch deck (time freeze), a green pad that makes the ball heavy enough to plough
 * through pins (growing), and a doorway that sends one half at each group (clones).
 * The cup takes the medium ball, so a ball that grew has to shrink again.
 */
export const GRAND_FINALE: FinaleDef = {
  id: 'ch3-finale',
  name: { en: 'The Grand Finale', zh: '压轴大戏' },
  theme: 'carnival',
  ruleCard: {
    en: 'Knock down every pin — then the hole appears.',
    zh: '先撞倒所有木桩，洞口才会出现。',
  },
  ruleTag: { en: 'FINALE', zh: '终局' },
  holes: [
    {
      id: 'ch3-finale',
      par: 5,
      tee: [0, 2, 10],
      goal: {
        type: 'sequence',
        steps: [
          { type: 'knockdown', pins: [...rack([4.05, 0, -4], 2), ...rack([6.95, 0, -4], 2)] },
          { type: 'cup', position: [5.5, 0, -8.5], ...CUP, acceptSize: 'medium' },
        ],
      },
      challenge: { type: 'maxStrokes', strokes: 4, text: { en: 'Finish in four strokes', zh: '四杆完成' } },
      skills: { freeze: 2 },
      maxBalls: 2,
      pieces: [
        // Launch deck: railed, open at the far end, with nothing beyond it
        { type: 'floor', min: [-0.5, 6], max: [0.5, 11], y: 2, depth: 1.6, surface: 'felt' },
        { type: 'wall', from: [-0.5, 11], to: [0.5, 11], y: 2, surface: 'brass' },
        { type: 'wall', from: [-0.5, 11], to: [-0.5, 6], y: 2, surface: 'brass' },
        { type: 'wall', from: [0.5, 11], to: [0.5, 6], y: 2, surface: 'brass' },
        // The main floor. Its west side is open where the ball flies in.
        { type: 'floor', min: [2, -10], max: [9, 6], depth: 1.6, surface: 'felt' },
        { type: 'wall', from: [2, 6], to: [9, 6], surface: 'brass' },
        { type: 'wall', from: [9, 6], to: [9, -10], height: 0.8, surface: 'brass' },
        { type: 'wall', from: [9, -10], to: [2, -10], surface: 'brass' },
        // A screen too tall to fly over from a deck two metres up, and no taller, so as not
        // to hide the pins: the ball has to come down north of the doorway.
        { type: 'wall', from: [2, -10], to: [2, 0], height: 3, thickness: 0.3, surface: 'brass' },
        // The wall across it, as tall as the screen, with the doorway: the only way south
        { type: 'wall', from: [2, 0], to: [4.9, 0], height: 3, thickness: 0.3, surface: 'brass' },
        { type: 'wall', from: [6.1, 0], to: [9, 0], height: 3, thickness: 0.3, surface: 'brass' },
        // Low enough that nothing gets through the doorway without touching the pad in it.
        { type: 'beam', from: [4.9, 0], to: [6.1, 0], clearance: 0.45, height: 2.55, thickness: 0.3, surface: 'brass' },
      ],
      zones: [
        FALL,
        growPad([5.5, 0, 2.5], 0.6),
        splitPad([5.5, 0, 0], 20, 0.5),
        shrinkPad([5.5, 0, -6.5], 0.7),
      ],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 36 },
    },
  ],
};

/**
 * Chapter 4, hole 13: the four worlds of the chapter, one after another (SPEC v4 3.7).
 * A block onto a plate opens the first gate; a crystal turned to its receiver opens the
 * second; the plate behind that one starts a chain that raises a bridge and then opens
 * the temple door. The dragon lies by the door, with a bell either side of the way in:
 * awake, it breathes across the doorway in bursts.
 *
 * The gates stand in the way of each other, so the order needs no rule of its own: the
 * goal is a plain cup.
 */
export const TEMPLE_GATE: FinaleDef = {
  id: 'ch4-finale',
  name: { en: 'The Temple Gate', zh: '神庙大门' },
  theme: 'temple',
  ruleCard: {
    en: 'Stone, light, chain: open the temple gate. Let the dragon sleep.',
    zh: '石块、光路、连锁：打开神庙大门。别吵醒巨龙。',
  },
  ruleTag: { en: 'FINALE', zh: '终局' },
  holes: [
    {
      id: 'ch4-finale',
      par: 6,
      tee: [0, 0, 12],
      goal: { type: 'cup', position: [0, 0, -15], ...CUP },
      challenge: { type: 'partOff', part: 'dragon', text: { en: "Don't wake the dragon", zh: '不要惊醒巨龙' } },
      pieces: [
        // The first chamber: the block and its plate
        { type: 'floor', min: [-4, 6], max: [4, 13], surface: 'tombFloor' },
        { type: 'wall', from: [-4, 13], to: [4, 13], surface: 'templeWall' },
        { type: 'wall', from: [4, 13], to: [4, -8], surface: 'templeWall' },
        { type: 'wall', from: [-4, -8], to: [-4, 13], surface: 'templeWall' },
        ...wallWithDoors([-4, 6], [4, 6], [[5.2, 6.4]], 'templeWall', { height: 0.8 }),
        // The second: the lantern and the crystal
        { type: 'floor', min: [-4, -1], max: [4, 6], surface: 'cavernFloor' },
        ...wallWithDoors([-4, -1], [4, -1], [[1.6, 2.8]], 'templeWall', { height: 0.8 }),
        // The third: the plate behind the door, and the edge of the pit
        { type: 'floor', min: [-4, -8], max: [4, -1], surface: 'jungleFloor' },
        { type: 'wall', from: [-4, -8], to: [-0.8, -8], surface: 'templeWall' },
        { type: 'wall', from: [0.8, -8], to: [4, -8], surface: 'templeWall' },
        // The court of the temple, beyond the pit
        { type: 'floor', min: [-3, -17], max: [3, -10.5], surface: 'hoardFloor' },
        { type: 'wall', from: [-3, -10.5], to: [-0.8, -10.5], surface: 'templeWall' },
        { type: 'wall', from: [0.8, -10.5], to: [3, -10.5], surface: 'templeWall' },
        { type: 'wall', from: [3, -10.5], to: [3, -17], surface: 'templeWall' },
        { type: 'wall', from: [3, -17], to: [-3, -17], surface: 'templeWall' },
        { type: 'wall', from: [-3, -17], to: [-3, -10.5], surface: 'templeWall' },
        ...wallWithDoors([-3, -12.5], [3, -12.5], [[2.3, 3.7]], 'templeWall', { height: 1.2 }),
      ],
      field: {
        grid: { origin: [-3, 7], cols: 7, rows: 6 },
        parts: [
          { kind: 'stone', id: 'block', cell: [3, 2] },
          { kind: 'plate', id: 'hold', at: [0, 0, 8], mode: 'hold' },
          { kind: 'gate', id: 'first', from: [1.2, 6], to: [2.4, 6], when: 'hold', via: [[1.8, 8]] },

          { kind: 'emitter', at: [-3.6, 0, 3.5], heading: 90 },
          { kind: 'crystal', id: 'crystal', at: [2.7, 0, 3.5], facings: [90, 0] },
          { kind: 'receiver', id: 'receiver', at: [2.7, 0, -0.4] },
          { kind: 'gate', id: 'second', from: [-2.4, -1], to: [-1.2, -1], when: 'receiver', via: [[2.7, -0.4], [-1.8, -0.4]] },

          { kind: 'plate', id: 'start', at: [-1.8, 0, -1.9], mode: 'latch', radius: 0.7 },
          {
            kind: 'slider',
            id: 'bridge',
            role: 'platform',
            look: 'bridge',
            size: [1.6, 0.4, 2.7],
            from: [0, -1.7, -9.25],
            to: [0, -0.196, -9.25],
            ticks: 50,
            when: 'start',
            via: [[-1.8, -7.4], [0, -7.4]],
            surface: 'templeStone',
          },
          {
            kind: 'gate',
            id: 'door',
            from: [-0.7, -12.5],
            to: [0.7, -12.5],
            when: 'bridge',
            delay: 25,
            height: 1.2,
            look: 'door',
            via: [[-1.4, -10.9], [-1.4, -12.1]],
          },

          { kind: 'bell', at: [-0.8, 0, -11.3] },
          { kind: 'bell', at: [0.8, 0, -11.3] },
          { kind: 'dragon', id: 'dragon', at: [4.4, 0, -12], heading: 270, threshold: 1 },
          {
            kind: 'fire',
            id: 'breath',
            shape: { kind: 'box', center: [0, 0.3, -12], halfExtents: [3, 0.5, 0.3] },
            when: 'dragon',
            cycle: { period: 3, burn: 0.45 },
            rest: [[0, 0, -10.9]],
          },
        ],
      },
      decor: [
        { type: 'obelisk', at: [-5.4, -0.9, 10], size: [0.8, 4.4, 0] },
        { type: 'obelisk', at: [5.4, -0.9, 10], size: [0.8, 4.4, 0] },
        { type: 'crystals', at: [-5.4, -0.9, 2.5], size: [2, 0, 0] },
        { type: 'crystals', at: [5.5, -0.9, 1], size: [1.6, 0, 0] },
        { type: 'palm', at: [-5.4, -0.9, -4], size: [3.6, 0, 0] },
        { type: 'palm', at: [5.4, -0.9, -6], size: [3.2, 0, 0] },
        { type: 'column', at: [-4.3, -0.9, -11.5], size: [0.4, 3, 0] },
        { type: 'column', at: [-4.3, -0.9, -15.5], size: [0.4, 3, 0] },
        { type: 'column', at: [4.3, -0.9, -16.2], size: [0.4, 3, 0] },
        { type: 'goldHeap', at: [0, -0.9, -18.6], size: [1.4, 0, 0] },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 34 },
    },
  ],
};

/**
 * Chapter 5, hole 13: water on its way down, from the spring to the canyon (SPEC v5
 * 3.6). A current carries the ball to a column of bubbles, which sets it on a high
 * deck; from the deck it jumps, in a lull between two cross winds, down into a drift
 * of snow; a valve fills a pool and the raft in it makes a bridge; and the last of the
 * way is cracked slabs. The ground and the works keep the order by themselves.
 */
export const SPRING_TO_CANYON: FinaleDef = {
  id: 'ch5-finale',
  name: { en: 'From Spring to Canyon', zh: '源头到峡谷' },
  theme: 'spring',
  ruleCard: {
    en: 'Water, wind, a valve and a bridge that will not wait.',
    zh: '水流、风、阀门，还有一座不等人的桥。',
  },
  ruleTag: { en: 'FINALE', zh: '终局' },
  holes: [
    {
      id: 'ch5-finale',
      par: 6,
      tee: [0, 0, 14.5],
      goal: { type: 'cup', position: [0, 0, -24.5], ...CUP },
      challenge: { type: 'noUndo', text: { en: 'Take no stroke back', zh: '不使用撤销' } },
      pieces: [
        // The spring: a pool that narrows to the foot of the column
        { type: 'floor', min: [-2.5, 8], max: [2.5, 16], surface: 'seabed' },
        { type: 'wall', from: [-2.5, 16], to: [2.5, 16], surface: 'coral' },
        { type: 'wall', from: [-2.5, 10.5], to: [-2.5, 16], surface: 'coral' },
        { type: 'wall', from: [2.5, 16], to: [2.5, 10.5], surface: 'coral' },
        { type: 'wall', from: [-2.5, 10.5], to: [-0.75, 8.2], surface: 'coral' },
        { type: 'wall', from: [0.75, 8.2], to: [2.5, 10.5], surface: 'coral' },
        // The deck above it, with the jump at its far end
        { type: 'floor', min: [-2, 2], max: [2, 8], y: 3, depth: 3.45, surface: 'packedSnow' },
        { type: 'ramp', min: [-1, 0], max: [1, 2], along: 'z', yFrom: 3.7, yTo: 3, depth: 3.45, surface: 'packedSnow' },
        { type: 'wall', from: [-2, 2], to: [-2, 8], y: 3, surface: 'stationWall' },
        { type: 'wall', from: [2, 8], to: [2, 2], y: 3, surface: 'stationWall' },
        { type: 'wall', from: [-2, 2], to: [-1, 2], y: 3, surface: 'stationWall' },
        { type: 'wall', from: [1, 2], to: [2, 2], y: 3, surface: 'stationWall' },
        // Where the jump comes down: a drift of snow, then the bank of the pool
        { type: 'floor', min: [-3, -5], max: [3, -4], depth: 2.8, surface: 'concrete' },
        { type: 'floor', min: [-3, -8], max: [3, -5], depth: 2.8, surface: 'drift' },
        { type: 'floor', min: [-3, -10], max: [3, -8], depth: 2.8, surface: 'concrete' },
        { type: 'wall', from: [-3, -10], to: [-3, -4], height: 0.8, surface: 'damWall' },
        { type: 'wall', from: [3, -4], to: [3, -10], height: 0.8, surface: 'damWall' },
        { type: 'wall', from: [-3, -10], to: [-1, -10], surface: 'damWall' },
        { type: 'wall', from: [1.55, -10], to: [3, -10], surface: 'damWall' },
        // The sides of the pool
        { type: 'wall', from: [-2.5, -14], to: [-2.5, -10], y: -2.5, height: 2.85, surface: 'damWall' },
        { type: 'wall', from: [2.5, -10], to: [2.5, -14], y: -2.5, height: 2.85, surface: 'damWall' },
        // The mesa beyond it, the bridge, and the last of the ground
        { type: 'floor', min: [-2.5, -18], max: [2.5, -14], depth: 3, surface: 'mesa' },
        { type: 'wall', from: [-2.5, -18], to: [-2.5, -14], surface: 'canyonWall' },
        { type: 'wall', from: [2.5, -14], to: [2.5, -18], surface: 'canyonWall' },
        ...wallWithDoors([-2.5, -18], [2.5, -18], [[1.6, 3.4]], 'canyonWall'),
        { type: 'floor', min: [-2.5, -27], max: [2.5, -22], depth: 3, surface: 'mesa' },
        ...wallWithDoors([-2.5, -22], [2.5, -22], [[1.6, 3.4]], 'canyonWall'),
        { type: 'wall', from: [-2.5, -27], to: [2.5, -27], height: 0.8, surface: 'canyonWall' },
        { type: 'wall', from: [-2.5, -27], to: [-2.5, -22], surface: 'canyonWall' },
        { type: 'wall', from: [2.5, -22], to: [2.5, -27], surface: 'canyonWall' },
      ],
      field: {
        parts: [
          { kind: 'water', id: 'pool', min: [-2.5, -14], max: [2.5, -10], level: -1, levels: [{ level: -0.1, when: 'valve' }] },
          { kind: 'float', id: 'raft', water: 'pool', at: [0, -12], size: [2, 0.4, 4.2], freeboard: 0.104, surface: 'raft' },
          { kind: 'valve', id: 'valve', at: [1.3, 0, -10.05], depth: 1.2 },
          { kind: 'crumble', id: 'first', at: [0, 0, -18.667], size: [1.8, 1.533] },
          { kind: 'crumble', id: 'second', at: [0, 0, -20], size: [1.8, 1.533] },
          { kind: 'crumble', id: 'third', at: [0, 0, -21.333], size: [1.8, 1.533] },
        ],
      },
      decor: [
        { type: 'coral', at: [-4.2, 0.0, 13], size: [1.8, 0, 0] },
        { type: 'kelp', at: [4.2, 0.0, 12], size: [3, 0, 0] },
        { type: 'crystals', at: [-4.4, -3.6, 3], size: [3.4, 0, 0], color: 0xbfe6ff },
        { type: 'crystals', at: [4.4, -3.6, 5], size: [3, 0, 0], color: 0xbfe6ff },
        { type: 'pipe', at: [-5, 0, -7], size: [4, 0.35, 0], yaw: 90 },
        { type: 'column', at: [5, -3.6, -8], size: [0.5, 3.8, 0], color: 0x9aa3ab },
        { type: 'rock', at: [-6.6, -3.6, -19.5], size: [2.6, 0, 0], color: 0xb8623a },
        { type: 'obelisk', at: [5.2, -3.6, -20], size: [1.5, 6.5, 0], color: 0xb8623a },
        { type: 'rock', at: [5.6, -3.6, -25], size: [2.4, 0, 0], color: 0xb8623a },
      ],
      zones: [
        { type: 'outOfBounds', shape: { kind: 'box', center: [0, -9, 0], halfExtents: [80, 5, 80] } },
        stream([-2.5, 9.2], [2.5, 12.5], [0, -3]),
        bubbles([0, 0, 8.45], 3.5, [0, 0.6, -3.2], 0.6),
        gusts(
          { kind: 'box', center: [0, 4, -3], halfExtents: [9, 6, 6] },
          [[-7, 0], [0, 0], [7, 0], [0, 0]],
          2,
          [-1.6, 3, 2.5],
        ),
      ],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 40 },
    },
  ],
};
