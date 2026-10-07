import type { WorldDef } from '../../level/schema';

/**
 * M0 sandbox: an L-shaped flat hole. The floor is deliberately made of two pieces
 * and one wall has a gap, to exercise floor seams and out-of-bounds.
 */
export const TEST_WORLD: WorldDef = {
  id: 'test',
  name: { en: 'Test Range', zh: '测试场' },
  theme: 'meadow',
  ruleCard: { en: 'Nothing special here.', zh: '这里没有特殊规则。' },
  ruleTag: { en: 'SANDBOX', zh: '测试' },
  holes: [
    {
      id: 'test-1',
      par: 2,
      tee: [0, 0, 4.5],
      cup: { position: [4.5, 0, -4], radius: 0.22, captureSpeed: 3.5 },
      pieces: [
        { type: 'floor', min: [-2, -2], max: [2, 6], surface: 'grass' },
        { type: 'floor', min: [-2, -6], max: [6, -2], surface: 'grass' },
        { type: 'wall', from: [-2, 6], to: [2, 6], surface: 'rail' },
        { type: 'wall', from: [2, 6], to: [2, -2], surface: 'rail' },
        { type: 'wall', from: [2, -2], to: [6, -2], surface: 'rail' },
        { type: 'wall', from: [6, -2], to: [6, -6], surface: 'rail' },
        { type: 'wall', from: [6, -6], to: [-2, -6], surface: 'rail' },
        // Left rail stops short of the far corner: the gap is the way out of bounds.
        { type: 'wall', from: [-2, 6], to: [-2, -4], surface: 'rail' },
      ],
      zones: [{ type: 'outOfBounds', shape: { kind: 'box', center: [0, -7, 0], halfExtents: [60, 5, 60] } }],
      outOfBounds: 'lastPosition',
    },
  ],
};
