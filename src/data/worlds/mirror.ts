import type { DecorDef, WorldDef } from '../../level/schema';
import { CUP, FALL } from './common';
import { wallWithDoors } from './ruins';

const FLOOR = 'parlour';
/** The ground on the far side of the glass: the same room in a colder light. */
const SHADE = 'parlourShade';
const WALL = 'wainscot';
const GLASS = 'glass';

const DEEP = -3.6;
const column = (x: number, z: number, height = 2.6): DecorDef => ({ type: 'column', at: [x, DEEP, z], size: [0.4, height, 0], color: 0x9c8468 });

/**
 * World 33: a mirror, and a shadow ball beyond it (SPEC v8 3.4). Every stroke sets
 * both balls off at once, the shadow the other way round. The two rooms are not built
 * alike, so the balls do not stay opposite each other. The shadow opens the doors;
 * only the ball can be holed.
 */
export const MIRROR_WORLD: WorldDef = {
  id: 'mirror',
  name: { en: 'Mirror Maze', zh: '镜像迷宫' },
  theme: 'looking',
  ruleCard: {
    en: 'Your shadow opens the doors. You take the shot home.',
    zh: '影子开门，你来进洞。',
  },
  ruleTag: { en: 'SHADOW BALL', zh: '影子球' },
  holes: [
    // 1. Teaching: two rooms all but alike. The shadow's has a plate where yours has a
    //    shut door: a stroke up the room rolls the shadow over it.
    {
      id: 'mirror-1',
      par: 3,
      tee: [-3, 0, 5.5],
      goal: { type: 'cup', position: [-4.5, 0, -4.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      mirror: { axis: 'x', at: 0, span: [-7, 7] },
      pieces: [
        { type: 'floor', min: [-6, -7], max: [0, 7], surface: FLOOR },
        { type: 'floor', min: [0, -7], max: [6, 7], surface: SHADE },
        { type: 'wall', from: [0, -7], to: [0, 7], height: 0.6, surface: GLASS },
        { type: 'wall', from: [-6, 7], to: [6, 7], surface: WALL },
        { type: 'wall', from: [6, 7], to: [6, -7], surface: WALL },
        { type: 'wall', from: [6, -7], to: [-6, -7], surface: WALL },
        { type: 'wall', from: [-6, -7], to: [-6, 7], surface: WALL },
        // Across each room, with a doorway: yours has a gate in it
        ...wallWithDoors([-6, 0], [0, 0], [[3.2, 4.4]], WALL, { height: 0.8 }),
        ...wallWithDoors([0, 0], [6, 0], [[1.6, 2.8]], WALL, { height: 0.8 }),
      ],
      field: {
        parts: [
          { kind: 'plate', id: 'plate', at: [2.6, 0, 2.8], mode: 'latch', radius: 0.6 },
          { kind: 'gate', id: 'gate', from: [-2.8, 0], to: [-1.6, 0], when: 'plate', via: [[2.6, 1], [-2.2, 1]] },
        ],
      },
      decor: [column(-8, -6), column(8, -6), column(-8, 5, 1.6), column(8, 5, 1.6)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 60, maxDistance: 32 },
    },

    // 2. Variation: the rooms are not alike. The shadow's plate is behind a wall with
    //    its only gap by the glass; your room has no such wall. Steer the shadow round,
    //    and see where the same strokes leave you.
    {
      id: 'mirror-2',
      par: 4,
      tee: [-3, 0, 5],
      goal: { type: 'cup', position: [-1.5, 0, -5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 3, text: { en: 'Finish in three strokes', zh: '三杆完成' } },
      mirror: { axis: 'x', at: 0, span: [-7, 7] },
      pieces: [
        { type: 'floor', min: [-6, -7], max: [0, 7], surface: FLOOR },
        { type: 'floor', min: [0, -7], max: [6, 7], surface: SHADE },
        { type: 'wall', from: [0, -7], to: [0, 7], height: 0.6, surface: GLASS },
        { type: 'wall', from: [-6, 7], to: [6, 7], surface: WALL },
        { type: 'wall', from: [6, 7], to: [6, -7], surface: WALL },
        { type: 'wall', from: [6, -7], to: [-6, -7], surface: WALL },
        { type: 'wall', from: [-6, -7], to: [-6, 7], surface: WALL },
        // Your room: a wall across it, with the gate
        ...wallWithDoors([-6, -2.5], [0, -2.5], [[2.4, 3.6]], WALL, { height: 0.8 }),
        // The shadow's: a wall across it, open only by the glass
        { type: 'wall', from: [1.8, 1], to: [6, 1], height: 0.8, surface: WALL },
      ],
      field: {
        parts: [
          { kind: 'plate', id: 'plate', at: [4.5, 0, -1.5], mode: 'latch', radius: 0.6 },
          { kind: 'gate', id: 'gate', from: [-3.6, -2.5], to: [-2.4, -2.5], when: 'plate', via: [[4.5, -3.2], [-3, -3.2]] },
        ],
      },
      decor: [column(-8, -6), column(8, -6), column(-8, 5, 1.6), column(8, 5, 1.6)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 60, maxDistance: 32 },
    },

    // 3. Challenge: this plate holds the gate only while the shadow stands on it, and
    //    the shadow goes wherever you do. The plate lies in a padded nook at the far
    //    end of the shadow's room: a stroke up the room presses the shadow into it and
    //    keeps it there. So the stroke that takes you through the gate has to be one
    //    that goes up the room.
    {
      id: 'mirror-3',
      par: 6,
      tee: [-3, 0, 5],
      goal: { type: 'cup', position: [-3, 0, -5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 4, text: { en: 'Finish in four strokes', zh: '四杆完成' } },
      mirror: { axis: 'x', at: 0, span: [-7, 7], shadow: [4.5, 0, 5] },
      pieces: [
        { type: 'floor', min: [-6, -7], max: [0, 7], surface: FLOOR },
        { type: 'floor', min: [0, -5.5], max: [6, 7], surface: SHADE },
        { type: 'floor', min: [0, -7], max: [0.5, -5.5], surface: SHADE },
        { type: 'floor', min: [0.5, -7], max: [2.5, -5.5], surface: 'carpet' },
        { type: 'floor', min: [2.5, -7], max: [6, -5.5], surface: SHADE },
        { type: 'wall', from: [0, -7], to: [0, 7], height: 0.6, surface: GLASS },
        { type: 'wall', from: [-6, 7], to: [6, 7], surface: WALL },
        { type: 'wall', from: [6, 7], to: [6, -7], surface: WALL },
        { type: 'wall', from: [-6, -7], to: [-6, 7], surface: WALL },
        { type: 'wall', from: [-6, -7], to: [0.9, -7], surface: WALL },
        { type: 'wall', from: [2.1, -7], to: [6, -7], surface: WALL },
        // The nook: soft on three sides
        { type: 'wall', from: [0.9, -7], to: [2.1, -7], surface: 'velvet' },
        { type: 'wall', from: [0.9, -7], to: [0.9, -5.8], height: 0.5, surface: 'velvet' },
        { type: 'wall', from: [2.1, -7], to: [2.1, -5.8], height: 0.5, surface: 'velvet' },
        // Your room: a wall across it, with the gate
        ...wallWithDoors([-6, -2], [0, -2], [[2.4, 3.6]], WALL, { height: 0.8 }),
        // The shadow's: a wall out from the glass, in the way of the straight road to the nook
        { type: 'wall', from: [0, 0], to: [3.5, 0], height: 0.8, surface: WALL },
      ],
      field: {
        parts: [
          { kind: 'plate', id: 'plate', at: [1.5, 0, -6.5], mode: 'hold', radius: 0.65 },
          { kind: 'gate', id: 'gate', from: [-3.6, -2], to: [-2.4, -2], when: 'plate', via: [[1.5, -4.5], [-3, -4.5]] },
        ],
      },
      decor: [column(-8, -6), column(8, -6), column(-8, 5, 1.6), column(8, 5, 1.6)],
      zones: [FALL],
      outOfBounds: 'lastPosition',
      camera: { pitch: 60, maxDistance: 32 },
    },
  ],
};
