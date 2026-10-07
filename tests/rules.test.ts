import { beforeAll, describe, expect, it } from 'vitest';
import { Session, type SessionEvent } from '../src/game/session';
import { DEFAULT_BALL } from '../src/physics/ball';
import { getSurface, probeGround, registerSurface, SurfaceMap } from '../src/physics/surfaces';
import { RULES } from '../src/game/rules';
import { buildHolePhysics } from '../src/level/physicsBuilder';
import { compileHole } from '../src/level/compile';
import { PhysicsWorld } from '../src/physics/world';
import { Ball } from '../src/physics/ball';
import { boxHole, runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(async () => {
  await setupEngine();
  registerSurface('test-slick', { restitution: 0.2, rollingResistance: 0.05, drag: 0.05, color: 0 });
});

const cup = { position: [0, 0, -2] as const, radius: 0.22, captureSpeed: 3.5 };

describe('cup capture (SPEC 5.2 #6)', () => {
  it('holes a slow ball rolling over the cup', () => {
    const session = new Session(boxHole({ cup }));
    const events: SessionEvent[] = [];
    session.on((e) => events.push(e));
    // Launched below the capture speed, so the result does not depend on power tuning.
    session.shoot({ x: 0, y: 0, z: -1 }, 2.8 / RULES.maxShotSpeed);
    runUntilSettled(session);
    expect(session.phase).toBe('done');
    expect(session.outcome?.holed).toBe(true);
    expect(events.map((e) => e.type).slice(-2)).toEqual(['holed', 'finished']);
    expect(session.shoot({ x: 0, y: 0, z: -1 }, 0.5)).toBe(false);
    session.dispose();
  });

  it('lets a fast ball roll straight over the cup', () => {
    const session = new Session(boxHole({ cup }));
    session.shoot({ x: 0, y: 0, z: -1 }, 1);
    let passed = false;
    for (let i = 0; i < 30 && !passed; i++) {
      session.step();
      passed = session.ball.position().z < -2.3;
    }
    expect(passed).toBe(true);
    expect(session.phase).toBe('rolling');
    session.dispose();
  });
});

describe('stop detection (SPEC 5.2 #7)', () => {
  it('always comes to rest and allows the next stroke', () => {
    for (let deg = 0; deg < 360; deg += 30) {
      const a = (deg * Math.PI) / 180;
      const session = new Session(boxHole());
      session.shoot({ x: Math.sin(a), y: 0, z: -Math.cos(a) }, 1);
      const ticks = runUntilSettled(session);
      expect(session.phase).toBe('aiming');
      expect(ticks).toBeLessThan(1200);
      expect(session.ball.speed()).toBe(0);
      session.dispose();
    }
  });

  it('ignores drags too weak to be a stroke', () => {
    const session = new Session(boxHole());
    expect(session.shoot({ x: 0, y: 0, z: -1 }, 0.01)).toBe(false);
    expect(session.strokes).toBe(0);
    session.dispose();
  });
});

describe('out of bounds', () => {
  const open = (outOfBounds: 'lastPosition' | 'tee') => {
    const hole = boxHole({ outOfBounds });
    // Remove the far rail (z = -3) so a straight shot rolls off the edge.
    return { ...hole, pieces: hole.pieces.filter((p) => !(p.type === 'wall' && p.from[1] === -3 && p.to[1] === -3)) };
  };

  it('adds a stroke and returns the ball to where it was last struck', () => {
    const session = new Session(open('lastPosition'));
    session.shoot({ x: 1, y: 0, z: 0 }, 0.15);
    runUntilSettled(session);
    const from = { ...session.ball.position() };
    expect(from.x).toBeGreaterThan(0.5);
    session.shoot({ x: 0, y: 0, z: -1 }, 1);
    runUntilSettled(session);
    expect(session.phase).toBe('aiming');
    expect(session.strokes).toBe(3);
    const back = session.ball.position();
    expect(Math.hypot(back.x - from.x, back.z - from.z)).toBeLessThan(1e-6);
    session.dispose();
  });

  it('returns the ball to the tee when the hole says so', () => {
    const session = new Session(open('tee'));
    session.shoot({ x: 1, y: 0, z: 0 }, 0.15);
    runUntilSettled(session);
    session.shoot({ x: 0, y: 0, z: -1 }, 1);
    runUntilSettled(session);
    expect(session.strokes).toBe(3);
    const p = session.ball.position();
    expect(Math.hypot(p.x, p.z)).toBeLessThan(1e-6);
    session.dispose();
  });
});

describe('surfaces', () => {
  const floors = [
    { type: 'floor', min: [-3, -3], max: [0, 3], surface: 'grass' },
    { type: 'floor', min: [0, -3], max: [3, 3], surface: 'test-slick' },
  ] as const;

  it('finds the surface under the ball per floor piece within one mesh', () => {
    const world = new PhysicsWorld([0, -9.81, 0]);
    const map = new SurfaceMap();
    buildHolePhysics(compileHole(boxHole({}, [...floors])), world, map);
    const ball = new Ball(world, DEFAULT_BALL, [0, DEFAULT_BALL.radius, 0]);
    world.step();
    for (const [x, z, expected] of [
      [-2.75, 2.75, 'grass'],
      [-0.25, -2.75, 'grass'],
      [0.25, 0.25, 'test-slick'],
      [2.75, -2.75, 'test-slick'],
    ] as const) {
      ball.teleport({ x, y: DEFAULT_BALL.radius, z });
      const probe = probeGround(world, ball, map);
      expect(probe?.surfaceId).toBe(expected);
      expect(probe?.grounded).toBe(true);
    }
    world.free();
  });

  it('rolls exactly as far as the surface numbers say', () => {
    // Closed form for dv/dt = -drag*v - resistance. A mismatch means something other
    // than the Surface layer is slowing the ball (solver friction, spin limits, seams).
    const { rollingResistance: a, drag: k } = getSurface('grass');
    for (const power of [0.2, 0.5, 1]) {
      const v0 = power * RULES.maxShotSpeed;
      const expected = v0 / k - (a / (k * k)) * Math.log(1 + (k * v0) / a);
      const lane = { type: 'floor', min: [-3, -40], max: [3, 3], surface: 'grass' } as const;
      const session = new Session({ ...boxHole({ tee: [0, 0, 2] }), pieces: [lane] });
      session.shoot({ x: 0, y: 0, z: -1 }, power);
      runUntilSettled(session);
      const travelled = 2 - session.ball.position().z;
      expect(Math.abs(travelled - expected) / expected).toBeLessThan(0.03);
      session.dispose();
    }
  });

  it('lets the ball roll further on a slicker surface, with no engine changes', () => {
    const roll = (x: number): number => {
      const session = new Session(boxHole({ tee: [x, 0, 2.5] }, [...floors]));
      session.shoot({ x: 0, y: 0, z: -1 }, 0.25);
      stepTicks(session, 60);
      const travelled = 2.5 - session.ball.position().z;
      session.dispose();
      return travelled;
    };
    expect(roll(1.5)).toBeGreaterThan(roll(-1.5) * 1.2);
  });
});
