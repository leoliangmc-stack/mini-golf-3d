import { describe, expect, it } from 'vitest';
import { RULES } from '../src/game/rules';
import { classifyPress, dragRoom, dragToPull, fullDragPx, INPUT, slopFor, TAP } from '../src/input/slingshot';

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

describe('the dead zone: a tap that wandered is not a stroke (SPEC v7 3.5)', () => {
  const dead = TAP.touchSlopPx;

  it('counts nothing for a drag within the slop', () => {
    expect(dragToPull(0, dead, 230, 400, dead).power).toBe(0);
    expect(dragToPull(0, 7, 230, 400, dead).power).toBe(0);
  });

  it('gives a drag just past the slop less than the weakest stroke there is', () => {
    const full = fullDragPx(844, 390);
    expect(dragToPull(0, dead + 1, full, 400, dead).power).toBeLessThan(RULES.minPower);
    expect(dragToPull(0, dead + 1, full, dead + 1, dead).power).toBeLessThan(RULES.minPower);
  });

  it('still reaches full power at the full length, and where the room ends', () => {
    expect(dragToPull(0, 230, 230, 400, dead).power).toBe(1);
    expect(dragToPull(0, 134, 230, 134, dead).power).toBeCloseTo(1);
    expect(dragToPull(0, 133, 230, 134, dead).power).toBeLessThan(1);
  });

  it('never loses power as the drag grows', () => {
    let last = 0;
    for (let length = 1; length <= 160; length++) {
      const power = dragToPull(0, length, 230, 134, dead).power;
      expect(power).toBeGreaterThanOrEqual(last);
      last = power;
    }
  });
});

describe('a tap and a drag are told apart with a slop that fits the pointer', () => {
  it('gives a finger more slop than a mouse', () => {
    expect(slopFor('touch')).toBeGreaterThan(slopFor('mouse'));
    expect(slopFor('pen')).toBe(slopFor('touch'));
  });

  it('reads a press that rolled a little under a thumb as a tap, and under a mouse as a drag', () => {
    const rolled = TAP.slopPx + 2;
    expect(classifyPress(rolled, 100, slopFor('mouse'))).toBe('drag');
    expect(classifyPress(rolled, 100, slopFor('touch'))).toBe('tap');
    expect(classifyPress(rolled, TAP.maxMs + 1, slopFor('touch'))).toBe('hold');
    expect(classifyPress(slopFor('touch') + 1, 100, slopFor('touch'))).toBe('drag');
  });
});

describe('full power is within reach', () => {
  // On a phone every pull starts with the finger's slop, which counts for nothing.
  const dead = TAP.touchSlopPx;
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
      expect(dragToPull(0, reach, full, dragRoom(x, y, 0, reach, width, height), dead).power).toBeCloseTo(1);
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
            if (room - dead < INPUT.minRoomFraction * (full - dead)) continue;
            const reach = Math.min(room, full);
            expect(dragToPull(dx * reach, dy * reach, full, room, dead).power).toBeCloseTo(1);
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
