import type { Vec2, Vec3 } from '../../core/types';
import type { PartDef } from '../../level/field';
import type { DecorDef, MoverDef, WorldDef } from '../../level/schema';
import { drumPad } from '../../physics/zones/drum';
import { CUP, FALL } from './common';
import { wallWithDoors } from './ruins';

const FLOOR = 'stage';
const WALL = 'neonWall';
/** Physics ticks to a beat throughout the chapter: 120 beats a minute. */
export const BEAT = 30;
/** How long so many beats last, in seconds: what a moving part's `period` is given in. */
export const beats = (count: number): number => (count * BEAT) / 60;

/**
 * A gate that keeps the beat: open on the beats `pattern` marks with a 1, shut on the
 * others. It is two parts, the beat as a signal and a gate that listens to it at once.
 */
export const shutter = (id: string, from: Vec2, to: Vec2, pattern: readonly (0 | 1)[], y = 0): PartDef[] => [
  { kind: 'pulse', id: `${id}-beat`, at: [(from[0] + to[0]) / 2, y, (from[1] + to[1]) / 2], pattern },
  { kind: 'gate', id, from, to, y, when: `${id}-beat`, delay: 1, unlinked: true, look: 'shutter', surface: 'neonWall' },
];

/**
 * A run of piano keys across the course: a block that stands level with the ground at
 * `y` for two beats, rises `rise` over two, stands for two and comes down over two.
 * `phase` says where in those eight beats it starts.
 */
export const pianoKeys = (
  min: Vec2,
  max: Vec2,
  y: number,
  rise: number,
  options: { phase?: number; rest: readonly Vec3[]; note?: number },
): MoverDef => ({
  role: 'lift',
  size: [max[0] - min[0], rise + 0.4, max[1] - min[1]],
  // Its top stands a few millimetres proud of the ground, as a platform's does.
  position: [(min[0] + max[0]) / 2, y + 0.004 - (rise + 0.4) / 2, (min[1] + max[1]) / 2],
  surface: 'ivory',
  motion: { type: 'slide', offset: [0, rise, 0], period: beats(8), hold: [0.25, 0.25], phase: options.phase ?? 0 },
  rest: options.rest,
  look: 'keys',
  note: options.note,
});

/** The town the factory stands in, at night: towers with their windows lit, well clear of the course. */
const tower = (x: number, z: number, height: number, color = 0x2b2350): DecorDef => ({
  type: 'tower',
  at: [x, -3.6, z],
  size: [3, height, 3],
  color,
});

/**
 * World 25: the beat (SPEC v6 3.4). Every machine here moves on a beat that can be
 * seen and heard: gates open and shut on it, keys rise and fall on it, drums strike on
 * it. The question is which beat to play the stroke on.
 */
export const MUSIC_WORLD: WorldDef = {
  id: 'music',
  name: { en: 'Music Factory', zh: '音乐工厂' },
  theme: 'music',
  ruleCard: { en: 'Everything here moves to the beat. Count it.', zh: '这里的一切都跟着节拍动，数好拍子。' },
  ruleTag: { en: 'BEAT', zh: '节拍' },
  holes: [
    // 1. Teaching: one gate across a straight lane, open for two beats and shut for two.
    {
      id: 'music-1',
      par: 2,
      beat: { ticks: BEAT },
      tee: [0, 0, 5.5],
      goal: { type: 'cup', position: [0, 0, -7.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: [
        { type: 'floor', min: [-2, -9], max: [2, 7], surface: FLOOR },
        { type: 'wall', from: [-2, 7], to: [2, 7], surface: WALL },
        { type: 'wall', from: [2, 7], to: [2, -9], surface: WALL },
        { type: 'wall', from: [2, -9], to: [-2, -9], surface: WALL },
        { type: 'wall', from: [-2, -9], to: [-2, 7], surface: WALL },
        ...wallWithDoors([-2, -1], [2, -1], [[1.2, 2.8]], WALL, { height: 0.8 }),
      ],
      field: { parts: shutter('gate', [-0.8, -1], [0.8, -1], [1, 1, 0, 0]) },
      decor: [tower(-7, 3, 3), tower(7, -3, 2.6, 0x3a2a66), tower(-7.5, -6, 2.2, 0x3a2a66)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: two runs of keys, like two steps of a stair. Each stands level with
    //    the floor before it for two beats and with the floor after it for two. Roll
    //    onto one as it is about to rise, and be on it still when it gets there.
    {
      id: 'music-2',
      par: 4,
      beat: { ticks: BEAT },
      tee: [0, 0, 7.5],
      goal: { type: 'cup', position: [0, 1.2, -9.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        { type: 'floor', min: [-2, -0.5], max: [2, 9], surface: FLOOR },
        { type: 'floor', min: [-2, -6.5], max: [2, -0.5], y: 0.6, depth: 1.05, surface: FLOOR },
        { type: 'floor', min: [-2, -11], max: [2, -6.5], y: 1.2, depth: 1.65, surface: FLOOR },
        { type: 'wall', from: [-2, 9], to: [2, 9], surface: WALL },
        { type: 'wall', from: [-2, -11], to: [2, -11], y: 1.2, surface: WALL },
        // The sides, taller beside the keys than a ball riding one can get over
        { type: 'wall', from: [-2, 3], to: [-2, 9], surface: WALL },
        { type: 'wall', from: [2, 9], to: [2, 3], surface: WALL },
        { type: 'wall', from: [-2, -0.5], to: [-2, 3], height: 1, surface: WALL },
        { type: 'wall', from: [2, 3], to: [2, -0.5], height: 1, surface: WALL },
        { type: 'wall', from: [-2, -3], to: [-2, -0.5], y: 0.6, surface: WALL },
        { type: 'wall', from: [2, -0.5], to: [2, -3], y: 0.6, surface: WALL },
        { type: 'wall', from: [-2, -6.5], to: [-2, -3], y: 0.6, height: 1, surface: WALL },
        { type: 'wall', from: [2, -3], to: [2, -6.5], y: 0.6, height: 1, surface: WALL },
        { type: 'wall', from: [-2, -11], to: [-2, -6.5], y: 1.2, surface: WALL },
        { type: 'wall', from: [2, -6.5], to: [2, -11], y: 1.2, surface: WALL },
      ],
      movers: [
        pianoKeys([-1.9, -0.5], [1.9, 3], 0, 0.6, { rest: [[0, 0, 4.5]], note: 0 }),
        pianoKeys([-1.9, -6.5], [1.9, -3], 0.6, 0.6, { phase: 0.5, rest: [[0, 0.6, -1.75]], note: 4 }),
      ],
      decor: [tower(-7, 5, 2.8), tower(7, 0, 3.2, 0x3a2a66), tower(-7.5, -7, 3.6, 0x3a2a66)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58 },
    },

    // 3. Challenge: all three. A gate, then a drum that throws the ball up onto a soft
    //    landing, then keys to the floor the cup is on.
    {
      id: 'music-3',
      par: 4,
      beat: { ticks: BEAT },
      tee: [0, 0, 10.5],
      goal: { type: 'cup', position: [0, 1.6, -10], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        { type: 'floor', min: [-2, 1.5], max: [2, 12], surface: FLOOR },
        { type: 'floor', min: [-2, -2.5], max: [2, 1.5], y: 1, depth: 1.45, surface: 'cushion' },
        { type: 'floor', min: [-2, -7], max: [2, -2.5], y: 1, depth: 1.45, surface: FLOOR },
        { type: 'floor', min: [-2, -11.5], max: [2, -7], y: 1.6, depth: 2.05, surface: FLOOR },
        { type: 'wall', from: [-2, 12], to: [2, 12], surface: WALL },
        { type: 'wall', from: [-2, -11.5], to: [2, -11.5], y: 1.6, surface: WALL },
        ...wallWithDoors([-2, 7], [2, 7], [[1.2, 2.8]], WALL, { height: 0.8 }),
        { type: 'wall', from: [-2, 1.5], to: [-2, 12], surface: WALL },
        { type: 'wall', from: [2, 12], to: [2, 1.5], surface: WALL },
        { type: 'wall', from: [-2, -3.5], to: [-2, 1.5], y: 1, surface: WALL },
        { type: 'wall', from: [2, 1.5], to: [2, -3.5], y: 1, surface: WALL },
        { type: 'wall', from: [-2, -7], to: [-2, -3.5], y: 1, height: 1, surface: WALL },
        { type: 'wall', from: [2, -3.5], to: [2, -7], y: 1, height: 1, surface: WALL },
        { type: 'wall', from: [-2, -11.5], to: [-2, -7], y: 1.6, surface: WALL },
        { type: 'wall', from: [2, -7], to: [2, -11.5], y: 1.6, surface: WALL },
      ],
      field: { parts: shutter('gate', [-0.8, 7], [0.8, 7], [1, 1, 0, 0]) },
      movers: [pianoKeys([-1.9, -7], [1.9, -3.5], 1, 0.6, { rest: [[0, 1, -1.5]], note: 2 })],
      decor: [tower(-7, 8, 2.8), tower(7, 4, 3.2, 0x3a2a66), tower(-7.5, -4, 3.8, 0x3a2a66), tower(7, -8, 4.2)],
      zones: [
        FALL,
        drumPad([0, 0, 3.2], 0.8, { beat: BEAT, every: 2, velocity: [0, 6.5, -4], rest: [[0, 0, 5.2]] }),
      ],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 32 },
    },
  ],
};
