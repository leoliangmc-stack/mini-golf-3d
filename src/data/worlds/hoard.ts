import type { PieceDef, WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';
import { wallWithDoors } from './ruins';

const FLOOR = 'hoardFloor';
const WALL = 'hoardWall';

/**
 * A hall running north with a passage down its west side: out of the hall by one door
 * and back in by another, further on. The long way, for when fire is across the hall.
 */
function hallWithPassage(): PieceDef[] {
  return [
    { type: 'floor', min: [-3, -8], max: [3, 9], surface: FLOOR },
    { type: 'wall', from: [-3, 9], to: [3, 9], surface: WALL },
    { type: 'wall', from: [3, 9], to: [3, -8], surface: WALL },
    { type: 'wall', from: [3, -8], to: [-3, -8], surface: WALL },
    // The west wall, with the two doors of the passage
    ...wallWithDoors([-3, -8], [-3, 9], [[1.8, 3], [8.2, 9.4]], WALL),
    { type: 'floor', min: [-5, -6.5], max: [-3, 1.5], surface: FLOOR },
    { type: 'wall', from: [-5, 1.5], to: [-3, 1.5], surface: WALL },
    { type: 'wall', from: [-5, -6.5], to: [-5, 1.5], surface: WALL },
    { type: 'wall', from: [-5, -6.5], to: [-3, -6.5], surface: WALL },
  ];
}

/**
 * World 18: gold, and the dragon asleep on it (SPEC v4 3.6). Coins are picked up by
 * rolling through them; they count for nothing but the hole's third star. Bells and
 * bones make a noise when the ball touches them, and enough noise wakes the dragon,
 * whose fire shuts the short way. A ball that touches fire is out of bounds.
 */
export const HOARD_WORLD: WorldDef = {
  id: 'hoard',
  name: { en: "Dragon's Hoard", zh: '巨龙宝库' },
  theme: 'hoard',
  ruleCard: {
    en: "Collect gold, but don't wake the dragon!",
    zh: '收集金币，但别吵醒巨龙！',
  },
  ruleTag: { en: 'GOLD', zh: '金币' },
  holes: [
    // 1. Teaching: the cup is straight ahead and the way to it is clear. The gold lies
    //    off to the right, in a line between two bells: going for it costs a stroke or
    //    two, and one touch of a bell wakes the dragon, whose fire crosses the hall.
    //    What is left then is the passage.
    {
      id: 'hoard-1',
      par: 3,
      tee: [-0.8, 0, 8],
      goal: { type: 'cup', position: [-0.8, 0, -6.5], ...CUP },
      challenge: { type: 'allCoins', text: { en: 'Collect all the gold', zh: '收集全部金币' } },
      strokeLimit: 8,
      pieces: hallWithPassage(),
      field: {
        parts: [
          { kind: 'coin', at: [1.6, 0, 4.5] },
          { kind: 'coin', at: [1.6, 0, 1.5] },
          { kind: 'coin', at: [1.6, 0, -1.2] },
          { kind: 'bell', at: [2.05, 0, 3] },
          { kind: 'bell', at: [1.15, 0, 0.2] },
          { kind: 'dragon', id: 'dragon', at: [4.6, 0, -3], heading: 270, threshold: 1 },
          {
            kind: 'fire',
            id: 'breath',
            shape: { kind: 'box', center: [0, 0.3, -3], halfExtents: [3, 0.5, 0.35] },
            when: 'dragon',
            rest: [[-1.5, 0, -1.9], [1.5, 0, -1.9]],
          },
        ],
      },
      decor: [
        { type: 'goldHeap', at: [4.6, -0.9, 4], size: [1.3, 0, 0] },
        { type: 'goldHeap', at: [-4.6, -0.9, 6], size: [1, 0, 0] },
        { type: 'goldHeap', at: [-6.3, -0.9, -3], size: [1.2, 0, 0] },
        { type: 'goldHeap', at: [4.6, -0.9, -7.4], size: [0.9, 0, 0] },
        { type: 'column', at: [4.4, -0.9, 8], size: [0.35, 1.2, 0] },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: two doors to the cup. The gold winds between piles of bones toward
    //    the near one; the dragon takes two noises to wake, and then it is that door its
    //    fire shuts. The far door is always open.
    {
      id: 'hoard-2',
      par: 4,
      tee: [0, 0, 8],
      goal: { type: 'cup', position: [2.5, 0, -6.5], ...CUP },
      challenge: { type: 'allCoins', text: { en: 'Collect all the gold', zh: '收集全部金币' } },
      strokeLimit: 9,
      pieces: [
        { type: 'floor', min: [-4, -9], max: [4, 9], surface: FLOOR },
        { type: 'wall', from: [-4, 9], to: [4, 9], surface: WALL },
        { type: 'wall', from: [4, 9], to: [4, -9], surface: WALL },
        { type: 'wall', from: [4, -9], to: [-4, -9], surface: WALL },
        { type: 'wall', from: [-4, -9], to: [-4, 9], surface: WALL },
        ...wallWithDoors([-4, -4], [4, -4], [[0.6, 1.8], [5.4, 6.6]], WALL, { height: 0.8 }),
      ],
      field: {
        parts: [
          { kind: 'coin', at: [1.2, 0, 4.5] },
          { kind: 'coin', at: [2.4, 0, 1] },
          { kind: 'coin', at: [2, 0, -2.2] },
          { kind: 'bell', at: [2.3, 0, 3.6], look: 'bones' },
          { kind: 'bell', at: [1.2, 0, 1.6], look: 'bones' },
          { kind: 'bell', at: [3.1, 0, -0.8], look: 'bones' },
          { kind: 'bell', at: [1.1, 0, -1.6], look: 'bones' },
          { kind: 'dragon', id: 'dragon', at: [5.6, 0, -4], heading: 270, threshold: 2 },
          {
            kind: 'fire',
            id: 'breath',
            shape: { kind: 'box', center: [2, 0.3, -4], halfExtents: [0.7, 0.5, 0.4] },
            when: 'dragon',
            rest: [[2, 0, -2.9]],
          },
        ],
      },
      decor: [
        { type: 'goldHeap', at: [-5.5, -0.9, 4], size: [1.3, 0, 0] },
        { type: 'goldHeap', at: [5.6, -0.9, 5], size: [1, 0, 0] },
        { type: 'goldHeap', at: [-5.6, -0.9, -6], size: [1.2, 0, 0] },
        { type: 'goldHeap', at: [5.5, -0.9, 1], size: [0.8, 0, 0] },
        { type: 'column', at: [-5.4, -0.9, -1], size: [0.35, 2.4, 0] },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: the clear way runs up the right-hand wall. The gold runs across the
    //    hall on a slant, four coins between three bells. And this dragon does more than
    //    shut the hall: awake, it breathes down the passage too, in bursts, so the long
    //    way is there only for a ball that goes between two of them.
    {
      id: 'hoard-3',
      par: 4,
      tee: [2.2, 0, 8],
      goal: { type: 'cup', position: [2.2, 0, -6.5], ...CUP },
      challenge: { type: 'allCoins', text: { en: 'Collect all the gold', zh: '收集全部金币' } },
      strokeLimit: 10,
      pieces: hallWithPassage(),
      field: {
        parts: [
          { kind: 'coin', at: [-0.8, 0, 5.5] },
          { kind: 'coin', at: [-0.2, 0, 2.5] },
          { kind: 'coin', at: [0.4, 0, -0.5] },
          { kind: 'coin', at: [0.9, 0, -3] },
          { kind: 'bell', at: [-0.05, 0, 4.1] },
          { kind: 'bell', at: [-0.4, 0, 0.9] },
          { kind: 'bell', at: [1.15, 0, -1.9] },
          { kind: 'dragon', id: 'dragon', at: [4.6, 0, -4.5], heading: 270, threshold: 1 },
          {
            kind: 'fire',
            id: 'breath',
            shape: { kind: 'box', center: [0, 0.3, -4.5], halfExtents: [3, 0.5, 0.35] },
            when: 'dragon',
            rest: [[-1.5, 0, -3.6], [1.5, 0, -3.6]],
          },
          {
            kind: 'fire',
            id: 'jet',
            shape: { kind: 'box', center: [-4, 0.3, -2.5], halfExtents: [1, 0.5, 0.5] },
            when: 'dragon',
            cycle: { period: 3.2, burn: 0.4 },
            rest: [[-4, 0, -1.2]],
            unlinked: true,
          },
        ],
      },
      decor: [
        { type: 'goldHeap', at: [4.6, -0.9, 4], size: [1.1, 0, 0] },
        { type: 'goldHeap', at: [-4.6, -0.9, 6], size: [1.3, 0, 0] },
        { type: 'goldHeap', at: [-6.3, -0.9, -3], size: [1, 0, 0] },
        { type: 'goldHeap', at: [4.7, -0.9, 0], size: [0.9, 0, 0] },
        { type: 'column', at: [4.4, -0.9, 8], size: [0.35, 2.4, 0] },
      ],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },
  ],
};
