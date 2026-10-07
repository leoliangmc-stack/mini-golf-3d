import { beforeAll, describe, expect, it } from 'vitest';
import { verifyDeterminism } from '../src/game/replay';
import { RULES } from '../src/game/rules';
import { Session } from '../src/game/session';
import type { HoleDef, PieceDef } from '../src/level/schema';
import { DEFAULT_BALL } from '../src/physics/ball';
import type { ZoneDef } from '../src/physics/zones';
import { boxHole, runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const r = DEFAULT_BALL.radius;
const speed = (metresPerSecond: number) => metresPerSecond / RULES.maxShotSpeed;
const FALL = boxHole().zones[0];

/** A 10 x 20 m walled room. */
function room(extra: PieceDef[] = [], wall = 'rail'): PieceDef[] {
  return [
    { type: 'floor', min: [-5, -10], max: [5, 10], surface: 'grass' },
    { type: 'wall', from: [-5, -10], to: [5, -10], surface: wall },
    { type: 'wall', from: [5, -10], to: [5, 10], surface: wall },
    { type: 'wall', from: [5, 10], to: [-5, 10], surface: wall },
    { type: 'wall', from: [-5, 10], to: [-5, -10], surface: wall },
    ...extra,
  ];
}

const magnet = (strength: number, x = 2.5, z = 0): ZoneDef => ({
  type: 'magnet',
  shape: { kind: 'sphere', center: [x, 0, z], radius: 4 },
  params: { strength },
});

function hole(zones: ZoneDef[], tee: [number, number, number], extra: PieceDef[] = []): HoleDef {
  return { ...boxHole({ tee }), pieces: room(extra), zones: [FALL, ...zones] };
}

describe('magnets (SPEC 2.3, 5.2 #8)', () => {
  const drift = (strength: number): number => {
    const session = new Session(hole([magnet(strength)], [0, 0, 8]));
    session.shoot({ x: 0, y: 0, z: -1 }, speed(9));
    while (session.phase === 'rolling' && session.ball.position().z > -4) session.step();
    const x = session.ball.position().x;
    session.dispose();
    return x;
  };

  it('pulls the ball toward a red magnet and pushes it away from a blue one', () => {
    expect(drift(12)).toBeGreaterThan(0.25);
    expect(drift(-12)).toBeLessThan(-0.25);
    expect(Math.abs(drift(0.0001))).toBeLessThan(1e-3);
  });

  it('leaves a resting ball alone where the pull is weaker than rolling resistance', () => {
    const session = new Session(hole([magnet(12)], [-1.2, 0, 0]));
    stepTicks(session, 300);
    const p = session.ball.position();
    expect(Math.hypot(p.x + 1.2, p.z)).toBeLessThan(1e-3);
    session.dispose();
  });

  it('never pins or rattles the ball: it settles against the magnet and can be hit away', () => {
    const pillar: PieceDef = { type: 'pillar', at: [2.5, 0], radius: 0.35, surface: 'rail' };
    const session = new Session(hole([magnet(12)], [2.5, 0, 6], [pillar]));
    session.shoot({ x: 0, y: 0, z: -1 }, speed(6));
    const ticks = runUntilSettled(session);
    expect(session.phase).toBe('aiming');
    expect(ticks).toBeLessThan(600);
    const stuck = session.ball.position();
    expect(Math.hypot(stuck.x - 2.5, stuck.z)).toBeGreaterThan(0.35 + r - 0.01);
    expect(Math.abs(stuck.y - r)).toBeLessThan(0.02);

    // Straight away from the magnet: a firm stroke carries it out of the field.
    session.shoot({ x: stuck.x - 2.5, y: 0, z: stuck.z }, speed(9));
    let furthest = 0;
    while (session.phase === 'rolling') {
      session.step();
      const p = session.ball.position();
      furthest = Math.max(furthest, Math.hypot(p.x - 2.5, p.z));
    }
    expect(furthest).toBeGreaterThan(4);
    session.dispose();
  });

  it('stays deterministic inside a field', () => {
    const def = hole([magnet(12), magnet(-10, -2.5, -5)], [0, 0, 8]);
    const session = new Session(def);
    stepTicks(session, 13);
    session.shoot({ x: 0.1, y: 0, z: -1 }, speed(10));
    runUntilSettled(session);
    expect(verifyDeterminism(def, session.shots, 5).identical).toBe(true);
    session.dispose();
  });
});

describe('gravity zones (SPEC 2.3, 5.2 #8)', () => {
  const sideways: ZoneDef = {
    type: 'gravity',
    shape: { kind: 'box', center: [0, 1, 0], halfExtents: [5, 2, 3] },
    params: { gravity: [5, -8.4, 0] },
  };

  it('pulls the ball sideways inside the zone and lets go outside it', () => {
    const session = new Session(hole([sideways], [0, 0, 8]));
    session.shoot({ x: 0, y: 0, z: -1 }, speed(14));
    let insideUp = 1;
    while (session.phase === 'rolling' && session.ball.position().z > -3.2) {
      session.step();
      if (Math.abs(session.ball.position().z) < 2.5) insideUp = session.world.up.y;
    }
    expect(insideUp).toBeLessThan(0.9);
    expect(session.ball.position().x).toBeGreaterThan(0.8);
    stepTicks(session, 5);
    expect(session.world.up).toEqual({ x: 0, y: 1, z: 0 });
    // It never left the floor.
    expect(Math.abs(session.ball.position().y - r)).toBeLessThan(0.03);
    session.dispose();
  });

  it('lets the ball come to rest against a wall without rattling', () => {
    // The ball "falls" onto this wall, so it wants a soft one, like the padded rails of world 6.
    const soft: HoleDef = { ...hole([sideways], [0, 0, 1]), pieces: room([], 'padded') };
    const session = new Session(soft);
    session.shoot({ x: 1, y: 0, z: 0 }, speed(3));
    const ticks = runUntilSettled(session);
    expect(session.phase).toBe('aiming');
    expect(ticks).toBeLessThan(300);
    const p = session.ball.position();
    expect(p.x).toBeGreaterThan(4.7);
    expect(Math.abs(p.y - r)).toBeLessThan(0.03);
    // And it can be played out again, against the pull.
    session.shoot({ x: -1, y: 0, z: -0.2 }, 1);
    runUntilSettled(session);
    expect(session.phase).toBe('aiming');
    session.dispose();
  });

  it('carries a jump further in low gravity', () => {
    const jump = (zones: ZoneDef[]): number => {
      const def: HoleDef = {
        ...boxHole({ tee: [0, 1, 8] }),
        pieces: [
          { type: 'floor', min: [-2, 4], max: [2, 10], y: 1, surface: 'grass' },
          { type: 'floor', min: [-2, -30], max: [2, 4], surface: 'sand' },
        ],
        zones: [FALL, ...zones],
      };
      const session = new Session(def);
      session.shoot({ x: 0, y: 0, z: -1 }, speed(8));
      runUntilSettled(session);
      const z = session.ball.position().z;
      session.dispose();
      return z;
    };
    const lowG: ZoneDef = {
      type: 'gravity',
      shape: { kind: 'box', center: [0, 2, -6], halfExtents: [3, 4, 10] },
      params: { gravity: [0, -2.5, 0] },
    };
    // Sand stops the ball where it lands, so the resting place is the landing place.
    const normal = jump([]);
    const floaty = jump([lowG]);
    expect(normal).toBeLessThan(3.5);
    expect(floaty).toBeLessThan(normal - 1.5);
  });
});
