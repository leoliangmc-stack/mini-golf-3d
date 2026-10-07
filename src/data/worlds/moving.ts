import type { DecorDef, PieceDef, WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';

/** A walled rectangle of felt. */
function table(minX: number, minZ: number, maxX: number, maxZ: number): PieceDef[] {
  return [
    { type: 'floor', min: [minX, minZ], max: [maxX, maxZ], surface: 'felt' },
    { type: 'wall', from: [minX, maxZ], to: [maxX, maxZ], surface: 'brass' },
    { type: 'wall', from: [maxX, maxZ], to: [maxX, minZ], surface: 'brass' },
    { type: 'wall', from: [maxX, minZ], to: [minX, minZ], surface: 'brass' },
    { type: 'wall', from: [minX, minZ], to: [minX, maxZ], surface: 'brass' },
  ];
}

/** Cogs lying on the table top around the course. */
const gears = (...spots: [x: number, z: number, radius: number][]): DecorDef[] =>
  spots.map(([x, z, radius], i) => ({
    type: 'gear',
    at: [x, -0.88, z],
    size: [radius, 0, 0],
    yaw: i * 23,
    color: i % 2 ? 0xa9853a : 0xc9a24b,
  }));

/**
 * World 9: the cup will not stay where it is. It runs along the line drawn on the
 * ground, on a fixed rhythm, and keeps running while you aim. What decides whether the
 * ball drops is how fast the two close on each other: a ball can wait for the cup, but
 * a cup coming the other way turns a gentle putt into one that skips over.
 */
export const MOVING_WORLD: WorldDef = {
  id: 'moving',
  name: { en: 'Moving Hole', zh: '移动球洞' },
  theme: 'clockwork',
  ruleCard: { en: 'The hole moves — follow the track.', zh: '球洞会移动，看好轨道。' },
  ruleTag: { en: 'MOVING HOLE', zh: '移动球洞' },
  holes: [
    // 1. Teaching: a straight lane, and a cup sliding from side to side across the far
    //    end of it. It pauses at each end of the line.
    {
      id: 'moving-1',
      par: 2,
      tee: [0, 0, 4.5],
      cup: {
        position: [-2, 0, -7],
        ...CUP,
        motion: { type: 'slide', offset: [4, 0, 0], period: 8, hold: [0.1, 0.1] },
      },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: table(-3, -10, 3, 6),
      decor: gears([-6, -6, 2.2], [6.5, 0, 1.6], [-5.5, 4, 1.3], [5.5, -9.5, 1.9], [0, -13.5, 1.5]),
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: the cup circles a post, on a slick plate where nothing stops
    //    quickly. Rolling onto the line is easy; being there at the same time as the
    //    cup is the shot.
    {
      id: 'moving-2',
      par: 3,
      tee: [0, 0, 4.5],
      cup: { position: [2, 0, -5], ...CUP, motion: { type: 'spin', pivot: [0, -5], period: 8 } },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        // Listed first so the plate wins where it overlaps the felt.
        { type: 'floor', min: [-2.5, -7.5], max: [2.5, -2.5], surface: 'polished' },
        ...table(-4, -10, 4, 6),
        { type: 'pillar', at: [0, -5], radius: 0.5, surface: 'brass' },
      ],
      decor: gears([-7, -4, 2.4], [7, -7, 1.7], [6.5, 3, 2], [-6.5, 5, 1.4], [0, -13.5, 1.8]),
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: round a corner to a cup that slides and also shuts. With the lid
    //    closed it is just floor, and the ball rolls straight over it.
    {
      id: 'moving-3',
      par: 3,
      tee: [0, 0, 4.5],
      cup: {
        position: [3.5, 0, -6],
        ...CUP,
        motion: { type: 'slide', offset: [4, 0, 0], period: 8, hold: [0.1, 0.1] },
        hidden: { period: 4, openRatio: 0.5 },
      },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-2, -4], max: [2, 6], surface: 'felt' },
        { type: 'floor', min: [-2, -8], max: [9, -4], surface: 'felt' },
        { type: 'wall', from: [-2, 6], to: [2, 6], surface: 'brass' },
        { type: 'wall', from: [2, 6], to: [2, -4], surface: 'brass' },
        { type: 'wall', from: [2, -4], to: [9, -4], surface: 'brass' },
        { type: 'wall', from: [9, -4], to: [9, -8], surface: 'brass' },
        { type: 'wall', from: [9, -8], to: [-2, -8], surface: 'brass' },
        { type: 'wall', from: [-2, -8], to: [-2, 6], surface: 'brass' },
        // The deflector that turns a straight shot down the second leg.
        { type: 'wall', from: [-2, -4], to: [2, -8], surface: 'brass' },
        { type: 'pillar', at: [2.6, -6], radius: 0.3, surface: 'brass' },
      ],
      decor: gears([-6, -2, 2.3], [6, 1, 2.6], [12, -6, 1.7], [3.5, -11.5, 2], [-5.5, 6, 1.4]),
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },
  ],
};
