import { describe, expect, it } from 'vitest';
import { dragRoom, dragToPull, fullDragPx, INPUT } from '../src/input/slingshot';

/** Landscape screens the game runs on, in CSS pixels. */
const SCREENS = [
  { name: 'iPad', width: 1024, height: 768 },
  { name: 'iPad Pro', width: 1366, height: 1024 },
  { name: 'phone', width: 844, height: 390 },
];

describe('dragRoom', () => {
  const margin = INPUT.edgeMarginPx;

  it('measures straight down to the edge margin', () => {
    expect(dragRoom(512, 614, 0, 1, 1024, 768)).toBeCloseTo(768 - margin - 614);
  });

  it('stops at whichever edge the drag reaches first', () => {
    // Down and to the left from near the left edge: the left edge comes first.
    expect(dragRoom(100, 600, -1, 1, 1024, 768)).toBeCloseTo((100 - margin) * Math.SQRT2);
  });

  it('ignores the edges behind the drag', () => {
    expect(dragRoom(512, 760, 0, -1, 1024, 768)).toBeCloseTo(760 - margin);
  });

  it('is zero when the press is already inside the margin', () => {
    expect(dragRoom(512, 760, 0, 1, 1024, 768)).toBe(0);
  });
});

describe('dragToPull', () => {
  it('keeps the plain linear power when there is room', () => {
    expect(dragToPull(0, 115, 230, 400)).toEqual({ x: 0, y: 1, power: 0.5 });
    expect(dragToPull(0, 115, 230)).toEqual({ x: 0, y: 1, power: 0.5 });
    expect(dragToPull(0, 500, 230, 400).power).toBe(1);
  });

  it('reaches full power where the room ends when room is short', () => {
    expect(dragToPull(0, 134, 230, 134).power).toBeCloseTo(1);
    expect(dragToPull(0, 133, 230, 134).power).toBeLessThan(1);
  });

  it('leaves gentle pulls almost untouched when room is short', () => {
    const power = dragToPull(0, 23, 230, 134).power;
    expect(power).toBeGreaterThanOrEqual(0.1);
    expect(power).toBeLessThan(0.12);
  });

  it('never loses power as the drag grows', () => {
    let last = 0;
    for (let length = 1; length <= 160; length++) {
      const power = dragToPull(0, length, 230, 134).power;
      expect(power).toBeGreaterThanOrEqual(last);
      last = power;
    }
  });

  it('does not turn a sliver of room into a hair trigger', () => {
    expect(dragToPull(0, 5, 230, 5).power).toBeLessThan(0.1);
  });
});

describe('full power is within reach', () => {
  for (const { name, width, height } of SCREENS) {
    const full = fullDragPx(width, height);
    const margin = INPUT.edgeMarginPx;

    // The camera parks the ball about a fifth of the screen above the bottom edge, and a
    // pull toward the cup starts there and goes straight down.
    it(`pulling down from the ball, on ${name}`, () => {
      const x = width / 2;
      const y = height * 0.8;
      const reach = height - margin - y;
      expect(reach).toBeLessThan(full);
      expect(dragToPull(0, reach, full, dragRoom(x, y, 0, reach, width, height)).power).toBeCloseTo(1);
    });

    it(`from any press point clear of the edges, in any direction, on ${name}`, () => {
      let checked = 0;
      for (let x = margin; x <= width - margin; x += (width - 2 * margin) / 16) {
        for (let y = margin; y <= height - margin; y += (height - 2 * margin) / 12) {
          for (let step = 0; step < 24; step++) {
            const angle = (step / 24) * Math.PI * 2;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            const room = dragRoom(x, y, dx, dy, width, height);
            // Closer to an edge than this, the hair-trigger floor wins over reaching full power.
            if (room < INPUT.minRoomFraction * full) continue;
            const reach = Math.min(room, full);
            expect(dragToPull(dx * reach, dy * reach, full, room).power).toBeCloseTo(1);
            // The finger is still on the glass, clear of the edge, when it gets there.
            const fx = x + dx * reach;
            const fy = y + dy * reach;
            expect(fx).toBeGreaterThanOrEqual(margin - 1e-6);
            expect(fx).toBeLessThanOrEqual(width - margin + 1e-6);
            expect(fy).toBeGreaterThanOrEqual(margin - 1e-6);
            expect(fy).toBeLessThanOrEqual(height - margin + 1e-6);
            checked++;
          }
        }
      }
      expect(checked).toBeGreaterThan(1000);
    });
  }
});
