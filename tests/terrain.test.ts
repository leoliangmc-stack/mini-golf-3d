import { beforeAll, describe, expect, it } from 'vitest';
import { Session } from '../src/game/session';
import { compileHole } from '../src/level/compile';
import type { HoleDef, PieceDef } from '../src/level/schema';
import { DEFAULT_BALL } from '../src/physics/ball';
import { boxHole, runUntilSettled, setupEngine } from './helpers';

beforeAll(setupEngine);

const r = DEFAULT_BALL.radius;

/** Snow pad, then a ramp of `rampSurface` up to a snow platform at y = 1, railed all the way. */
function rampHole(rampSurface: string): HoleDef {
  const rails = (z0: number, z1: number, y: number | [number, number]): PieceDef[] => [
    { type: 'wall', from: [-2, z0], to: [-2, z1], y, surface: 'rail' },
    { type: 'wall', from: [2, z0], to: [2, z1], y, surface: 'rail' },
  ];
  return {
    ...boxHole({ tee: [0, 0, 2] }),
    pieces: [
      { type: 'floor', min: [-2, 0], max: [2, 4], surface: 'snow' },
      { type: 'ramp', min: [-2, -6], max: [2, 0], along: 'z', yFrom: 1, yTo: 0, surface: rampSurface },
      { type: 'floor', min: [-2, -10], max: [2, -6], y: 1, surface: 'snow' },
      { type: 'wall', from: [-2, 4], to: [2, 4], surface: 'rail' },
      { type: 'wall', from: [-2, -10], to: [2, -10], y: 1, height: 0.8, surface: 'rail' },
      ...rails(4, 0, 0),
      ...rails(0, -6, [0, 1]),
      ...rails(-6, -10, 1),
    ],
  };
}

describe('ramps', () => {
  it('lets a firm shot climb to the upper level and stop there', () => {
    const session = new Session(rampHole('ice'));
    session.shoot({ x: 0, y: 0, z: -1 }, 0.5);
    runUntilSettled(session);
    const p = session.ball.position();
    expect(session.phase).toBe('aiming');
    expect(p.z).toBeLessThan(-6);
    expect(p.y).toBeCloseTo(1 + r, 2);
    session.dispose();
  });

  it('slides a soft shot back down an ice ramp onto the pad', () => {
    const session = new Session(rampHole('ice'));
    session.shoot({ x: 0, y: 0, z: -1 }, 0.2);
    let highest = 0;
    while (session.phase === 'rolling') {
      session.step();
      highest = Math.max(highest, session.ball.position().y);
    }
    const p = session.ball.position();
    expect(highest).toBeGreaterThan(r + 0.1);
    expect(p.z).toBeGreaterThan(0);
    expect(p.y).toBeCloseTo(r, 2);
    session.dispose();
  });

  it('keeps a diagonal shot between sloped rails', () => {
    for (const x of [-0.6, 0.6]) {
      const session = new Session(rampHole('ice'));
      session.shoot({ x, y: 0, z: -1 }, 0.7);
      while (session.phase === 'rolling') {
        session.step();
        const p = session.ball.position();
        expect(Math.abs(p.x)).toBeLessThan(2);
        expect(p.y).toBeGreaterThan(0);
      }
      expect(session.strokes).toBe(1);
      session.dispose();
    }
  });
});

describe('solid ground', () => {
  it('stops a ball that runs into the side of a raised platform', () => {
    const hole: HoleDef = {
      ...boxHole({ tee: [0, 0, 2] }),
      pieces: [
        { type: 'floor', min: [-2, -2], max: [2, 4], surface: 'snow' },
        { type: 'floor', min: [-2, -6], max: [2, -2], y: 1, depth: 1.45, surface: 'snow' },
      ],
    };
    const session = new Session(hole);
    session.shoot({ x: 0, y: 0, z: -1 }, 1);
    for (let i = 0; i < 200 && session.phase === 'rolling'; i++) {
      session.step();
      const p = session.ball.position();
      // Never underneath or inside the platform.
      expect(p.y < 0.9 && p.z < -2).toBe(false);
    }
    session.dispose();
  });

  it('tells stacked ground layers apart by height', () => {
    const { ground } = compileHole({
      ...boxHole(),
      pieces: [
        { type: 'floor', min: [-2, -2], max: [2, 2], surface: 'snow' },
        { type: 'floor', min: [-1, -2], max: [1, 2], y: 1, surface: 'ice' },
        { type: 'ramp', min: [2, -2], max: [4, 2], along: 'x', yFrom: 0, yTo: 1, surface: 'grass' },
      ],
    });
    expect(ground!.surfaceAt({ x: 0.2, y: 0, z: 0.2 })).toBe('snow');
    expect(ground!.surfaceAt({ x: 0.2, y: 1, z: 0.2 })).toBe('ice');
    expect(ground!.surfaceAt({ x: 0.2, y: 0.5, z: 0.2 })).toBeNull();
    expect(ground!.surfaceAt({ x: 3, y: 0.5, z: 0 })).toBe('grass');
    expect(ground!.surfaceAt({ x: 9, y: 0, z: 0 })).toBeNull();
  });
});
