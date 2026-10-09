import type { DecorDef, WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';
import { wallWithDoors } from './ruins';

const FLOOR = 'echoFloor';
const WALL = 'echoWall';

const DEEP = -3.6;
const stone = (x: number, z: number, size = 2.4): DecorDef => ({ type: 'rock', at: [x, DEEP, z], size: [size, 0, 0], color: 0x56637a });
const spire = (x: number, z: number, height = 6): DecorDef => ({ type: 'obelisk', at: [x, DEEP, z], size: [1.4, height, 0], color: 0x4a5670 });

/**
 * World 34: echoes (SPEC v8 3.5). Rippled ground remembers the last stroke: play
 * another and the one before runs again as a pale ball, where it ran and when it ran.
 * An echo touches nothing but the silver plates, which nothing else can press.
 */
export const ECHO_WORLD: WorldDef = {
  id: 'echo',
  name: { en: 'Echo', zh: '回声球' },
  theme: 'echo',
  ruleCard: {
    en: 'Your last shot echoes. Echoes press the silver plates.',
    zh: '你的上一杆会留下回声，回声能压下银色的板。',
  },
  ruleTag: { en: 'ECHO', zh: '回声' },
  holes: [
    // 1. Teaching: a silver plate a little way up, and a shut gate a long way up. Roll
    //    onto the plate: nothing. Play again, and the echo of that roll opens the gate
    //    for good, well before a ball can get there.
    {
      id: 'echo-1',
      par: 3,
      tee: [0, 0, 7],
      goal: { type: 'cup', position: [0, 0, -5.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-3, -8], max: [3, 8.5], surface: FLOOR },
        { type: 'wall', from: [-3, 8.5], to: [3, 8.5], surface: WALL },
        { type: 'wall', from: [3, 8.5], to: [3, -8], surface: WALL },
        { type: 'wall', from: [3, -8], to: [-3, -8], surface: WALL },
        { type: 'wall', from: [-3, -8], to: [-3, 8.5], surface: WALL },
        ...wallWithDoors([-3, -2], [3, -2], [[2.3, 3.7]], WALL, { height: 0.8 }),
      ],
      field: {
        parts: [
          { kind: 'echo', id: 'zone', min: [-3, 3.5], max: [3, 8.5] },
          { kind: 'echoPlate', id: 'silver', at: [0, 0, 5.2], mode: 'latch', radius: 0.6 },
          { kind: 'gate', id: 'gate', from: [-0.7, -2], to: [0.7, -2], when: 'silver', delay: 8, via: [[1.6, 5.2], [1.6, -1.2], [0, -1.2]] },
        ],
      },
      decor: [stone(-5.5, 6), spire(5.5, 2), stone(5.5, -6), spire(-5.5, -4, 5)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 32 },
    },

    // 2. Variation: this plate holds the gate only while an echo stands on it, and the
    //    gate is the other way. Send a ball left to die in the moss on the plate; then
    //    go right, and the echo runs left again to hold the gate while you get there.
    //    Get there too soon and it is still shut.
    {
      id: 'echo-2',
      par: 3,
      tee: [0, 0, 0],
      goal: { type: 'cup', position: [6.6, 0, 0], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-8, -3], max: [-6, 3], surface: FLOOR },
        { type: 'floor', min: [-6, -3], max: [-4, -1], surface: FLOOR },
        { type: 'floor', min: [-6, -1], max: [-4, 1], surface: 'hush' },
        { type: 'floor', min: [-6, 1], max: [-4, 3], surface: FLOOR },
        { type: 'floor', min: [-4, -3], max: [8.5, 3], surface: FLOOR },
        { type: 'wall', from: [-8, 3], to: [8.5, 3], surface: WALL },
        { type: 'wall', from: [8.5, 3], to: [8.5, -3], surface: WALL },
        { type: 'wall', from: [8.5, -3], to: [-8, -3], surface: WALL },
        { type: 'wall', from: [-8, -3], to: [-8, 3], surface: WALL },
        ...wallWithDoors([4, -3], [4, 3], [[2.3, 3.7]], WALL, { height: 0.8 }),
      ],
      field: {
        parts: [
          { kind: 'echo', id: 'zone', min: [-8, -3], max: [-2.5, 3] },
          { kind: 'echoPlate', id: 'silver', at: [-5, 0, 0], mode: 'hold', radius: 0.7 },
          { kind: 'gate', id: 'gate', from: [4, -0.7], to: [4, 0.7], when: 'silver', delay: 6, via: [[-5, 2], [3.2, 2], [3.2, 0]] },
        ],
      },
      decor: [stone(-9, -6), spire(0, -6.5), stone(9, -6), spire(-10.5, 3, 5), stone(10.5, 4)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      // The plate is one way and the cup the other: keep both ends of the room in view.
      camera: { pitch: 60, maxDistance: 32, keep: [[-8, 0, 0]] },
    },

    // 3. Challenge: two stretches of rippled ground, a silver plate in each, and a gate
    //    that wants both, back behind the tee. One stroke up the course can cross both
    //    plates, and only its echo will press them. Then come all the way back: by the
    //    time the ball is at the gate, the echo has laid the whole road.
    {
      id: 'echo-3',
      par: 3,
      tee: [-3, 0, 5.5],
      goal: { type: 'cup', position: [0, 0, 9.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-4, -9], max: [4, 11], surface: FLOOR },
        { type: 'wall', from: [-4, 11], to: [4, 11], surface: WALL },
        { type: 'wall', from: [4, 11], to: [4, -9], surface: WALL },
        { type: 'wall', from: [4, -9], to: [-4, -9], surface: WALL },
        { type: 'wall', from: [-4, -9], to: [-4, 11], surface: WALL },
        ...wallWithDoors([-4, 7.5], [4, 7.5], [[3.3, 4.7]], WALL, { height: 0.8 }),
      ],
      field: {
        parts: [
          { kind: 'echo', id: 'near', min: [-3.5, 1], max: [0.5, 4] },
          { kind: 'echo', id: 'far', min: [-0.5, -5], max: [3.5, -2] },
          { kind: 'echoPlate', id: 'first', at: [-1.5, 0, 2.5], mode: 'latch', radius: 0.5 },
          { kind: 'echoPlate', id: 'second', at: [1.5, 0, -3.5], mode: 'latch', radius: 0.5 },
          { kind: 'gate', id: 'gate', from: [-0.7, 7.5], to: [0.7, 7.5], when: { all: ['first', 'second'] }, delay: 8, via: [[-1.5, 6.6], [0, 6.6]] },
        ],
      },
      decor: [stone(-6.5, 7), spire(6.5, 4), stone(6.5, -3), spire(-6.5, -1, 5), stone(-6, -8)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      // The plates lie up the course and the cup behind the tee: keep the far end in view.
      camera: { pitch: 58, maxDistance: 36, keep: [[0, 0, -9]] },
    },
  ],
};
