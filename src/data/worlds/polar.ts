import type { PieceDef, WorldDef } from '../../level/schema';
import type { ZoneDef } from '../../physics/zones';
import { gusts } from '../../physics/zones/wind';
import { CUP, FALL } from './common';

const FLOOR = 'packedSnow';
const WALL = 'stationWall';
/** Thick enough that the ground stands as a cliff over the ditch beside it. */
const DEEP = 1.4;

/**
 * A snow ditch between two stretches of ground: a floor lower down, and a ball that
 * comes to it is out of bounds. It is there to be flown over.
 */
function ditch(min: readonly [number, number], max: readonly [number, number]): { floor: PieceDef; lost: ZoneDef } {
  return {
    floor: { type: 'floor', min, max, y: -0.8, depth: 0.3, surface: 'snow' },
    lost: {
      type: 'outOfBounds',
      shape: {
        kind: 'box',
        center: [(min[0] + max[0]) / 2, -0.55, (min[1] + max[1]) / 2],
        halfExtents: [(max[0] - min[0]) / 2, 0.3, (max[1] - min[1]) / 2],
      },
    },
  };
}

/** A ramp at the north end of a stretch of ground that throws a north-going ball into the air. */
const kicker = (z: number): PieceDef => ({
  type: 'ramp',
  min: [-1, z - 2],
  max: [1, z],
  along: 'z',
  yFrom: 0.7,
  yTo: 0,
  depth: DEEP,
  surface: FLOOR,
});

/** The air over a hole: wind is felt anywhere in it. */
const sky = (z: number, half: number) => ({ kind: 'box', center: [0, 4, z], halfExtents: [9, 5, half] }) as const;

const ditch1 = ditch([-3, -5], [3, 0]);
const ditch2 = ditch([-1.5, -6], [1.5, 2]);
const ditch3a = ditch([-3, 2], [3, 6]);
const ditch3b = ditch([-3, -13], [3, -6]);

/** Loose snow to come down in: a ball that lands in it stops where it lands. */
const drift = (min: readonly [number, number], max: readonly [number, number]): PieceDef => ({
  type: 'floor',
  min,
  max,
  depth: DEEP,
  surface: 'drift',
});

/**
 * World 20: wind (SPEC v5 3.3). It pushes a ball that is in the air and leaves one on
 * the ground alone, and it changes on a fixed round, with the vane turning just before
 * it does. So the question is when to take off.
 */
export const POLAR_WORLD: WorldDef = {
  id: 'polar',
  name: { en: 'Polar Station', zh: '极地' },
  theme: 'polar',
  ruleCard: {
    en: 'Wind only pushes a ball in the air. Watch the vane.',
    zh: '风只吹空中的球，看好风向标。',
  },
  ruleTag: { en: 'WIND', zh: '风' },
  holes: [
    // 1. Teaching: one jump over a ditch, and wind that blows up the course and then
    //    down it. With the wind behind, the ball carries to the far side; into it, short.
    {
      id: 'polar-1',
      par: 3,
      tee: [0, 0, 7.5],
      goal: { type: 'cup', position: [0, 0, -9.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-2, 2], max: [2, 9], depth: DEEP, surface: FLOOR },
        kicker(2),
        { type: 'wall', from: [-2, 9], to: [2, 9], surface: WALL },
        { type: 'wall', from: [-2, 2], to: [-2, 9], surface: WALL },
        { type: 'wall', from: [2, 9], to: [2, 2], surface: WALL },
        { type: 'wall', from: [-2, 2], to: [-1, 2], surface: WALL },
        { type: 'wall', from: [1, 2], to: [2, 2], surface: WALL },
        ditch1.floor,
        drift([-2.5, -8], [2.5, -5]),
        { type: 'floor', min: [-2.5, -11], max: [2.5, -8], depth: DEEP, surface: FLOOR },
        { type: 'wall', from: [-2.5, -11], to: [2.5, -11], height: 0.8, surface: WALL },
        { type: 'wall', from: [-2.5, -11], to: [-2.5, -5], surface: WALL },
        { type: 'wall', from: [2.5, -5], to: [2.5, -11], surface: WALL },
      ],
      decor: [
        { type: 'crystals', at: [-4.6, -1.4, 5], size: [2.2, 0, 0], color: 0xbfe6ff },
        { type: 'crystals', at: [4.6, -1.4, -1], size: [1.6, 0, 0], color: 0xbfe6ff },
        { type: 'crystals', at: [-4.4, -1.4, -9], size: [2, 0, 0], color: 0xbfe6ff },
        { type: 'rock', at: [4.2, -1.4, 7], size: [1, 0, 0], color: 0xe8f0f6 },
      ],
      zones: [FALL, ditch1.lost, gusts(sky(-3, 9), [[0, -7], [0, 7]], 2.5, [-1.6, 0, 2.5])],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: the ditch runs straight ahead and there is ground to either side of
    //    it. Four winds in turn: east and west each put the ball down on an island, and
    //    only the east island has the cup. The other two leave it in the ditch.
    {
      id: 'polar-2',
      par: 3,
      tee: [0, 0, 8.5],
      goal: { type: 'cup', position: [5, 0, -4.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-2, 4], max: [2, 10], depth: DEEP, surface: FLOOR },
        kicker(4),
        { type: 'wall', from: [-2, 10], to: [2, 10], surface: WALL },
        { type: 'wall', from: [-2, 4], to: [-2, 10], surface: WALL },
        { type: 'wall', from: [2, 10], to: [2, 4], surface: WALL },
        { type: 'wall', from: [-2, 4], to: [-1, 4], surface: WALL },
        { type: 'wall', from: [1, 4], to: [2, 4], surface: WALL },
        ditch2.floor,
        // The east island, with the cup: loose snow to land in, firm ground beyond it
        drift([1.5, -6], [4, -1.5]),
        { type: 'floor', min: [1.5, -7], max: [4, -6], depth: DEEP, surface: FLOOR },
        { type: 'floor', min: [4, -7], max: [6, -1.5], depth: DEEP, surface: FLOOR },
        { type: 'wall', from: [6, -1.5], to: [6, -7], height: 0.8, surface: WALL },
        // The west island, and the walk round to the east one
        drift([-4, -6], [-1.5, -1.5]),
        { type: 'floor', min: [-4, -7], max: [-1.5, -6], depth: DEEP, surface: FLOOR },
        { type: 'floor', min: [-6, -7], max: [-4, -1.5], depth: DEEP, surface: FLOOR },
        { type: 'wall', from: [-6, -7], to: [-6, -1.5], height: 0.8, surface: WALL },
        { type: 'floor', min: [-1.5, -7], max: [1.5, -6], depth: DEEP, surface: FLOOR },
        { type: 'wall', from: [-6, -7], to: [6, -7], height: 0.8, surface: WALL },
      ],
      decor: [
        { type: 'crystals', at: [-4.2, -1.4, 8], size: [2, 0, 0], color: 0xbfe6ff },
        { type: 'crystals', at: [4.4, -1.4, 6], size: [1.6, 0, 0], color: 0xbfe6ff },
        { type: 'crystals', at: [-7.6, -1.4, -4], size: [2.4, 0, 0], color: 0xbfe6ff },
        { type: 'rock', at: [7.8, -1.4, -3], size: [1.1, 0, 0], color: 0xe8f0f6 },
      ],
      zones: [FALL, ditch2.lost, gusts(sky(-1, 9), [[9, 0], [0, -7], [-9, 0], [0, 7]], 2.2, [-1.6, 0, 4.5])],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: two jumps. The first is short, behind a fence that keeps the wind
    //    off it. The second is too long for any stroke without the wind behind it, and
    //    half the time the wind is across.
    {
      id: 'polar-3',
      par: 4,
      tee: [0, 0, 11.5],
      goal: { type: 'cup', position: [0, 0, -16.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        { type: 'floor', min: [-2, 8], max: [2, 13], depth: DEEP, surface: FLOOR },
        kicker(8),
        { type: 'wall', from: [-2, 13], to: [2, 13], surface: WALL },
        { type: 'wall', from: [-2, 8], to: [-2, 13], surface: WALL },
        { type: 'wall', from: [2, 13], to: [2, 8], surface: WALL },
        { type: 'wall', from: [-2, 8], to: [-1, 8], surface: WALL },
        { type: 'wall', from: [1, 8], to: [2, 8], surface: WALL },
        ditch3a.floor,
        // The fence: tall, standing in the ditch on both sides of the first jump
        { type: 'wall', from: [-2.6, 7.6], to: [-2.6, 1.4], y: -0.8, height: 4, thickness: 0.16, surface: WALL },
        { type: 'wall', from: [2.6, 7.6], to: [2.6, 1.4], y: -0.8, height: 4, thickness: 0.16, surface: WALL },
        // The ground between the jumps: snow to land in, then a run-up
        drift([-2.5, -1], [2.5, 2]),
        { type: 'floor', min: [-2.5, -4], max: [2.5, -1], depth: DEEP, surface: FLOOR },
        kicker(-4),
        { type: 'wall', from: [-2.5, -4], to: [-2.5, 2], surface: WALL },
        { type: 'wall', from: [2.5, 2], to: [2.5, -4], surface: WALL },
        { type: 'wall', from: [-2.5, -4], to: [-1, -4], surface: WALL },
        { type: 'wall', from: [1, -4], to: [2.5, -4], surface: WALL },
        ditch3b.floor,
        // The far side
        drift([-2.5, -15.5], [2.5, -13]),
        { type: 'floor', min: [-2.5, -18], max: [2.5, -15.5], depth: DEEP, surface: FLOOR },
        { type: 'wall', from: [-2.5, -18], to: [2.5, -18], height: 0.8, surface: WALL },
        { type: 'wall', from: [-2.5, -18], to: [-2.5, -13], surface: WALL },
        { type: 'wall', from: [2.5, -13], to: [2.5, -18], surface: WALL },
      ],
      decor: [
        { type: 'crystals', at: [-4.6, -1.4, 11], size: [2, 0, 0], color: 0xbfe6ff },
        { type: 'crystals', at: [4.8, -1.4, -1], size: [1.8, 0, 0], color: 0xbfe6ff },
        { type: 'crystals', at: [-4.8, -1.4, -9], size: [2.4, 0, 0], color: 0xbfe6ff },
        { type: 'crystals', at: [4.6, -1.4, -16], size: [1.7, 0, 0], color: 0xbfe6ff },
        { type: 'rock', at: [-4.6, -1.4, -16], size: [1, 0, 0], color: 0xe8f0f6 },
      ],
      zones: [
        FALL,
        ditch3a.lost,
        ditch3b.lost,
        gusts(
          sky(-3, 17),
          [[-10, 0], [0, -8], [10, 0], [0, -8]],
          2,
          [-1.9, 0, -3.4],
          [{ kind: 'box', center: [0, 2.5, 4.5], halfExtents: [2.6, 3.5, 3.2] }],
        ),
      ],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 34 },
    },
  ],
};
