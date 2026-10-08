import { beforeAll, describe, expect, it } from 'vitest';
import { cos, halfAngle, hypot, sin } from '../src/core/math';
import { TEST_WORLD } from '../src/data/worlds/test';
import { Session } from '../src/game/session';
import { runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const hole = TEST_WORLD.holes[0];
// Bounces off several rails before stopping.
const shot = { tick: 37, dir: { x: 0.31, y: 0, z: -0.95 }, power: 0.9 };

function play(session: Session): number[] {
  stepTicks(session, shot.tick);
  expect(session.shoot(shot.dir, shot.power)).toBe(true);
  runUntilSettled(session);
  expect(session.phase).toBe('aiming');
  const p = session.ball.position();
  const v = session.ball.velocity();
  return [p.x, p.y, p.z, v.x, v.y, v.z, session.world.tick];
}

describe('determinism (SPEC 5.2 #5)', () => {
  it('replays the same shot 10 times with bit-identical results', () => {
    const results: number[][] = [];
    for (let i = 0; i < 10; i++) {
      const session = new Session(hole);
      results.push(play(session));
      session.dispose();
    }
    for (const r of results) expect(r).toStrictEqual(results[0]);
  });

  it('gives the same result after retrying the hole', () => {
    const session = new Session(hole);
    const first = play(session);
    session.reset();
    expect(session.strokes).toBe(0);
    expect(play(session)).toStrictEqual(first);
    session.dispose();
  });

  it('depends on the release tick only through moving parts', () => {
    // No movers yet, so a later release must only shift the finishing tick.
    const a = new Session(hole);
    const first = play(a);
    const b = new Session(hole);
    stepTicks(b, 11);
    const second = play(b);
    expect(second.slice(0, 6)).toStrictEqual(first.slice(0, 6));
    expect(second[6]).toBe(first[6] + 11);
    a.dispose();
    b.dispose();
  });
});

describe('engine-independent math (SPEC v3 3)', () => {
  it('matches the built-in sine and cosine to the last few bits', () => {
    for (let i = -4000; i <= 4000; i++) {
      const x = i * 0.0137;
      expect(Math.abs(sin(x) - Math.sin(x))).toBeLessThan(4e-16);
      expect(Math.abs(cos(x) - Math.cos(x))).toBeLessThan(4e-16);
    }
  });

  it('is exact where a mover starts and turns around', () => {
    expect(sin(0)).toBe(0);
    expect(cos(0)).toBe(1);
    expect(cos(Math.PI)).toBe(-1);
    expect(sin(Math.PI / 2)).toBe(1);
    expect(hypot(3, 4)).toBe(5);
    expect(hypot(2, 3, 6)).toBe(7);
  });

  it('halves an angle without an arctangent', () => {
    for (let degrees = -179; degrees <= 180; degrees += 7) {
      const angle = (degrees * Math.PI) / 180;
      const half = halfAngle(Math.sin(angle), Math.cos(angle));
      expect(half.sin).toBeCloseTo(Math.sin(angle / 2), 12);
      expect(half.cos).toBeCloseTo(Math.cos(angle / 2), 12);
    }
  });

  // The functions below are "implementation-approximated" in the JavaScript standard:
  // engines may, and do, disagree in the last bit. One such bit in a wall's angle is
  // enough to end a replay somewhere else.
  it('is the only math the simulation uses', () => {
    const sources = import.meta.glob<string>('../src/{core,physics,game,level}/**/*.ts', {
      eager: true,
      query: '?raw',
      import: 'default',
    });
    const banned =
      /Math\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|hypot|pow|exp|expm1|log|log2|log10|log1p|cbrt|random)\b|Date\.now|performance\.now|[^*/]\*\*[^*/]/;
    // The frame loop reads the wall clock to decide how many fixed steps to run. No step reads it.
    const exempt = ['/core/loop.ts'];
    const offenders: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      if (exempt.some((name) => file.endsWith(name))) continue;
      // Comments are blanked rather than removed, so line numbers still match the file.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, '')).replace(/\/\/.*$/gm, '');
      code.split('\n').forEach((line, i) => {
        if (banned.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(Object.keys(sources).length).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });
});
