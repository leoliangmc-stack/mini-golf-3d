import type { Vec2, Vec3 } from '../core/types';
import type { Cell } from '../level/field';
import type { DecorDef, FinaleDef, PieceDef } from '../level/schema';
import type { ZoneDef } from '../physics/zones';
import { robotArm } from '../physics/zones/arm';
import { coaster } from '../physics/zones/coaster';
import { drumPad } from '../physics/zones/drum';
import { growPad, shrinkPad, splitPad } from '../physics/zones/pads';
import { headingVector, tunnelPair, type TunnelEnd } from '../physics/zones/tunnel';
import { bubbles, stream } from '../physics/zones/water';
import { gusts } from '../physics/zones/wind';
import { hall } from '../physics/zones/wrap';
import { FAST } from './worlds/clock';
import { CUP, FALL, rack, STREET, walledRoom } from './worlds/common';
import { SKIRT } from './worlds/hall';
import { rotor, stubs } from './worlds/maze';
import { BEAT, shutter } from './worlds/music';
import { chaser, patrol } from './worlds/den';
import { key, lockedDoor } from './worlds/dungeon';
import { swapLever } from './worlds/haunted';
import { boss } from './worlds/lair';
import { phantomBridge } from './worlds/phantom';
import { line, LINE_BLUE, LINE_ORANGE, points, train } from './worlds/rail';
import { wallWithDoors } from './worlds/ruins';
import { subway } from './worlds/subway';
import { belt, beltFloor, lever } from './worlds/toy';

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

/**
 * Chapter 6, hole 13: a production line, and the ball is what it makes (SPEC v6 3.6).
 * A belt that has to be turned round, an arm that has to be caught on the right trip,
 * a gate and a drum on the beat, and a piston that a clock switch slows. Each leads to
 * the next and to nowhere else, so the order needs no rule.
 */
export const PRODUCTION_LINE: FinaleDef = {
  id: 'ch6-finale',
  name: { en: 'Production Line', zh: '一条生产线' },
  theme: 'works',
  ruleCard: {
    en: 'A belt, an arm, a beat and a clock: the whole line, end to end.',
    zh: '输送带、机械臂、节拍、时钟：整条流水线，从头走到尾。',
  },
  ruleTag: { en: 'FINALE', zh: '终局' },
  holes: [
    {
      id: 'ch6-finale',
      par: 7,
      beat: { ticks: BEAT },
      tee: [0, 0, 17.5],
      goal: { type: 'cup', position: [0, 1, -20], ...CUP },
      challenge: { type: 'noMoverHits', text: { en: 'Never touch a moving machine', zh: '不碰任何运动中的机器' } },
      pieces: [
        // The toy factory: a room, and the belt out of it
        { type: 'floor', min: [-2.5, 14], max: [2.5, 19], surface: 'toyFloor' },
        beltFloor([-1, 8], [1, 14]),
        { type: 'wall', from: [-2.5, 19], to: [2.5, 19], surface: 'toyBlockRed' },
        { type: 'wall', from: [-2.5, 14], to: [-2.5, 19], surface: 'toyBlockRed' },
        { type: 'wall', from: [2.5, 19], to: [2.5, 14], surface: 'toyBlockRed' },
        { type: 'wall', from: [-2.5, 14], to: [-1, 14], surface: 'toyBlockRed' },
        { type: 'wall', from: [1, 14], to: [2.5, 14], surface: 'toyBlockRed' },
        { type: 'wall', from: [-1, 14], to: [-1, 8], surface: 'toyBlock' },
        { type: 'wall', from: [1, 8], to: [1, 14], surface: 'toyBlock' },
        // The assembly line: the station the belt ends at
        { type: 'floor', min: [-2.5, 3.5], max: [2.5, 8], surface: 'plant' },
        { type: 'wall', from: [-2.5, 8], to: [-1, 8], surface: 'hazard' },
        { type: 'wall', from: [1, 8], to: [2.5, 8], surface: 'hazard' },
        { type: 'wall', from: [-2.5, 3.5], to: [-2.5, 8], surface: 'hazard' },
        { type: 'wall', from: [2.5, 8], to: [2.5, 3.5], surface: 'hazard' },
        { type: 'wall', from: [-2.5, 3.5], to: [2.5, 3.5], surface: 'hazard' },
        // The music factory: a gate, and a drum under the wall of the last floor
        { type: 'floor', min: [-2, -7], max: [2, 1], surface: 'stage' },
        { type: 'wall', from: [-2, 1], to: [2, 1], surface: 'neonWall' },
        { type: 'wall', from: [-2, -7], to: [-2, 1], surface: 'neonWall' },
        { type: 'wall', from: [2, 1], to: [2, -7], surface: 'neonWall' },
        ...wallWithDoors([-2, -2.5], [2, -2.5], [[1.2, 2.8]], 'neonWall', { height: 0.8 }),
        // Clockwork: a soft landing, a clock switch, a piston, and the cup
        { type: 'floor', min: [-2.5, -12], max: [2.5, -7], y: 1, depth: 1.45, surface: 'cushion' },
        { type: 'floor', min: [-2.5, -21.5], max: [2.5, -12], y: 1, depth: 1.45, surface: 'clockFloor' },
        { type: 'wall', from: [-2.5, -21.5], to: [-2.5, -7], y: 1, surface: 'brass' },
        { type: 'wall', from: [2.5, -7], to: [2.5, -21.5], y: 1, surface: 'brass' },
        { type: 'wall', from: [-2.5, -21.5], to: [2.5, -21.5], y: 1, surface: 'brass' },
      ],
      movers: [
        {
          role: 'pusher',
          size: [2.8, 0.6, 0.5],
          position: [-0.6, 1.3, -16.5],
          surface: 'cog',
          motion: { type: 'slide', offset: [1.2, 0, 0], period: 1.6, hold: [0.3, 0.3] },
          sweep: { kind: 'box', center: [0, 1.3, -16.5], halfExtents: [2.5, 0.5, 0.6] },
          rest: [
            [0, 1, -15.2],
            [0, 1, -17.8],
          ],
          clock: 'last',
        },
      ],
      field: {
        parts: [
          lever('lever', [1.8, 0, 14.8]),
          belt('belt', [-1, 8], [1, 14], [0, 1], 'lever'),
          ...shutter('gate', [-0.8, -2.5], [0.8, -2.5], [1, 1, 0, 0]),
          { kind: 'dial', id: 'dial', at: [1.8, 1, -13.2], start: FAST },
          { kind: 'timeZone', id: 'last', min: [-2.5, -18.5], max: [2.5, -14.5], y: 1, dial: 'dial' },
        ],
      },
      decor: [
        { type: 'crate', at: [-6, -3.6, 16], size: [2, 3.2, 2], color: 0xf2c14e },
        { type: 'gear', at: [6, -3.55, 12], size: [2.4, 0, 0], color: 0xe2574c },
        { type: 'column', at: [6, -3.6, 5], size: [0.5, 3, 0], color: 0x7d8791 },
        { type: 'pipe', at: [-7, -3.6, 4], size: [5, 0.4, 0], yaw: 90, color: 0xe6b422 },
        { type: 'tower', at: [7, -3.6, -3], size: [3, 2.8, 3], color: 0x2b2350 },
        { type: 'tower', at: [-7, -3.6, -8], size: [3, 3.4, 3], color: 0x3a2a66 },
        { type: 'gear', at: [7.5, -3.55, -14], size: [3.2, 0, 0] },
        { type: 'gear', at: [-7, -3.55, -19], size: [2.6, 0, 0], color: 0xa87f45 },
      ],
      zones: [
        { type: 'outOfBounds', shape: { kind: 'box', center: [0, -6, 0], halfExtents: [80, 5, 80] } },
        robotArm(
          [1.5, 0, 4.6],
          [-1.6, 0, 2.25],
          [
            [-1.6, 0, 7.2],
            [0, 0, -0.2],
          ],
          4,
        ),
        drumPad([0, 0, -5.3], 0.8, { beat: BEAT, every: 2, velocity: [0, 6.5, -4], rest: [[0, 0, -3.6]] }),
      ],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 44 },
    },
  ],
};

/**
 * Chapter 7, hole 13: a day out in town (SPEC v7 3.6). Under the street by subway,
 * across town by train, over the fair by roller coaster, and through the garden maze
 * to the cup. Each stretch ends where the next begins and nowhere else, so the order
 * needs no rule.
 */
export const CITY_DAY_OUT: FinaleDef = {
  id: 'ch7-finale',
  name: { en: 'City Day Out', zh: '城市一日游' },
  theme: 'cityday',
  ruleCard: {
    en: 'Subway, train, coaster, maze: one day, one ball.',
    zh: '地铁、火车、过山车、迷宫：一天，一颗球。',
  },
  ruleTag: { en: 'FINALE', zh: '终局' },
  holes: [
    {
      id: 'ch7-finale',
      par: 8,
      tee: [0, 0, 18.5],
      goal: { type: 'cup', position: [-3.2, 0, -14.1], ...CUP },
      challenge: { type: 'maxRotations', count: 1, text: { en: 'Turn the maze walls only once', zh: '迷宫的墙只转一次' } },
      pieces: [
        // The subway: where the ball starts, with the lever of the far mouth
        ...walledRoom([-3, 14], [3, 20], 'concourse', 'tiling'),
        // The station yard: the far mouth stands in a wall, with a dead end to the east of it
        { type: 'floor', min: [-3, 5], max: [3, 11], surface: 'setts' },
        { type: 'wall', from: [-3, 11], to: [3, 11], surface: 'brick' },
        { type: 'wall', from: [3, 11], to: [3, 5], surface: 'brick' },
        { type: 'wall', from: [-3, 5], to: [-3, 11], surface: 'brick' },
        ...wallWithDoors([-3, 5], [3, 5], [[1.4, 2.6]], 'brick'),
        { type: 'wall', from: [1, 11], to: [1, 9.05], surface: 'brick' },
        { type: 'wall', from: [1, 7.95], to: [1, 5], surface: 'brick' },
        // The fair: two places to be set down, a fence between them, and the way onto the coaster
        { type: 'floor', min: [-4, -5], max: [4, 0], surface: 'boards' },
        { type: 'wall', from: [-4, 0], to: [4, 0], surface: 'fence' },
        { type: 'wall', from: [4, 0], to: [4, -5], surface: 'fence' },
        { type: 'wall', from: [-4, -5], to: [-4, 0], surface: 'fence' },
        ...wallWithDoors([-4, -5], [4, -5], [[3.5, 4.5]], 'fence'),
        { type: 'wall', from: [1.5, 0], to: [1.5, -3.5], surface: 'fence' },
        // The garden: a landing, and one room with a revolving door in it
        { type: 'floor', min: [-0.5, -9], max: [1.5, -8], surface: 'lawn' },
        { type: 'floor', min: [-4.5, -15], max: [1.5, -9], surface: 'lawn' },
        { type: 'wall', from: [-0.5, -9], to: [-0.5, -8], surface: 'hedge' },
        { type: 'wall', from: [1.5, -8], to: [1.5, -15], surface: 'hedge' },
        { type: 'wall', from: [1.5, -15], to: [-4.5, -15], surface: 'hedge' },
        { type: 'wall', from: [-4.5, -15], to: [-4.5, -9], surface: 'hedge' },
        ...wallWithDoors([-4.5, -9], [1.5, -9], [[4.1, 5.9]], 'hedge'),
        ...stubs([-1.5, -12]),
      ],
      field: {
        turns: 3,
        parts: [
          subway(
            'line',
            { at: [0, 0, 14.8], facings: [180] },
            { at: [1, 0, 8.5], facings: [90, 270], lever: [2.2, 0, 16.6] },
          ),
          points('points', [-2.2, 0, 9.6]),
          train('train', [-1, 0, 5.6], [-1, 0, 4.2], [
            line([2.8, 0, 0.8], [2.8, 0, -0.9], LINE_BLUE, undefined, [[-1, 0, 2.6], [2.8, 0, 2]]),
            line([-1, 0, 0.8], [-1, 0, -0.9], LINE_ORANGE, 'points'),
          ]),
          rotor('door', [-1.5, -12], [90, 270]),
        ],
      },
      decor: [
        { type: 'column', at: [-6, -3.6, 17], size: [0.55, 3.2, 0], color: 0x56636f },
        { type: 'column', at: [6, -3.6, 17], size: [0.55, 3.2, 0], color: 0x56636f },
        { type: 'tower', at: [-7.5, -3.6, 8], size: [3, 2.8, 3], color: 0xd98a5a },
        { type: 'tower', at: [7.5, -3.6, 9], size: [3, 3.4, 3], color: 0x8fb7c9 },
        { type: 'tent', at: [8, -3.6, -3], size: [2.6, 3, 0], color: 0xe5484d },
        { type: 'tent', at: [-8.5, -3.6, -4], size: [2.2, 3, 0], color: 0xf2c14e },
        { type: 'pine', at: [-8.5, -3.6, -12], size: [1.2, 4.6, 0] },
        { type: 'pine', at: [5.5, -3.6, -13], size: [1.1, 4.2, 0] },
        { type: 'bush', at: [5, -3.6, -17], size: [1.6, 0, 0] },
      ],
      zones: [FALL, coaster([0, 0, -4.7], 0, [{ run: 1.2 }, { loop: 0.8 }, { run: 2.5 }])],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 44 },
    },
  ],
};

/**
 * Chapter 8, hole 13: the strange gate (SPEC v8 3.6). Over a bridge that comes and
 * goes; out of one side of a hall to reach the door on the other; a stroke for the
 * shadow, to open the first gate; over a second bridge; and a stroke for its own echo,
 * to open the last. Each stretch ends where the next begins and nowhere else, so the
 * order needs no rule. The mirror shows only its own room: the shadow never stirs
 * while the echoes are at work.
 */
export const STRANGE_GATE: FinaleDef = {
  id: 'ch8-finale',
  name: { en: 'Strange Gate', zh: '奇异之门' },
  theme: 'strange',
  ruleCard: {
    en: 'A bridge, a hall, a shadow, an echo: four strange rules, one gate.',
    zh: '幻影桥、回廊、影子、回声：四条怪规则，一道门。',
  },
  ruleTag: { en: 'FINALE', zh: '终局' },
  holes: [
    {
      id: 'ch8-finale',
      par: 8,
      tee: [0, 0, 19.5],
      goal: { type: 'cup', position: [3.6, 0, -20], ...CUP },
      challenge: { type: 'noOutOfBounds', text: { en: 'Never go out of bounds', zh: '一次都不出界' } },
      mirror: {
        axis: 'x',
        at: 5,
        span: [-3, 5],
        shadow: [8, 0, 3.5],
        reach: { kind: 'box', center: [2, 0.5, 1], halfExtents: [3, 1.5, 4] },
      },
      pieces: [
        // Where the ball starts
        { type: 'floor', min: [-2, 17], max: [2, 21], surface: 'voidstone' },
        { type: 'wall', from: [-2, 21], to: [2, 21], surface: 'voidWall' },
        { type: 'wall', from: [-2, 17], to: [-2, 21], surface: 'voidWall' },
        { type: 'wall', from: [2, 21], to: [2, 17], surface: 'voidWall' },
        ...wallWithDoors([-2, 17], [2, 17], [[1.1, 2.9]], 'voidWall'),
        // The hall: left and right are one. The way in is this side of the wall down
        // its middle, the way out the other
        { type: 'floor', min: [-4, 5], max: [4, 13], surface: 'hallFloor' },
        { type: 'floor', min: [-4 - SKIRT, 5], max: [-4, 13], surface: 'beyond' },
        { type: 'floor', min: [4, 5], max: [4 + SKIRT, 13], surface: 'beyond' },
        ...wallWithDoors([-4 - SKIRT, 13], [4 + SKIRT, 13], [[5.6, 7.4]], 'hallWall'),
        { type: 'wall', from: [1, 5], to: [1, 13], surface: 'hallWall' },
        // The wall between the hall and the two rooms beyond it, with the hall's way out
        ...wallWithDoors([-4 - SKIRT, 5], [11, 5], [[8.5, 9.7]], 'hallWall', { height: 0.8 }),
        // The room in front of the mirror, with the first gate in its far wall
        { type: 'floor', min: [-1, -3], max: [5, 5], surface: 'parlour' },
        { type: 'wall', from: [-1, -3], to: [-1, 5], surface: 'wainscot' },
        { type: 'wall', from: [5, -3], to: [5, 5], height: 0.6, surface: 'glass' },
        ...wallWithDoors([-1, -3], [5, -3], [[4, 5.2]], 'wainscot', { height: 0.8 }),
        // The room behind it
        { type: 'floor', min: [5, -3], max: [11, 5], surface: 'parlourShade' },
        { type: 'wall', from: [11, 5], to: [11, -3], surface: 'wainscot' },
        { type: 'wall', from: [11, -3], to: [5, -3], surface: 'wainscot' },
        // A landing beyond the gate, and the second bridge
        { type: 'floor', min: [2.5, -4.5], max: [5, -3], surface: 'voidstone' },
        { type: 'wall', from: [2.5, -4.5], to: [2.5, -3], surface: 'voidWall' },
        { type: 'wall', from: [5, -3], to: [5, -4.5], surface: 'voidWall' },
        ...wallWithDoors([2.5, -4.5], [5, -4.5], [[0.2, 2]], 'voidWall'),
        // The echo's room: rippled ground, a silver plate with moss beyond it to stop
        // in, and a long way on to the last gate and the cup
        { type: 'floor', min: [0.5, -11.5], max: [6.5, -8.5], surface: 'echoFloor' },
        { type: 'floor', min: [0.5, -13.5], max: [2.5, -11.5], surface: 'echoFloor' },
        { type: 'floor', min: [2.5, -13.5], max: [5, -11.5], surface: 'hush' },
        { type: 'floor', min: [5, -13.5], max: [6.5, -11.5], surface: 'echoFloor' },
        { type: 'floor', min: [0.5, -22], max: [6.5, -13.5], surface: 'echoFloor' },
        ...wallWithDoors([0.5, -8.5], [6.5, -8.5], [[2.2, 4]], 'echoWall'),
        { type: 'wall', from: [6.5, -8.5], to: [6.5, -22], surface: 'echoWall' },
        { type: 'wall', from: [6.5, -22], to: [0.5, -22], surface: 'echoWall' },
        { type: 'wall', from: [0.5, -22], to: [0.5, -8.5], surface: 'echoWall' },
        ...wallWithDoors([0.5, -18], [6.5, -18], [[2.4, 3.8]], 'echoWall', { height: 0.8 }),
      ],
      movers: [
        phantomBridge([0, 17], [0, 13], 1.8, { period: 5, shown: 0.55 }, [
          [0, 0, 17.8],
          [0, 0, 12.2],
        ]),
        phantomBridge([3.6, -4.5], [3.6, -8.5], 1.8, { period: 5, shown: 0.55, phase: 0.5 }, [
          [3.6, 0, -3.8],
          [3.6, 0, -9.3],
        ]),
      ],
      field: {
        parts: [
          { kind: 'echo', id: 'zone', min: [0.5, -14], max: [6.5, -8.5] },
          { kind: 'echoPlate', id: 'silver', at: [3.6, 0, -10.6], mode: 'latch', radius: 0.6 },
          { kind: 'plate', id: 'plate', at: [9.6, 0, -1.2], mode: 'latch', radius: 0.6 },
          { kind: 'gate', id: 'first', from: [3, -3], to: [4.2, -3], when: 'plate', via: [[9.6, -2.2], [3.6, -2.2]] },
          { kind: 'gate', id: 'last', from: [2.9, -18], to: [4.3, -18], when: 'silver', delay: 8, via: [[5.6, -10.6], [5.6, -17.2], [3.6, -17.2]] },
        ],
      },
      decor: [
        { type: 'obelisk', at: [-6, -3.6, 19], size: [1.3, 6, 0], color: 0x4a3f8f },
        { type: 'crystals', at: [5.5, -3.6, 16], size: [2.2, 0, 0], color: 0x7ff0e0 },
        { type: 'column', at: [-9, -3.6, 9], size: [0.5, 3.2, 0], color: 0xcdbf9f },
        { type: 'column', at: [9.5, -3.6, 15], size: [0.5, 2.4, 0], color: 0xcdbf9f },
        { type: 'column', at: [-4, -3.6, 0], size: [0.4, 2.6, 0], color: 0x9c8468 },
        { type: 'column', at: [13.5, -3.6, 1], size: [0.4, 2.6, 0], color: 0x9c8468 },
        { type: 'crystals', at: [8.5, -3.6, -7], size: [2.2, 0, 0], color: 0x7ff0e0 },
        { type: 'obelisk', at: [-3, -3.6, -12], size: [1.4, 6, 0], color: 0x4a5670 },
        { type: 'rock', at: [9.5, -3.6, -16], size: [2.4, 0, 0], color: 0x56637a },
        { type: 'obelisk', at: [-2.5, -3.6, -21], size: [1.4, 5, 0], color: 0x4a5670 },
      ],
      zones: [FALL, hall([-4, 5], [4, 13], { x: true })],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 48 },
    },
  ],
};

/** Every cell of the castle's key room: no monster may enter it, and no ball there is on the grid. */
const KEY_ROOM: Cell[] = [];
for (let col = 0; col < 8; col++) for (let row = 12; row < 20; row++) KEY_ROOM.push([col, row]);

/**
 * Chapter 9, hole 13, and the last hole of the game: the demon's castle (SPEC v9 3.7).
 * Through the gatehouse by swapping worlds, across a courtyard of monsters, through
 * the key room for the red key that opens the throne room and the gold one that opens
 * the boss's shield, and then the boss, with three strikes to its back. There is no
 * cup: the hole ends when it is beaten.
 */
export const DEMON_CASTLE: FinaleDef = {
  id: 'ch9-finale',
  name: { en: 'Demon Castle', zh: '魔王城' },
  theme: 'castle',
  ruleCard: {
    en: 'Two worlds, the monsters, the keys, and the demon on its throne.',
    zh: '表里世界、怪兽、钥匙，和王座上的魔王。',
  },
  ruleTag: { en: 'FINALE', zh: '终局' },
  holes: [
    {
      id: 'ch9-finale',
      par: 12,
      tee: [0, 0, 22],
      goal: { type: 'boss', part: 'demon' },
      challenge: { type: 'noCaught', text: { en: 'Never get caught', zh: '一次都不被抓' } },
      pieces: [
        // The gatehouse: the portcullis across it is in the real world only
        { type: 'floor', min: [-2.5, 14], max: [2.5, 24], surface: 'boards2' },
        { type: 'wall', from: [-2.5, 24], to: [2.5, 24], surface: 'panel' },
        { type: 'wall', from: [-2.5, 14], to: [-2.5, 24], surface: 'panel' },
        { type: 'wall', from: [2.5, 24], to: [2.5, 14], surface: 'panel' },
        // The courtyard, its wall to the gatehouse with the way in, and its wall to the key room with the way on
        { type: 'floor', min: [-4, 4], max: [4, 14], surface: 'denFloor' },
        ...wallWithDoors([-4, 14], [4, 14], [[3, 5]], 'denWall'),
        { type: 'wall', from: [-4, 4], to: [-4, 14], surface: 'denWall' },
        { type: 'wall', from: [4, 14], to: [4, 4], surface: 'denWall' },
        ...wallWithDoors([-4, 4], [4, 4], [[3, 5]], 'masonry'),
        // The key room
        { type: 'floor', min: [-4, -4], max: [4, 4], surface: 'flagstone' },
        { type: 'wall', from: [-4, -4], to: [-4, 4], surface: 'masonry' },
        { type: 'wall', from: [4, 4], to: [4, -4], surface: 'masonry' },
        ...wallWithDoors([-4, -4], [4, -4], [[3, 5]], 'masonry', { height: 0.8 }),
        // The throne room
        { type: 'floor', min: [-4, -16], max: [4, -4], surface: 'lairFloor' },
        { type: 'wall', from: [-4, -16], to: [-4, -4], surface: 'lairWall' },
        { type: 'wall', from: [4, -4], to: [4, -16], surface: 'lairWall' },
        { type: 'wall', from: [4, -16], to: [-4, -16], surface: 'lairWall' },
      ],
      field: {
        grid: { origin: [-3.5, -15.5], cols: 8, rows: 30, blocked: KEY_ROOM },
        parts: [
          swapLever('lever', [1.8, 0, 20]),
          {
            kind: 'realm',
            id: 'gatehouse',
            levers: ['lever'],
            real: { walls: [{ from: [-2.5, 17], to: [2.5, 17], surface: 'panel' }] },
            ghost: { walls: [{ from: [-2.5, 16], to: [0.5, 16], surface: 'ectoplasm' }] },
          },
          patrol('walker', [[0, 25], [1, 25], [2, 25], [3, 25], [4, 25], [5, 25], [6, 25], [7, 25]]),
          chaser('hunter', [6, 21]),
          key('red', [-2.5, 0, 2], 'red'),
          key('gold', [2.5, 0, -2], 'gold'),
          lockedDoor('door', [-4, -4], [4, -4], [3, 5], 'red'),
          boss('demon', [3, 5], 3, { shield: 'gold' }),
        ],
      },
      decor: [
        { type: 'column', at: [-4.5, -3.6, 23], size: [0.45, 2.8, 0], color: 0x5a4a52 },
        { type: 'column', at: [4.5, -3.6, 23], size: [0.45, 2.8, 0], color: 0x5a4a52 },
        { type: 'tower', at: [-7, -3.6, 16], size: [3, 4, 3], color: 0x3a3340 },
        { type: 'tower', at: [7, -3.6, 16], size: [3, 4, 3], color: 0x3a3340 },
        { type: 'rock', at: [-6.5, -3.6, 9], size: [2.4, 0, 0], color: 0x4b4149 },
        { type: 'obelisk', at: [6.5, -3.6, 8], size: [1.2, 5, 0], color: 0x3a3340 },
        { type: 'column', at: [-6, -3.6, 0], size: [0.5, 3, 0], color: 0x5b5663 },
        { type: 'column', at: [6, -3.6, 0], size: [0.5, 3, 0], color: 0x5b5663 },
        { type: 'crystals', at: [-6.5, -3.6, -8], size: [2, 0, 0], color: 0xff6a3d },
        { type: 'crystals', at: [6.5, -3.6, -12], size: [2, 0, 0], color: 0xff6a3d },
        { type: 'obelisk', at: [-6.5, -3.6, -15], size: [1.3, 6, 0], color: 0x2c1f2e },
        { type: 'obelisk', at: [6.5, -3.6, -17], size: [1.3, 6, 0], color: 0x2c1f2e },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 52 },
    },
  ],
};
