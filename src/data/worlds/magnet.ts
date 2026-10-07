import type { PieceDef, WorldDef } from '../../level/schema';
import type { ZoneDef } from '../../physics/zones';
import { CUP, FALL } from './common';

/** A magnet is two things in the data: the post the ball can bump into, and its field. */
function magnet(x: number, z: number, strength: number, reach: number): { post: PieceDef; field: ZoneDef } {
  return {
    post: { type: 'pillar', at: [x, z], radius: 0.35, surface: strength > 0 ? 'magnetRed' : 'magnetBlue' },
    field: { type: 'magnet', shape: { kind: 'sphere', center: [x, 0, z], radius: reach }, params: { strength } },
  };
}

const m1 = [magnet(2.4, -0.5, 10, 3.6), magnet(-2.4, -4.5, -10, 3.6)];
const m2 = [magnet(2, -2, 11, 3.4), magnet(3.3, -7, -11, 3.6)];
const m3 = [magnet(-2.3, -2.5, 10, 3.2), magnet(2.3, -2.5, 10, 3.2), magnet(0, -9.3, -9, 3.2)];

/**
 * World 5: force fields. Red magnets pull the iron ball, blue ones push it, both more
 * strongly the closer it passes. The rings on the floor show how far each one reaches.
 */
export const MAGNET_WORLD: WorldDef = {
  id: 'magnet',
  name: { en: 'Magnetic Fields', zh: '磁力' },
  theme: 'magnet',
  ruleCard: { en: 'Red pulls, Blue pushes.', zh: '红色吸引，蓝色排斥。' },
  ruleTag: { en: 'MAGNETIC FIELD', zh: '磁场' },
  holes: [
    // 1. Teaching: a straight lane to the cup, bent by a red magnet on one side and a
    //    blue one on the other. Both push the ball the same way: aim off to compensate.
    {
      id: 'magnet-1',
      par: 2,
      tee: [0, 0, 4.5],
      cup: { position: [0, 0, -8], ...CUP },
      challenge: {
        type: 'noWallHits',
        text: { en: 'Hole out without touching a rail or a magnet', zh: '不碰围栏和磁铁进洞' },
      },
      pieces: [
        { type: 'floor', min: [-3, -10], max: [3, 6], surface: 'steel' },
        { type: 'wall', from: [-3, 6], to: [3, 6], surface: 'iron' },
        { type: 'wall', from: [3, 6], to: [3, -10], surface: 'iron' },
        { type: 'wall', from: [3, -10], to: [-3, -10], surface: 'iron' },
        { type: 'wall', from: [-3, -10], to: [-3, 6], surface: 'iron' },
        ...m1.map((m) => m.post),
      ],
      zones: [FALL, ...m1.map((m) => m.field)],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: the cup is behind a wall. A red magnet past the wall's end bends the
    //    ball around the corner; a blue one in the far corner sends overshoots back.
    {
      id: 'magnet-2',
      par: 3,
      tee: [-2.5, 0, 4.5],
      cup: { position: [-2.5, 0, -5.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-4, -8], max: [4, 6], surface: 'steel' },
        { type: 'wall', from: [-4, 6], to: [4, 6], surface: 'iron' },
        { type: 'wall', from: [4, 6], to: [4, -8], surface: 'iron' },
        { type: 'wall', from: [4, -8], to: [-4, -8], surface: 'iron' },
        { type: 'wall', from: [-4, -8], to: [-4, 6], surface: 'iron' },
        { type: 'wall', from: [-4, -1], to: [1, -1], surface: 'iron' },
        ...m2.map((m) => m.post),
      ],
      zones: [FALL, ...m2.map((m) => m.field)],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: thread the gap between two red magnets (dead centre they cancel, a
    //    little off and one of them wins), into a cup guarded by a blue magnet.
    {
      id: 'magnet-3',
      par: 3,
      tee: [0, 0, 4.5],
      cup: { position: [0, 0, -7.5], ...CUP },
      challenge: {
        type: 'noWallHits',
        text: { en: 'Hole out without touching a rail or a magnet', zh: '不碰围栏和磁铁进洞' },
      },
      pieces: [
        { type: 'floor', min: [-4, -11], max: [4, 6], surface: 'steel' },
        { type: 'wall', from: [-4, 6], to: [4, 6], surface: 'iron' },
        { type: 'wall', from: [4, 6], to: [4, -11], surface: 'iron' },
        { type: 'wall', from: [4, -11], to: [-4, -11], surface: 'iron' },
        { type: 'wall', from: [-4, -11], to: [-4, 6], surface: 'iron' },
        ...m3.map((m) => m.post),
      ],
      zones: [FALL, ...m3.map((m) => m.field)],
      outOfBounds: 'lastPosition',
    },
  ],
};
