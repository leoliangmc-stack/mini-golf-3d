import type { DecorDef, PieceDef, WorldDef } from '../../level/schema';
import { headingVector, tunnelPair, type TunnelEnd } from '../../physics/zones/tunnel';
import { CUP, FALL } from './common';

const TRUNK_RADIUS = 0.55;
const TRUNK_HEIGHT = 2.2;
/** Frame colours that tell one pair of hollows from another. */
const BLUE = 0x4fb3ff;
const ORANGE = 0xff9a3c;

/**
 * A tree with a hollow at its foot. In the data it is three things: the trunk the ball
 * bounces off, the leaves, and one end of a tunnel. `facing` is the compass heading the
 * hollow opens toward (0 is -Z, 90 is +X).
 */
function tree(x: number, z: number, facing: number): { trunk: PieceDef; leaves: DecorDef; end: TunnelEnd } {
  const dir = headingVector(facing);
  return {
    trunk: { type: 'pillar', at: [x, z], radius: TRUNK_RADIUS, height: TRUNK_HEIGHT, surface: 'bark' },
    leaves: { type: 'canopy', at: [x, TRUNK_HEIGHT, z], size: [1.05, 1.6, 0] },
    end: { at: [x + dir.x * TRUNK_RADIUS, 0, z + dir.z * TRUNK_RADIUS], facing },
  };
}

/** A giant mushroom: a stem to bounce off, with a cap that is only for show. */
function mushroom(x: number, z: number, radius = 0.3): { stem: PieceDef; cap: DecorDef } {
  return {
    stem: { type: 'pillar', at: [x, z], radius, height: 1, surface: 'stem' },
    cap: { type: 'mushroomCap', at: [x, 1, z], size: [radius * 2.3, 0, 0] },
  };
}

/** Scenery standing on the forest floor, around the course. */
const pines = (...spots: [x: number, z: number, height?: number][]): DecorDef[] =>
  spots.map(([x, z, height = 3.4]) => ({ type: 'pine', at: [x, -0.9, z], size: [height * 0.27, height, 0] }));

const stream = (x: number, z: number, width: number, depth: number): DecorDef => ({
  type: 'water',
  at: [x, -0.5, z],
  size: [width, 0, depth],
});

// Hole 1
const a1 = tree(0, -2.2, 180);
const b1 = tree(-2.2, -7, 90);
// Hole 2
const blueIn = tree(-1.5, 0.75, 180);
const blueOut = tree(-2.4, -7.5, 90);
const orangeIn = tree(2.2, 4.55, 0);
const orangeOut = tree(-2.4, -5, 90);
const shroom2 = mushroom(4.2, -8.2, 0.35);
// Hole 3
const near3 = tree(-4.45, 0, 90);
const far3 = tree(-1.55, -7, 270);
const gate3 = [mushroom(3.3, -1.5), mushroom(3.3, 1.5)];

/**
 * World 7: tree hollows. Two hollows with the same colour are the two ends of one
 * tunnel: roll into either and the ball comes out of the other, as fast as it went in,
 * heading the way that hollow faces. A calmer world to open Chapter 2: rails everywhere.
 */
export const FOREST_WORLD: WorldDef = {
  id: 'forest',
  name: { en: 'Forest', zh: '森林' },
  theme: 'forest',
  ruleCard: {
    en: 'Trees are tunnels — you exit the way the other hole faces.',
    zh: '树洞是隧道，球会朝另一个树洞的方向钻出。',
  },
  ruleTag: { en: 'TREE TUNNELS', zh: '树洞隧道' },
  holes: [
    // 1. Teaching: one pair, both in plain view. The lane ends at a hollow; its partner
    //    stands across a stream and points straight at the cup, at a right angle to the
    //    way the ball went in.
    {
      id: 'forest-1',
      par: 2,
      tee: [0, 0, 5.5],
      goal: { type: 'cup', position: [6.5, 0, -7], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: [
        { type: 'floor', min: [-2, -3], max: [2, 7], surface: 'moss' },
        { type: 'floor', min: [-3, -9], max: [9, -5], surface: 'moss' },
        { type: 'wall', from: [-2, 7], to: [2, 7], surface: 'log' },
        { type: 'wall', from: [-2, 7], to: [-2, -3], surface: 'log' },
        { type: 'wall', from: [2, 7], to: [2, -3], surface: 'log' },
        { type: 'wall', from: [-2, -3], to: [2, -3], surface: 'log' },
        { type: 'wall', from: [-3, -5], to: [9, -5], surface: 'log' },
        { type: 'wall', from: [9, -5], to: [9, -9], surface: 'log' },
        { type: 'wall', from: [9, -9], to: [-3, -9], surface: 'log' },
        { type: 'wall', from: [-3, -9], to: [-3, -5], surface: 'log' },
        a1.trunk,
        b1.trunk,
      ],
      decor: [
        a1.leaves,
        b1.leaves,
        stream(2, -4, 26, 1.6),
        ...pines([-5.5, 2], [6.5, 0.5, 4.2], [-6.5, -4], [11.5, -7, 4], [-5.5, -11, 3.8], [3, -11.5], [8.5, -11.5, 4.4]),
        { type: 'rock', at: [4.5, -0.9, -1.5], size: [0.7, 0, 0] },
        { type: 'bush', at: [4, -0.9, 5], size: [0.7, 0, 0] },
        { type: 'bush', at: [-3.8, -0.9, 6.5], size: [0.6, 0, 0] },
      ],
      zones: [FALL, tunnelPair(a1.end, b1.end, { color: BLUE })],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: two pairs. The blue hollow is straight ahead and easy, but comes out
    //    a putt away from the cup. The orange one has its back to the tee: it takes a
    //    bank off the boulders to get in, and comes out pointing at the cup.
    {
      id: 'forest-2',
      par: 2,
      tee: [0, 0, 5.5],
      goal: { type: 'cup', position: [2.5, 0, -5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: [
        { type: 'floor', min: [-3, 0], max: [3, 7], surface: 'moss' },
        { type: 'floor', min: [-3, -9], max: [5, -3], surface: 'moss' },
        { type: 'wall', from: [-3, 7], to: [3, 7], surface: 'log' },
        { type: 'wall', from: [-3, 7], to: [-3, 0], surface: 'log' },
        { type: 'wall', from: [3, 7], to: [3, 0], surface: 'log' },
        { type: 'wall', from: [-3, 0], to: [0, 0], surface: 'log' },
        // The bank into the orange hollow.
        { type: 'wall', from: [0, 0], to: [3, 0], height: 0.5, surface: 'boulder' },
        { type: 'wall', from: [-3, -3], to: [5, -3], surface: 'log' },
        { type: 'wall', from: [5, -3], to: [5, -9], surface: 'log' },
        { type: 'wall', from: [5, -9], to: [-3, -9], surface: 'log' },
        { type: 'wall', from: [-3, -9], to: [-3, -3], surface: 'log' },
        blueIn.trunk,
        blueOut.trunk,
        orangeIn.trunk,
        orangeOut.trunk,
        shroom2.stem,
      ],
      decor: [
        blueIn.leaves,
        blueOut.leaves,
        orangeIn.leaves,
        orangeOut.leaves,
        shroom2.cap,
        stream(1, -1.5, 26, 2.2),
        ...pines([-5.5, 3, 4], [6, 2], [-5.5, -6], [7.5, -6, 4.2], [1, -11.5, 3.6], [-4.5, -11.5], [6.5, -11, 4.4]),
        { type: 'rock', at: [5, -0.9, 4.5], size: [0.8, 0, 0] },
        { type: 'bush', at: [-4.6, -0.9, 6.5], size: [0.7, 0, 0] },
      ],
      zones: [
        FALL,
        tunnelPair(blueIn.end, blueOut.end, { color: BLUE }),
        tunnelPair(orangeIn.end, orangeOut.end, { color: ORANGE }),
      ],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: the tunnel works both ways. The cup is across a narrow footbridge
    //    that only a dead-straight ball survives, and the one thing in the clearing that
    //    shoots dead straight down it is the hollow. So: in from the side, out onto the
    //    far bank, then back in from there, and the ball comes out lined up with the bridge.
    {
      id: 'forest-3',
      par: 3,
      tee: [2, 0, 2.5],
      goal: { type: 'cup', position: [9, 0, 0], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-5, -3], max: [4, 4], surface: 'moss' },
        { type: 'floor', min: [-5, -9], max: [-1, -5], surface: 'moss' },
        { type: 'floor', min: [4, -0.5], max: [7, 0.5], surface: 'boardwalk' },
        { type: 'floor', min: [7, -2], max: [11, 2], surface: 'moss' },
        // Clearing
        { type: 'wall', from: [-5, 4], to: [4, 4], surface: 'log' },
        { type: 'wall', from: [-5, 4], to: [-5, -3], surface: 'log' },
        { type: 'wall', from: [-5, -3], to: [4, -3], surface: 'log' },
        { type: 'wall', from: [4, -3], to: [4, -0.5], surface: 'log' },
        { type: 'wall', from: [4, 0.5], to: [4, 4], surface: 'log' },
        // Far bank
        { type: 'wall', from: [-5, -5], to: [-1, -5], surface: 'log' },
        { type: 'wall', from: [-1, -5], to: [-1, -9], surface: 'log' },
        { type: 'wall', from: [-1, -9], to: [-5, -9], surface: 'log' },
        { type: 'wall', from: [-5, -9], to: [-5, -5], height: 0.5, surface: 'boulder' },
        // Green
        { type: 'wall', from: [7, -2], to: [11, -2], surface: 'log' },
        { type: 'wall', from: [11, -2], to: [11, 2], surface: 'log' },
        { type: 'wall', from: [11, 2], to: [7, 2], surface: 'log' },
        { type: 'wall', from: [7, -2], to: [7, -0.5], surface: 'log' },
        { type: 'wall', from: [7, 0.5], to: [7, 2], surface: 'log' },
        near3.trunk,
        far3.trunk,
        ...gate3.map((m) => m.stem),
      ],
      decor: [
        near3.leaves,
        far3.leaves,
        ...gate3.map((m) => m.cap),
        stream(5.5, 0, 3, 30),
        stream(-1, -4, 20, 1.6),
        ...pines([-7, 0, 4], [-7.5, -7], [1.5, -7, 3.8], [9, -5], [13, -1, 4.2], [5, -9.5, 4.4], [-3, -11.5]),
        { type: 'rock', at: [2.5, -0.9, -8.5], size: [0.9, 0, 0] },
        { type: 'bush', at: [-3, -0.9, 5.5], size: [0.8, 0, 0] },
        { type: 'bush', at: [9, -0.9, 3.8], size: [0.7, 0, 0] },
      ],
      zones: [FALL, tunnelPair(near3.end, far3.end, { color: BLUE })],
      outOfBounds: 'lastPosition',
    },
  ],
};
