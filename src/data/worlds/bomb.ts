import type { DecorDef, WorldDef } from '../../level/schema';
import type { ZoneDef } from '../../physics/zones';
import { CUP, FALL } from './common';

/** A clock on the ground: rolling over it adds `seconds` to the countdown, once. */
const clock = (x: number, z: number, seconds: number): ZoneDef => ({
  type: 'timeBonus',
  shape: { kind: 'sphere', center: [x, 0, z], radius: 0.55 },
  params: { seconds },
});

/** Crates and barrels stacked beside the course, on ledges of rock just above the lava. */
const stores = (...spots: [type: 'crate' | 'barrel', x: number, z: number][]): DecorDef[] =>
  spots.flatMap(([type, x, z]): DecorDef[] => [
    { type: 'rock', at: [x, -1.15, z], size: [1.3, 0, 0], color: 0x3a3340 },
    { type, at: [x, -0.5, z] },
  ]);

/**
 * World 10: the whole hole is on one fuse. It is lit by the first stroke and burns
 * while you aim, so every second spent lining up a shot is a second gone. Clocks on
 * the ground give time back, once each. When it runs out the hole starts over.
 */
export const BOMB_WORLD: WorldDef = {
  id: 'bomb',
  name: { en: 'Bomb Ball', zh: '炸弹球' },
  theme: 'bomb',
  ruleCard: { en: 'You have limited time. Grab the clocks for more!', zh: '时间有限，碰到时钟可以加时！' },
  ruleTag: { en: 'COUNTDOWN', zh: '倒计时' },
  holes: [
    // 1. Teaching: one corner, and far more time than it takes. Nothing to learn here
    //    but the clock at the top of the screen.
    {
      id: 'bomb-1',
      par: 2,
      timer: { seconds: 30 },
      tee: [0, 0, 5],
      cup: { position: [7, 0, -6], ...CUP },
      challenge: { type: 'timeLeft', seconds: 18, text: { en: 'Finish with 18 seconds left', zh: '剩余 18 秒以上完成' } },
      pieces: [
        { type: 'floor', min: [-2, -4], max: [2, 7], surface: 'basalt' },
        { type: 'floor', min: [-2, -8], max: [9, -4], surface: 'basalt' },
        { type: 'wall', from: [-2, 7], to: [2, 7], surface: 'hazard' },
        { type: 'wall', from: [2, 7], to: [2, -4], surface: 'hazard' },
        { type: 'wall', from: [2, -4], to: [9, -4], surface: 'hazard' },
        { type: 'wall', from: [9, -4], to: [9, -8], surface: 'hazard' },
        { type: 'wall', from: [9, -8], to: [-2, -8], surface: 'hazard' },
        { type: 'wall', from: [-2, -8], to: [-2, 7], surface: 'hazard' },
        { type: 'wall', from: [-2, -4], to: [2, -8], surface: 'hazard' },
      ],
      decor: stores(['crate', 4.5, 0], ['barrel', 5.6, 1.2], ['barrel', -4.5, -2], ['crate', -4.2, 4.5], ['crate', 4, -10.5]),
      zones: [FALL],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: clocks. The straight line to the cup is blocked; the gap beside the
    //    block is quick but leaves no time to spare, and the long way round runs over a
    //    clock that pays for the detour.
    {
      id: 'bomb-2',
      par: 3,
      timer: { seconds: 12 },
      tee: [0, 0, 5],
      cup: { position: [0, 0, -8], ...CUP },
      challenge: {
        type: 'maxCues',
        cue: 'timeBonus',
        count: 0,
        text: { en: 'Finish without touching a clock', zh: '不碰任何时钟完成' },
      },
      pieces: [
        { type: 'floor', min: [-5, -10], max: [5, 7], surface: 'basalt' },
        { type: 'wall', from: [-5, 7], to: [5, 7], surface: 'hazard' },
        { type: 'wall', from: [5, 7], to: [5, -10], surface: 'hazard' },
        { type: 'wall', from: [5, -10], to: [-5, -10], surface: 'hazard' },
        { type: 'wall', from: [-5, -10], to: [-5, 7], surface: 'hazard' },
        // The block across the middle: a narrow gap on the left, a wide way round on the right.
        { type: 'wall', from: [-4, -2], to: [2.5, -2], height: 0.6, thickness: 0.6, surface: 'obsidian' },
        { type: 'pillar', at: [1.5, -5.5], radius: 0.45, surface: 'obsidian' },
      ],
      decor: stores(['barrel', 7.5, 0], ['crate', 7.2, -5], ['crate', -7.5, 3], ['barrel', -7.2, -6], ['crate', 0, -12.5]),
      zones: [FALL, clock(3.8, 1.5, 8), clock(3.8, -6, 6)],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: a short fuse and three clocks along a doubled-back corridor. There
    //    is only time to finish if clocks are picked up on the way. Two lie on the route;
    //    the third is past the cup, for a player who needs it badly enough to overshoot.
    {
      id: 'bomb-3',
      par: 4,
      timer: { seconds: 12 },
      tee: [-4, 0, 6],
      cup: { position: [4, 0, 6], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        { type: 'floor', min: [-6, -8], max: [6, 8], surface: 'basalt' },
        { type: 'wall', from: [-6, 8], to: [6, 8], surface: 'hazard' },
        { type: 'wall', from: [6, 8], to: [6, -8], surface: 'hazard' },
        { type: 'wall', from: [6, -8], to: [-6, -8], surface: 'hazard' },
        { type: 'wall', from: [-6, -8], to: [-6, 8], surface: 'hazard' },
        // Two dividers make three lanes: up the left one, back down the middle, across to the right.
        { type: 'wall', from: [-2, 8], to: [-2, -4.5], height: 0.6, surface: 'obsidian' },
        { type: 'wall', from: [2, -8], to: [2, 4.5], height: 0.6, surface: 'obsidian' },
        // A pair of deflectors at the far end turns a ball from the left lane into the middle one.
        { type: 'wall', from: [-6, -4], to: [-2, -8], surface: 'hazard' },
        { type: 'wall', from: [-2, -8], to: [2, -4], surface: 'hazard' },
      ],
      decor: stores(['crate', -8.5, 4], ['barrel', -8.3, -3], ['barrel', 8.5, 2], ['crate', 8.4, -5], ['crate', 0, 10.5], ['barrel', 1.3, -10.5]),
      zones: [FALL, clock(-4, -3, 7), clock(0, 2, 7), clock(4, 1, 7)],
      outOfBounds: 'lastPosition',
      // The tee and the cup are side by side; pull back far enough to show the way round.
      camera: { minDistance: 21, pitch: 60 },
    },
  ],
};
