import type { PieceDef, WorldDef } from '../../level/schema';
import { growPad, shrinkPad } from '../../physics/zones/pads';
import { CUP, FALL, walledRoom } from './common';

/**
 * A wall across the course at `z` with a doorway in the middle, one crate wide, and a
 * crate standing in it. The doorway has sides, so the crate fits it like a cork: with a
 * plain gap in a wall, a fast ball can wedge itself between the crate and the wall end.
 */
function corkedDoor(z: number, minX: number, maxX: number): PieceDef[] {
  // Walls are 0.2 thick: these stand 0.02 clear of a crate one metre wide.
  const jamb = 0.62;
  return [
    { type: 'wall', from: [minX, z], to: [-jamb, z], surface: 'toyBlockRed' },
    { type: 'wall', from: [jamb, z], to: [maxX, z], surface: 'toyBlockRed' },
    { type: 'wall', from: [-jamb, z + 0.6], to: [-jamb, z - 0.6], surface: 'toyBlockRed' },
    { type: 'wall', from: [jamb, z + 0.6], to: [jamb, z - 0.6], surface: 'toyBlockRed' },
  ];
}

/**
 * World 11: the ball itself changes. Green pads make it one size bigger, purple pads one
 * size smaller, and a pad works every time the ball comes back to it. Small fits under
 * the low bars; large is the only size heavy enough to shove a crate; and a cup with a
 * coloured rim takes one size only.
 */
export const GROW_WORLD: WorldDef = {
  id: 'grow',
  name: { en: 'Growing Ball', zh: '成长球' },
  theme: 'playroom',
  ruleCard: {
    en: 'Green grows, purple shrinks. Match the hole size!',
    zh: '绿色变大，紫色变小，大小要和洞口一致！',
  },
  ruleTag: { en: 'SIZE', zh: '大小' },
  holes: [
    // 1. Teaching: a low bar crosses the lane and only the small ball rolls under it.
    //    The purple pad sits in a gate just before it, so the way in goes over the pad.
    {
      id: 'grow-1',
      par: 2,
      tee: [0, 0, 6.5],
      goal: { type: 'cup', position: [0, 0, -5.5], ...CUP },
      challenge: { type: 'maxStrokes', strokes: 1, text: { en: 'Hole in one', zh: '一杆进洞' } },
      pieces: [
        ...walledRoom([-2, -8], [2, 8], 'playmat', 'toyBlock'),
        // The gate around the pad
        { type: 'wall', from: [-2, 3.5], to: [-1, 3.5], surface: 'toyBlockRed' },
        { type: 'wall', from: [1, 3.5], to: [2, 3.5], surface: 'toyBlockRed' },
        // The bar
        { type: 'beam', from: [-2, 0], to: [2, 0], clearance: 0.16, surface: 'toyBlockRed' },
      ],
      zones: [FALL, shrinkPad([0, 0, 3.5], 0.9), growPad([-1.2, 0, -3])],
      outOfBounds: 'lastPosition',
    },

    // 2. Variation: a crate plugs the doorway. Grow to ram it through, then shrink twice
    //    on the far side: the cup there takes the small ball only. The two purple pads
    //    and the cup lie on one line from the doorway.
    {
      id: 'grow-2',
      par: 3,
      tee: [0, 0, 7.5],
      goal: { type: 'cup', position: [2.4, 0, -5.5], ...CUP, acceptSize: 'small' },
      challenge: { type: 'maxStrokes', strokes: 2, text: { en: 'Finish in two strokes', zh: '两杆完成' } },
      pieces: [
        // The first room: three walls, the fourth being the one with the doorway
        { type: 'floor', min: [-1.5, 2], max: [1.5, 9], surface: 'playmat' },
        { type: 'wall', from: [-1.5, 9], to: [1.5, 9], surface: 'toyBlock' },
        { type: 'wall', from: [1.5, 9], to: [1.5, 2], surface: 'toyBlock' },
        { type: 'wall', from: [-1.5, 2], to: [-1.5, 9], surface: 'toyBlock' },
        // The second room
        { type: 'floor', min: [-3, -8], max: [3.5, 2], surface: 'playmat' },
        { type: 'wall', from: [3.5, 2], to: [3.5, -8], surface: 'toyBlock' },
        { type: 'wall', from: [3.5, -8], to: [-3, -8], surface: 'toyBlock' },
        { type: 'wall', from: [-3, -8], to: [-3, 2], surface: 'toyBlock' },
        // The wall between the rooms, with the doorway in it
        ...corkedDoor(2, -3, 3.5),
      ],
      crates: [{ size: [1, 0.5, 0.6], at: [0, 0, 2], mass: 4, surface: 'crate' }],
      zones: [FALL, growPad([0, 0, 5], 0.9), shrinkPad([0.8, 0, -0.5], 0.6), shrinkPad([1.6, 0, -3], 0.6)],
      outOfBounds: 'lastPosition',
    },

    // 3. Challenge: three rooms in a row, each asking for a different size. Small to get
    //    under the bar, large to clear the crate out of the doorway, medium for the cup.
    {
      id: 'grow-3',
      par: 5,
      tee: [0, 0, 8],
      goal: { type: 'cup', position: [1.2, 0, -6.8], ...CUP, acceptSize: 'medium' },
      challenge: { type: 'maxStrokes', strokes: 4, text: { en: 'Finish in four strokes', zh: '四杆完成' } },
      pieces: [
        ...walledRoom([-2, -8], [2, 9], 'playmat', 'toyBlock'),
        // First room to second: the bar
        { type: 'beam', from: [-2, 4], to: [2, 4], clearance: 0.16, surface: 'toyBlockRed' },
        // Second room to third: a wall with a doorway
        ...corkedDoor(-2, -2, 2),
      ],
      crates: [{ size: [1, 0.5, 0.6], at: [0, 0, -2], mass: 4, surface: 'crate' }],
      zones: [
        FALL,
        shrinkPad([0, 0, 6], 0.7),
        growPad([-0.9, 0, 2.2], 0.6),
        growPad([0.9, 0, 0.4], 0.6),
        shrinkPad([1, 0, -4.2], 0.6),
      ],
      outOfBounds: 'lastPosition',
    },
  ],
};
