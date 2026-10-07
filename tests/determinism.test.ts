import { beforeAll, describe, expect, it } from 'vitest';
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
