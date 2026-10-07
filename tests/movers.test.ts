import { beforeAll, describe, expect, it } from 'vitest';
import { verifyDeterminism } from '../src/game/replay';
import { RULES } from '../src/game/rules';
import { Session, type SessionEvent } from '../src/game/session';
import type { HoleDef, MoverDef, PieceDef } from '../src/level/schema';
import { DEFAULT_BALL } from '../src/physics/ball';
import { cycleValue, moverPose } from '../src/physics/movers';
import { boxHole, runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const r = DEFAULT_BALL.radius;
const speed = (metresPerSecond: number) => metresPerSecond / RULES.maxShotSpeed;

function lane(minZ: number, maxZ: number): PieceDef[] {
  return [
    { type: 'floor', min: [-2, minZ], max: [2, maxZ], surface: 'grass' },
    { type: 'wall', from: [-2, minZ], to: [-2, maxZ], surface: 'rail' },
    { type: 'wall', from: [2, minZ], to: [2, maxZ], surface: 'rail' },
    { type: 'wall', from: [-2, minZ], to: [2, minZ], surface: 'rail' },
    { type: 'wall', from: [-2, maxZ], to: [2, maxZ], surface: 'rail' },
  ];
}

describe('cycle timing', () => {
  it('goes out and back once per period, pausing where told to', () => {
    const cycle = { period: 4, hold: [0.25, 0.25] as const };
    expect(cycleValue(0, cycle)).toBe(0);
    expect(cycleValue(59, cycle)).toBe(0);
    expect(cycleValue(90, cycle)).toBeCloseTo(0.5, 5);
    expect(cycleValue(120, cycle)).toBe(1);
    expect(cycleValue(179, cycle)).toBe(1);
    expect(cycleValue(210, cycle)).toBeCloseTo(0.5, 5);
    expect(cycleValue(240, cycle)).toBe(0);
    expect(cycleValue(240 + 90, cycle)).toBe(cycleValue(90, cycle));
    expect(cycleValue(60, { period: 4, phase: 0.5 })).toBeCloseTo(0.5, 5);
  });

  it('swings a box around its pivot', () => {
    const def: MoverDef = {
      role: 'platform',
      size: [1, 0.2, 4],
      position: [0, 0, -2],
      surface: 'grass',
      motion: { type: 'swing', pivot: [0, 0], angle: 90, period: 2, hold: [0, 0] },
    };
    const far = moverPose(def, 60);
    expect(far.yaw).toBeCloseTo(Math.PI / 2, 6);
    expect(far.position.x).toBeCloseTo(-2, 6);
    expect(far.position.z).toBeCloseTo(0, 6);
  });
});

describe('pushers', () => {
  // A block that covers the left half of the lane, then slides to cover the right half.
  const gate: MoverDef = {
    role: 'pusher',
    size: [2, 0.6, 0.4],
    position: [-0.7, 0.3, -2],
    surface: 'rail',
    motion: { type: 'slide', offset: [1.4, 0, 0], period: 4, hold: [0.25, 0.25] },
  };
  const hole: HoleDef = { ...boxHole({ tee: [-1, 0, 3] }), pieces: lane(-8, 4), movers: [gate] };

  const shootAt = (tick: number): Session => {
    const session = new Session(hole);
    stepTicks(session, tick);
    session.shoot({ x: 0, y: 0, z: -1 }, speed(7));
    return session;
  };

  it('blocks the ball when closed and lets it through when open', () => {
    const closed = shootAt(0);
    let furthest = 3;
    while (closed.phase === 'rolling') {
      closed.step();
      furthest = Math.min(furthest, closed.ball.position().z);
    }
    expect(furthest).toBeGreaterThan(-1.8 - 0.01);
    expect(closed.stats.moverHits).toBeGreaterThan(0);

    const open = shootAt(120);
    runUntilSettled(open);
    expect(open.ball.position().z).toBeLessThan(-2.5);
    expect(open.stats.moverHits).toBe(0);
    closed.dispose();
    open.dispose();
  });

  it('makes the result depend on the release tick, reproducibly', () => {
    const a = shootAt(0);
    runUntilSettled(a);
    const b = shootAt(120);
    runUntilSettled(b);
    expect(a.ball.position().z).not.toBeCloseTo(b.ball.position().z, 1);
    for (const session of [a, b]) {
      const { identical, outcome } = verifyDeterminism(hole, session.shots, 5);
      const p = session.ball.position();
      expect(identical).toBe(true);
      expect(outcome.position).toStrictEqual([p.x, p.y, p.z]);
      session.dispose();
    }
  });

  it('shoves a resting ball aside without crushing or burying it', () => {
    const inPath: HoleDef = { ...hole, tee: [0.6, 0, -2] };
    const session = new Session(inPath);
    for (let i = 0; i < 480; i++) {
      session.step();
      const p = session.ball.position();
      const pose = session.movers[0].pose.position;
      const inside = Math.abs(p.x - pose.x) < 1 - 0.02 && Math.abs(p.z - pose.z) < 0.2 - 0.02;
      expect(inside).toBe(false);
      expect(Math.abs(p.y - r)).toBeLessThan(0.03);
      expect(Math.abs(p.x)).toBeLessThan(2);
    }
    expect(Math.hypot(session.ball.position().x - 0.6, session.ball.position().z + 2)).toBeGreaterThan(0.3);
    session.dispose();
  });

  it('moves a ball that stops in the sweep area to the nearest safe spot', () => {
    const swept: MoverDef = {
      ...gate,
      sweep: { kind: 'box', center: [0, 0.3, -2], halfExtents: [2, 0.5, 0.7] },
      rest: [
        [0, 0, 0],
        [0, 0, -4],
      ],
    };
    // Starts just short of the gate line and dies inside the sweep area.
    const session = new Session({ ...hole, tee: [1, 0, -1], movers: [swept] });
    stepTicks(session, 130);
    session.shoot({ x: 0, y: 0, z: -1 }, speed(1.5));
    runUntilSettled(session);
    const p = session.ball.position();
    expect([p.x, p.y, p.z]).toEqual([0, r, 0].map((v) => expect.closeTo(v, 5)));
    expect(session.phase).toBe('aiming');
    session.dispose();
  });
});

describe('platforms', () => {
  // Two decks 6 m apart, joined by a bridge that lines up, swings away, and comes back.
  const bridge: MoverDef = {
    role: 'platform',
    size: [1.6, 0.3, 6.6],
    position: [0, -0.144, -1],
    surface: 'grass',
    motion: { type: 'swing', pivot: [0, -1], angle: 60, period: 8, hold: [0.4, 0.2] },
    rest: [
      [0, 0, 3],
      [0, 0, -5],
    ],
  };
  const hole: HoleDef = {
    ...boxHole({ tee: [0.4, 0, 4] }),
    pieces: [
      { type: 'floor', min: [-2, 2], max: [2, 6], surface: 'grass' },
      { type: 'floor', min: [-2, -8], max: [2, -4], surface: 'grass' },
      { type: 'wall', from: [-2, -8], to: [2, -8], surface: 'rail' },
      { type: 'wall', from: [-2, 6], to: [2, 6], surface: 'rail' },
    ],
    movers: [bridge],
  };

  it('carries the ball across while lined up, without knocking it off line', () => {
    const session = new Session(hole);
    const angle = 0.03;
    session.shoot({ x: Math.sin(angle), y: 0, z: -Math.cos(angle) }, speed(9));
    while (session.phase === 'rolling' && session.ball.position().z > -6) {
      session.step();
      const p = session.ball.position();
      const v = session.ball.velocity();
      expect(p.y).toBeGreaterThan(r - 0.01);
      expect(p.y).toBeLessThan(r + 0.03);
      expect(Math.abs(Math.atan2(v.x, -v.z) - angle)).toBeLessThan(2e-3);
    }
    expect(session.ball.position().z).toBeLessThanOrEqual(-6);
    expect(session.strokes).toBe(1);
    session.dispose();
  });

  it('lets the ball roll back the other way just as cleanly', () => {
    const session = new Session({ ...hole, tee: [-0.3, 0, -6] });
    session.shoot({ x: 0, y: 0, z: 1 }, speed(9));
    let lowest = Infinity;
    while (session.phase === 'rolling' && session.ball.position().z < 4) {
      session.step();
      lowest = Math.min(lowest, session.ball.position().y);
      expect(Math.abs(session.ball.velocity().x)).toBeLessThan(0.02);
    }
    expect(lowest).toBeGreaterThan(r - 0.01);
    expect(session.ball.position().z).toBeGreaterThanOrEqual(4);
    session.dispose();
  });

  it('drops the ball when the bridge has swung away', () => {
    const session = new Session(hole);
    stepTicks(session, 300);
    session.shoot({ x: 0, y: 0, z: -1 }, speed(9));
    runUntilSettled(session);
    expect(session.stats.outOfBounds).toBe(1);
    expect(session.strokes).toBe(2);
    session.dispose();
  });

  it('never leaves the ball on the bridge', () => {
    const session = new Session(hole);
    session.shoot({ x: 0, y: 0, z: -1 }, speed(3.5));
    let onBridge = false;
    while (session.phase === 'rolling') {
      session.step();
      const z = session.ball.position().z;
      if (z < 1.9 && z > -3.9) onBridge = true;
    }
    expect(onBridge).toBe(true);
    const p = session.ball.position();
    expect([p.x, p.y, p.z]).toEqual([0, r, 3].map((v) => expect.closeTo(v, 5)));
    expect(session.stats.rests[0]).toEqual({ x: p.x, y: p.y, z: p.z });
    expect(session.stats.outOfBounds).toBe(0);
    session.dispose();
  });
});

describe('launcher', () => {
  const hole: HoleDef = {
    ...boxHole({ tee: [0, 0, 4] }),
    pieces: [{ type: 'floor', min: [-2, 0], max: [2, 6], surface: 'grass' }, ...lane(-20, -10)],
    zones: [
      ...boxHole().zones,
      {
        type: 'launcher',
        shape: { kind: 'sphere', center: [0, 0.15, 1], radius: 0.4 },
        params: { exit: [0, 1, 0.2], direction: [0, 0.6, -0.8], speed: 11, delay: 40 },
      },
    ],
  };

  it('swallows the ball, fires it across the gap and never calls it stopped in between', () => {
    const session = new Session(hole);
    const events: SessionEvent[] = [];
    session.on((e) => events.push(e));
    session.shoot({ x: 0, y: 0, z: -1 }, speed(4));
    let highest = 0;
    while (session.phase === 'rolling') {
      session.step();
      highest = Math.max(highest, session.ball.position().y);
    }
    const names = events.map((e) => (e.type === 'cue' ? e.name : e.type));
    expect(names.indexOf('launcherLoad')).toBeGreaterThan(0);
    expect(names.indexOf('launcherFire')).toBeGreaterThan(names.indexOf('launcherLoad'));
    expect(names.filter((n) => n === 'stopped')).toHaveLength(1);
    expect(names.indexOf('stopped')).toBeGreaterThan(names.indexOf('launcherFire'));
    expect(highest).toBeGreaterThan(2.5);
    const p = session.ball.position();
    expect(p.z).toBeLessThan(-10);
    expect(p.z).toBeGreaterThan(-20);
    expect(session.strokes).toBe(1);
    session.dispose();
  });
});
