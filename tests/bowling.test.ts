import { beforeAll, describe, expect, it } from 'vitest';
import { goalAnchor, goalCups, goalPins } from '../src/game/goal';
import { checkReplay, recordReplay } from '../src/game/replay';
import { Session, type SessionEvent } from '../src/game/session';
import type { GoalDef, HoleDef, PinDef } from '../src/level/schema';
import { PIN } from '../src/physics/props';
import { growPad, splitPad } from '../src/physics/zones/pads';
import { boxHole, runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const FALL = boxHole().zones[0];
const CUP = { radius: 0.22, captureSpeed: 3.5 };

/** Pins in the classic triangle, its point toward +Z (toward the tee). */
function triangle(x: number, z: number, rows: number, gap = 0.3): PinDef[] {
  const pins: PinDef[] = [];
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i <= row; i++) pins.push({ at: [x + (i - row / 2) * gap, 0, z - row * gap * 0.866] });
  }
  return pins;
}

const alley = (goal: GoalDef, extra: Partial<HoleDef> = {}): HoleDef => ({
  ...boxHole({ tee: [0, 0, 5] }),
  goal,
  pieces: [
    { type: 'floor', min: [-2, -10], max: [2, 7], surface: 'lane' },
    { type: 'wall', from: [-2, 7], to: [2, 7], surface: 'gutter' },
    { type: 'wall', from: [2, 7], to: [2, -10], surface: 'gutter' },
    { type: 'wall', from: [2, -10], to: [-2, -10], surface: 'gutter' },
    { type: 'wall', from: [-2, -10], to: [-2, 7], surface: 'gutter' },
  ],
  ...extra,
});

function bowl(session: Session, power: number, x = 0): SessionEvent[] {
  const events: SessionEvent[] = [];
  const off = session.on((event) => events.push(event));
  stepTicks(session, 10);
  expect(session.shoot({ x, y: 0, z: -1 }, power)).toBe(true);
  runUntilSettled(session);
  off();
  return events;
}

describe('golf bowling (SPEC v3 2.5)', () => {
  it('has no cup: the goal is the pins', () => {
    const goal: GoalDef = { type: 'knockdown', pins: triangle(0, -6, 4) };
    expect(goalCups(goal)).toEqual([]);
    expect(goalPins(goal)).toHaveLength(10);
    expect(goalAnchor(goal).z).toBeCloseTo(-6 - 0.3 * 0.866 * 2, 6);
    const session = new Session(alley(goal));
    expect(session.goal.cups).toHaveLength(0);
    expect(session.goal.pinsLeft).toBe(10);
    session.dispose();
  });

  it('pins stand still until something hits them', () => {
    const session = new Session(alley({ type: 'knockdown', pins: triangle(0, -6, 4) }));
    stepTicks(session, 600);
    expect(session.goal.pinsLeft).toBe(10);
    for (const pin of session.goal.pins) {
      const p = pin.pose.position;
      expect(Math.hypot(p.x - pin.def.at[0], p.z - pin.def.at[2])).toBeLessThan(0.002);
      expect(p.y).toBeCloseTo(pin.def.at[1] + PIN.height / 2, 2);
      expect(pin.quiet()).toBe(true);
    }
    session.dispose();
  });

  it('a ball that falls short knocks nothing down, and the hole goes on', () => {
    const session = new Session(alley({ type: 'knockdown', pins: triangle(0, -6, 4) }));
    bowl(session, 0.2);
    expect(session.goal.pinsLeft).toBe(10);
    expect(session.phase).toBe('aiming');
    expect(session.strokes).toBe(1);
    session.dispose();
  });

  it('finishes the hole on the stroke that takes the last pin down', () => {
    const session = new Session(alley({ type: 'knockdown', pins: triangle(0, -6, 3) }));
    const events = bowl(session, 0.7, 0.004);
    expect(events.filter((event) => event.type === 'pinDown')).toHaveLength(6);
    expect(events.filter((event) => event.type === 'pinDown').at(-1)).toMatchObject({ left: 0 });
    expect(events).toContainEqual({ type: 'cue', name: 'strike' });
    expect(session.outcome).toMatchObject({ holed: true, strokes: 1 });
    expect(session.stats.cues.pinDown).toBe(6);
    session.dispose();
  });

  it('clears fallen pins after the stroke and leaves the rest where they were knocked to', () => {
    const session = new Session(alley({ type: 'knockdown', pins: triangle(0, -6, 4) }, { par: 3 }));
    // Dead centre and fast: some go down, some are left.
    bowl(session, 1);
    const pins = session.goal.pins;
    const down = pins.filter((pin) => pin.down);
    const standing = pins.filter((pin) => !pin.down);
    expect(down.length).toBeGreaterThan(0);
    expect(standing.length).toBeGreaterThan(0);
    expect(session.phase).toBe('aiming');
    for (const pin of down) expect(pin.body.isEnabled()).toBe(false);
    for (const pin of standing) {
      expect(pin.body.isEnabled()).toBe(true);
      // Still upright, wherever it now is.
      expect(pin.toppled(0.5)).toBe(false);
    }
    const where = standing.map((pin) => ({ ...pin.pose.position }));
    stepTicks(session, 120);
    standing.forEach((pin, i) => {
      expect(pin.pose.position.x).toBeCloseTo(where[i].x, 3);
      expect(pin.pose.position.z).toBeCloseTo(where[i].z, 3);
    });
    session.dispose();
  });

  it('counts a pin as down as soon as it leans past the threshold, before it lies still', () => {
    const session = new Session(alley({ type: 'knockdown', pins: [{ at: [0, 0, -2] }], tiltThreshold: 60 }));
    stepTicks(session, 10);
    session.shoot({ x: 0, y: 0, z: -1 }, 0.5);
    let leanWhenCounted = -1;
    session.on((event) => {
      if (event.type !== 'pinDown') return;
      const { x, z } = session.goal.pins[0].body.rotation();
      leanWhenCounted = 1 - 2 * (x * x + z * z);
      expect(session.goal.pins[0].quiet()).toBe(false);
    });
    runUntilSettled(session);
    // cos(60 degrees) = 0.5: it was past that, and nowhere near flat.
    expect(leanWhenCounted).toBeLessThan(0.5);
    expect(leanWhenCounted).toBeGreaterThan(0.2);
    expect(session.outcome?.holed).toBe(true);
    session.dispose();
  });

  it('a pin knocked off the course counts as down', () => {
    // No back wall: the pin is driven off the end of the lane.
    const hole: HoleDef = {
      ...alley({ type: 'knockdown', pins: [{ at: [0, 0, -9.7] }], tiltThreshold: 89 }),
      pieces: [{ type: 'floor', min: [-2, -10], max: [2, 7], surface: 'lane' }],
    };
    const session = new Session(hole);
    bowl(session, 0.9);
    expect(session.goal.pinsLeft).toBe(0);
    session.dispose();
  });

  it('any ball can knock pins down, and a large one ploughs through (SPEC v3 2.7)', () => {
    /** Pins knocked down in the left-hand group and in the right-hand one. */
    const down = (zones: HoleDef['zones'], maxBalls = 1) => {
      const hole = alley(
        { type: 'knockdown', pins: [...triangle(-0.9, -3, 3), ...triangle(0.9, -3, 3)] },
        { zones: [FALL, ...zones], maxBalls, par: 4 },
      );
      const session = new Session(hole);
      bowl(session, 0.75);
      const fallen = session.goal.pins.map((pin) => pin.down);
      session.dispose();
      return [fallen.slice(0, 6).filter(Boolean).length, fallen.slice(6).filter(Boolean).length];
    };
    // Straight down the middle misses both groups; split, each half takes one on.
    expect(down([])).toEqual([0, 0]);
    const split = down([splitPad([0, 0, 3.6], 8)], 2);
    expect(split[0]).toBeGreaterThan(0);
    expect(split[1]).toBeGreaterThan(0);
    const large = down([growPad([0, 0, 4.4]), splitPad([0, 0, 3.6], 8)], 2);
    expect(large[0] + large[1]).toBeGreaterThanOrEqual(split[0] + split[1]);
  });

  it('scores like any other hole: strokes against par', () => {
    const hole = alley({ type: 'knockdown', pins: triangle(0, -6, 3) }, { par: 2 });
    const session = new Session(hole);
    bowl(session, 0.7, 0.004);
    expect(session.outcome).toMatchObject({ holed: true, strokes: 1, stars: 3 });
    session.dispose();

    const limit = new Session(hole);
    for (let i = 0; i < 4; i++) bowl(limit, 0.1);
    expect(limit.outcome).toMatchObject({ holed: false, strokes: 4, stars: 1 });
    limit.dispose();
  });

  it('plays back exactly, pins and all', () => {
    const hole = alley({ type: 'knockdown', pins: triangle(0, -6, 4) }, { par: 4 });
    const session = new Session(hole);
    bowl(session, 1);
    for (let i = 0; i < 6 && session.phase === 'aiming'; i++) {
      const next = session.goal.pins.find((pin) => !pin.down)!.pose.position;
      const p = session.ball.position();
      stepTicks(session, 12);
      session.shoot({ x: next.x - p.x, y: 0, z: next.z - p.z }, 0.6);
      runUntilSettled(session);
    }
    const file = recordReplay(hole, session.inputs);
    expect(file).not.toBeNull();
    expect(checkReplay(hole, file!)).toMatchObject({ ok: true, exact: true });
    session.dispose();
  });
});

describe('sequence goals (SPEC v3 2.6)', () => {
  const steps: GoalDef = {
    type: 'sequence',
    steps: [
      { type: 'knockdown', pins: triangle(0, 1, 2) },
      // Off to one side, so the stroke that takes the pins down does not roll on into it.
      { type: 'cup', position: [1.4, 0, -4], ...CUP },
    ],
  };

  it('the cup is not there until the pins are down', () => {
    const session = new Session(alley({ type: 'knockdown', pins: [] }, { goal: steps, par: 3 }));
    expect(session.goal.cups[0].active).toBe(false);
    expect(session.goal.focus().z).toBeGreaterThan(0);
    // Rolled gently round the pins and over the spot where the cup will be: nothing happens.
    stepTicks(session, 10);
    session.shoot({ x: 0.25, y: 0, z: -1 }, 0.4);
    runUntilSettled(session);
    expect(session.goal.pinsLeft).toBe(3);
    expect(session.phase).toBe('aiming');
    expect(session.outcome).toBeNull();
    session.dispose();
  });

  it('appears when the last pin goes down, and sinking the ball then finishes the hole', () => {
    const hole = alley({ type: 'knockdown', pins: [] }, { goal: steps, par: 3, strokeLimit: 30 });
    const session = new Session(hole);
    const events: SessionEvent[] = [];
    session.on((event) => events.push(event));
    for (let i = 0; i < 5 && session.goal.pinsLeft > 0 && session.phase === 'aiming'; i++) {
      const next = session.goal.pins.find((pin) => !pin.down)!.pose.position;
      const p = session.ball.position();
      stepTicks(session, 12);
      session.shoot({ x: next.x - p.x, y: 0, z: next.z - p.z }, 0.5);
      runUntilSettled(session);
    }
    expect(session.goal.pinsLeft).toBe(0);
    expect(events).toContainEqual({ type: 'cupAppeared', cup: 0 });
    expect(session.goal.cups[0].active).toBe(true);
    // Knocking the pins down is not the end of it.
    expect(session.outcome).toBeNull();
    expect(session.goal.focus()).toEqual({ x: 1.4, y: 0, z: -4 });

    for (let i = 0; i < 20 && session.phase === 'aiming'; i++) {
      const p = session.ball.position();
      const reach = Math.hypot(1.4 - p.x, -4 - p.z);
      stepTicks(session, 12);
      // Gentle enough to drop in from anywhere near; each putt ends closer than the last.
      session.shoot({ x: 1.4 - p.x, y: 0, z: -4 - p.z }, Math.min(0.4, 0.08 + reach * 0.04));
      runUntilSettled(session);
    }
    expect(session.outcome?.holed).toBe(true);
    const file = recordReplay(hole, session.inputs)!;
    expect(checkReplay(hole, file)).toMatchObject({ ok: true, exact: true });
    session.dispose();
  });
});
