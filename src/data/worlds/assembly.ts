import type { DecorDef, WorldDef } from '../../level/schema';
import { robotArm } from '../../physics/zones/arm';
import { CUP, FALL } from './common';
import { wallWithDoors } from './ruins';
import { belt, beltFloor } from './toy';

const FLOOR = 'plant';
const WALL = 'hazard';
const TRIM = 'duct';

/** The hall floor, far below, with what stands on it: pillars, and pipes on their feet. */
const FLOOR_Y = -3.6;
const pillar = (x: number, z: number): DecorDef => ({ type: 'column', at: [x, FLOOR_Y, z], size: [0.5, 3, 0], color: 0x7d8791 });
const duct = (x: number, z: number, yaw = 0): DecorDef => ({ type: 'pipe', at: [x, FLOOR_Y, z], size: [5, 0.4, 0], yaw, color: 0xe6b422 });

/**
 * World 24: robot arms (SPEC v6 3.3). An arm goes round its drops in turn, on the
 * clock. A ball on its pad waits, and goes wherever the next trip goes: the lamp by
 * the pad says where that is, and how long until it leaves.
 */
export const ASSEMBLY_WORLD: WorldDef = {
  id: 'assembly',
  name: { en: 'Assembly Line', zh: '装配线' },
  theme: 'assembly',
  ruleCard: { en: 'The light shows where the arm goes next.', zh: '指示灯显示机械臂下一次送往哪里。' },
  ruleTag: { en: 'ARMS', zh: '机械臂' },
  holes: [
    // 1. Teaching: one arm, two platforms it can reach. One has the cup on it. The
    //    other has a bridge across to the first, and costs a stroke or two.
    {
      id: 'assembly-1',
      par: 3,
      tee: [0, 0, 6.5],
      goal: { type: 'cup', position: [-3, 0, -5.8], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-2.5, 2], max: [2.5, 8], surface: FLOOR },
        { type: 'floor', min: [-5, -7], max: [-1, -2], surface: FLOOR },
        { type: 'floor', min: [1, -7], max: [5, -2], surface: FLOOR },
        { type: 'floor', min: [-1, -5.5], max: [1, -4.5], surface: FLOOR },
        // Where the ball starts
        { type: 'wall', from: [-2.5, 8], to: [2.5, 8], surface: WALL },
        { type: 'wall', from: [-2.5, 2], to: [-2.5, 8], surface: WALL },
        { type: 'wall', from: [2.5, 8], to: [2.5, 2], surface: WALL },
        { type: 'wall', from: [-2.5, 2], to: [2.5, 2], surface: WALL },
        // The platform with the cup
        { type: 'wall', from: [-5, -7], to: [-1, -7], surface: WALL },
        { type: 'wall', from: [-5, -2], to: [-5, -7], surface: WALL },
        { type: 'wall', from: [-1, -2], to: [-5, -2], surface: WALL },
        ...wallWithDoors([-1, -7], [-1, -2], [[1.5, 2.5]], WALL),
        // The other one, and the bridge between them
        { type: 'wall', from: [1, -7], to: [5, -7], surface: WALL },
        { type: 'wall', from: [5, -7], to: [5, -2], surface: WALL },
        { type: 'wall', from: [5, -2], to: [1, -2], surface: WALL },
        ...wallWithDoors([1, -7], [1, -2], [[1.5, 2.5]], WALL),
        { type: 'wall', from: [-1, -5.5], to: [1, -5.5], surface: TRIM },
        { type: 'wall', from: [-1, -4.5], to: [1, -4.5], surface: TRIM },
      ],
      zones: [
        FALL,
        robotArm(
          [0, 0, 3.2],
          [0, 0, 0],
          [
            [3, 0, -3.2],
            [-3, 0, -3.2],
          ],
          4,
        ),
      ],
      decor: [pillar(-6, 5), pillar(6, 5), duct(-7, -1, 90), duct(7.5, -5, 90)],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: three drops and a long roll to the pad. One trip sets the ball
    //    down by the cup, one behind a wall on the same platform, and one back where
    //    it came from. The ball has to be on the pad before the right trip leaves.
    {
      id: 'assembly-2',
      par: 3,
      tee: [0, 0, 8.5],
      goal: { type: 'cup', position: [2.5, 0, -7], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        { type: 'floor', min: [-2, 0], max: [2, 10], surface: FLOOR },
        { type: 'floor', min: [-4, -8], max: [4, -3], surface: FLOOR },
        { type: 'wall', from: [-2, 10], to: [2, 10], surface: WALL },
        { type: 'wall', from: [-2, 0], to: [-2, 10], surface: WALL },
        { type: 'wall', from: [2, 10], to: [2, 0], surface: WALL },
        { type: 'wall', from: [-2, 0], to: [2, 0], surface: WALL },
        { type: 'wall', from: [-4, -8], to: [4, -8], surface: WALL },
        { type: 'wall', from: [4, -8], to: [4, -3], surface: WALL },
        { type: 'wall', from: [4, -3], to: [-4, -3], surface: WALL },
        { type: 'wall', from: [-4, -3], to: [-4, -8], surface: WALL },
        // The wall down the middle of the far platform, with a way round at its near end
        { type: 'wall', from: [0, -8], to: [0, -4.5], surface: TRIM },
      ],
      zones: [
        FALL,
        robotArm(
          [0, 0, 1],
          [0, 0, -1.5],
          [
            [1.2, 0, 3.5],
            [-2.5, 0, -6.5],
            [2.5, 0, -5],
          ],
          3,
        ),
      ],
      decor: [pillar(-5, 6), pillar(5, 3), duct(-7, -5, 90), duct(7, -6, 90)],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58 },
    },

    // 3. Challenge: two arms, and a belt between them that only runs one way. The
    //    first arm sets the ball on the belt or back at the start; the belt brings it
    //    to the second arm's platform; the second sets it down by the cup or sends it
    //    back across its own platform.
    {
      id: 'assembly-3',
      par: 4,
      tee: [0, 0, 11.5],
      goal: { type: 'cup', position: [1.5, 0, -11.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      pieces: [
        { type: 'floor', min: [-2, 8], max: [2, 13], surface: FLOOR },
        beltFloor([-1, 0], [1, 6]),
        { type: 'floor', min: [-3, -6], max: [3, 0], surface: FLOOR },
        { type: 'floor', min: [-2.5, -12.5], max: [2.5, -8], surface: FLOOR },
        // Where the ball starts
        { type: 'wall', from: [-2, 13], to: [2, 13], surface: WALL },
        { type: 'wall', from: [-2, 8], to: [-2, 13], surface: WALL },
        { type: 'wall', from: [2, 13], to: [2, 8], surface: WALL },
        { type: 'wall', from: [-2, 8], to: [2, 8], surface: WALL },
        // The belt
        { type: 'wall', from: [-1, 6], to: [-1, 0], surface: TRIM },
        { type: 'wall', from: [1, 0], to: [1, 6], surface: TRIM },
        { type: 'wall', from: [-1, 6], to: [1, 6], surface: TRIM },
        // The platform it leads to
        { type: 'wall', from: [-3, 0], to: [-1, 0], surface: WALL },
        { type: 'wall', from: [1, 0], to: [3, 0], surface: WALL },
        { type: 'wall', from: [-3, -6], to: [-3, 0], surface: WALL },
        { type: 'wall', from: [3, 0], to: [3, -6], surface: WALL },
        { type: 'wall', from: [-3, -6], to: [3, -6], surface: WALL },
        // The island with the cup
        { type: 'wall', from: [-2.5, -8], to: [2.5, -8], surface: WALL },
        { type: 'wall', from: [-2.5, -12.5], to: [-2.5, -8], surface: WALL },
        { type: 'wall', from: [2.5, -8], to: [2.5, -12.5], surface: WALL },
        { type: 'wall', from: [-2.5, -12.5], to: [2.5, -12.5], surface: WALL },
      ],
      field: { parts: [belt('belt', [-1, 0], [1, 6], [0, -1])] },
      zones: [
        FALL,
        robotArm(
          [0, 0, 9.2],
          [3.5, 0, 7],
          [
            [1.2, 0, 12.2],
            [0, 0, 5.2],
          ],
          4,
        ),
        robotArm(
          [1.8, 0, -4.6],
          [0, 0, -7],
          [
            [-2, 0, -4.6],
            [0, 0, -9.5],
          ],
          4,
        ),
      ],
      decor: [pillar(-5, 10), pillar(-4.5, 3), duct(6.5, 2, 90), duct(-6.5, -9, 90), pillar(6, -10)],
      outOfBounds: 'lastPosition',
      camera: { pitch: 58, maxDistance: 32 },
    },
  ],
};
