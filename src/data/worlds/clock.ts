import type { DecorDef, WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';
import { wallWithDoors } from './ruins';

const FLOOR = 'clockFloor';
const WALL = 'brass';
const MACHINE = 'cog';
/** Where a dial points when it starts: slow, normal or fast. A knock moves it on to the next. */
export const SLOW = 0;
export const NORMAL = 1;
export const FAST = 2;

/** The works of the great clock, far below the course: cogs lying flat, bigger than the holes. */
const cog = (x: number, z: number, radius: number, color = 0xc9a24b): DecorDef => ({
  type: 'gear',
  at: [x, -3.55, z],
  size: [radius, 0, 0],
  color,
});

/**
 * World 26: time zones (SPEC v6 3.5). A clock switch sets how fast the machines in its
 * zone run: slow, normal, fast, round and round. The ball is not in it: only machines
 * keep a zone's time. On the last hole a zone is slow for as long as the ball is in it.
 */
export const CLOCK_WORLD: WorldDef = {
  id: 'clock',
  name: { en: 'Clockwork', zh: '钟表' },
  theme: 'clocktower',
  ruleCard: {
    en: 'Clocks change how fast the machines run — not you.',
    zh: '时钟改变机器的速度，不改变你。',
  },
  ruleTag: { en: 'CLOCKS', zh: '时钟' },
  holes: [
    // 1. Teaching: a piston across the lane, far too quick to get past. The clock
    //    switch by the tee stands at fast; one knock takes it round to slow.
    {
      id: 'clock-1',
      par: 3,
      tee: [0, 0, 5.5],
      // To one side: the piston never leaves the middle of the lane clear.
      goal: { type: 'cup', position: [-1.2, 0, -7.5], ...CUP },
      challenge: { type: 'noMoverHits', text: { en: 'Never touch the piston', zh: '全程不碰推杆' } },
      pieces: [
        { type: 'floor', min: [-2, -9], max: [2, 7], surface: FLOOR },
        { type: 'wall', from: [-2, 7], to: [2, 7], surface: WALL },
        { type: 'wall', from: [2, 7], to: [2, -9], surface: WALL },
        { type: 'wall', from: [2, -9], to: [-2, -9], surface: WALL },
        { type: 'wall', from: [-2, -9], to: [-2, 7], surface: WALL },
      ],
      movers: [
        {
          role: 'pusher',
          size: [2.4, 0.6, 0.5],
          position: [-0.5, 0.3, -1],
          surface: MACHINE,
          motion: { type: 'slide', offset: [1, 0, 0], period: 1.6, hold: [0.3, 0.3] },
          sweep: { kind: 'box', center: [0, 0.3, -1], halfExtents: [2, 0.5, 0.6] },
          rest: [
            [0, 0, 0.6],
            [0, 0, -2.6],
          ],
          clock: 'zone',
        },
      ],
      field: {
        parts: [
          { kind: 'dial', id: 'dial', at: [1.4, 0, 3.2], start: FAST },
          { kind: 'timeZone', id: 'zone', min: [-2, -3], max: [2, 1], dial: 'dial' },
        ],
      },
      decor: [cog(-6, 2, 3.4), cog(6.5, -4, 2.6, 0xa87f45), cog(-6, -8, 2)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: two bridges end to end over the drop, each on a clock of its own.
    //    While the two clocks keep the same time, one bridge is always away when the
    //    other is in place. Set them to different rates and they drift into step.
    {
      id: 'clock-2',
      par: 4,
      tee: [0, 0, 7.6],
      goal: { type: 'cup', position: [1.2, 0, -7.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        { type: 'floor', min: [-2.5, 4], max: [2.5, 9], depth: 3, surface: FLOOR },
        { type: 'floor', min: [-2.5, -9], max: [2.5, -4], depth: 3, surface: FLOOR },
        { type: 'wall', from: [-2.5, 9], to: [2.5, 9], surface: WALL },
        { type: 'wall', from: [-2.5, 4], to: [-2.5, 9], surface: WALL },
        { type: 'wall', from: [2.5, 9], to: [2.5, 4], surface: WALL },
        ...wallWithDoors([-2.5, 4], [2.5, 4], [[1.6, 3.4]], WALL),
        ...wallWithDoors([-2.5, -4], [2.5, -4], [[1.6, 3.4]], WALL),
        { type: 'wall', from: [-2.5, -9], to: [2.5, -9], surface: WALL },
        { type: 'wall', from: [-2.5, -9], to: [-2.5, -4], surface: WALL },
        { type: 'wall', from: [2.5, -4], to: [2.5, -9], surface: WALL },
      ],
      movers: [
        {
          // Tops 6 mm above the banks, reaching 30 cm onto each and 30 cm past the middle.
          role: 'platform',
          size: [1.6, 0.3, 4.6],
          position: [0, -0.144, 2],
          surface: MACHINE,
          motion: { type: 'swing', pivot: [0, 4], angle: 60, period: 6, hold: [0.4, 0.1] },
          rest: [[0, 0, 5.5]],
          clock: 'near',
        },
        {
          role: 'platform',
          size: [1.6, 0.3, 4.6],
          position: [0, -0.144, -2],
          surface: MACHINE,
          motion: { type: 'swing', pivot: [0, -4], angle: 60, period: 6, hold: [0.4, 0.1], phase: 0.5 },
          rest: [[0, 0, -5.5]],
          clock: 'far',
        },
      ],
      field: {
        parts: [
          { kind: 'dial', id: 'nearDial', at: [-1.8, 0, 5] },
          { kind: 'dial', id: 'farDial', at: [1.8, 0, 5] },
          { kind: 'timeZone', id: 'near', min: [-3, 0], max: [3, 4], dial: 'nearDial' },
          { kind: 'timeZone', id: 'far', min: [-3, -4], max: [3, 0], dial: 'farDial' },
        ],
      },
      decor: [cog(-7, 4, 3.2), cog(7, -1, 3.6, 0xa87f45), cog(-7, -7, 2.4)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58 },
    },

    // 3. Challenge: two windmills turning too fast to pass, in a zone that goes slow
    //    for as long as the ball is in it. Then a piston on a clock switch, as before.
    {
      id: 'clock-3',
      par: 5,
      tee: [0, 0, 8.5],
      goal: { type: 'cup', position: [0, 0, -11.5], ...CUP },
      challenge: { type: 'noMoverHits', text: { en: 'Never touch a machine', zh: '全程不碰任何机器' } },
      pieces: [
        { type: 'floor', min: [-2.5, -13], max: [2.5, 10], surface: FLOOR },
        { type: 'wall', from: [-2.5, 10], to: [2.5, 10], surface: WALL },
        { type: 'wall', from: [2.5, 10], to: [2.5, -13], surface: WALL },
        { type: 'wall', from: [2.5, -13], to: [-2.5, -13], surface: WALL },
        { type: 'wall', from: [-2.5, -13], to: [-2.5, 10], surface: WALL },
      ],
      movers: [
        {
          role: 'pusher',
          size: [4.2, 0.6, 0.4],
          position: [0, 0.3, 4],
          surface: MACHINE,
          motion: { type: 'spin', pivot: [0, 4], period: 3 },
          sweep: { kind: 'sphere', center: [0, 0.3, 4], radius: 2.25 },
          rest: [
            [0, 0, 6.6],
            [0, 0, 1.25],
          ],
          clock: 'mills',
          look: 'hand',
        },
        {
          role: 'pusher',
          size: [4.2, 0.6, 0.4],
          position: [0, 0.3, -1.5],
          surface: MACHINE,
          motion: { type: 'spin', pivot: [0, -1.5], period: 3, phase: 0.25 },
          sweep: { kind: 'sphere', center: [0, 0.3, -1.5], radius: 2.25 },
          rest: [
            [0, 0, 1.25],
            [0, 0, -4.4],
          ],
          clock: 'mills',
          look: 'hand',
        },
        {
          role: 'pusher',
          size: [2.8, 0.6, 0.5],
          position: [-0.6, 0.3, -8.2],
          surface: MACHINE,
          motion: { type: 'slide', offset: [1.2, 0, 0], period: 1.6, hold: [0.3, 0.3] },
          sweep: { kind: 'box', center: [0, 0.3, -8.2], halfExtents: [2.5, 0.5, 0.6] },
          rest: [
            [0, 0, -6.9],
            [0, 0, -9.5],
          ],
          clock: 'last',
        },
      ],
      field: {
        parts: [
          { kind: 'timeZone', id: 'mills', min: [-2.5, -4], max: [2.5, 6.5], rate: 2, carried: 0.5 },
          { kind: 'dial', id: 'dial', at: [1.8, 0, -5.2], start: FAST },
          { kind: 'timeZone', id: 'last', min: [-2.5, -10], max: [2.5, -6.5], dial: 'dial' },
        ],
      },
      decor: [cog(-7, 6, 3.4), cog(7, 1, 3, 0xa87f45), cog(-7.5, -5, 2.6), cog(7, -10, 3.4)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 34 },
    },
  ],
};
