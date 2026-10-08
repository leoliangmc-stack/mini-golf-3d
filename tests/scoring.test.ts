import { beforeAll, describe, expect, it } from 'vitest';
import { challengeMet, emptyStats } from '../src/game/challenges';
import { RULES, starsFor } from '../src/game/rules';
import { Session, type SessionEvent } from '../src/game/session';
import type { ChallengeDef, HoleDef } from '../src/level/schema';
import { boxHole, runUntilSettled, setupEngine } from './helpers';

beforeAll(setupEngine);

const text = { en: '', zh: '' };
const cup = { position: [0, 0, -2] as const, radius: 0.22, captureSpeed: 3.5 };
/** Launch speed that drops straight into a cup 2 m away. */
const putt = 2.8 / RULES.maxShotSpeed;

function playOut(hole: HoleDef, shots: [x: number, z: number, power: number][]): Session {
  const session = new Session(hole);
  for (const [x, z, power] of shots) {
    session.shoot({ x, y: 0, z }, power);
    runUntilSettled(session);
  }
  return session;
}

describe('stars (SPEC 2.6)', () => {
  it('follows the cumulative rule', () => {
    expect(starsFor(false, 4, 2, false)).toBe(1);
    expect(starsFor(true, 3, 2, true)).toBe(1);
    expect(starsFor(true, 2, 2, false)).toBe(2);
    expect(starsFor(true, 2, 2, true)).toBe(3);
  });

  it('gives three stars for par with the challenge met', () => {
    const session = playOut(boxHole({ goal: { type: 'cup', ...cup }, challenge: { type: 'noWallHits', text } }), [[0, -1, putt]]);
    expect(session.outcome).toMatchObject({ holed: true, strokes: 1, stars: 3, challengeMet: true });
    expect(session.outcome!.ticks).toBeGreaterThan(0);
    session.dispose();
  });

  it('drops to two stars when the challenge is failed', () => {
    // First stroke taps the side rail and comes back, second one holes out: still par.
    const session = playOut(boxHole({ goal: { type: 'cup', ...cup }, challenge: { type: 'noWallHits', text } }), [
      [1, 0, 5 / RULES.maxShotSpeed],
    ]);
    const p = session.ball.position();
    expect(Math.hypot(p.x, p.z + 2)).toBeLessThan(2.7);
    session.shoot({ x: -p.x, y: 0, z: -2 - p.z }, 3.3 / RULES.maxShotSpeed);
    runUntilSettled(session);
    expect(session.stats.wallHits).toBeGreaterThan(0);
    expect(session.outcome).toMatchObject({ holed: true, strokes: 2, stars: 2, challengeMet: false });
    session.dispose();
  });
});

describe('stroke limit (SPEC 2.6)', () => {
  it('ends the hole with one star at twice the par', () => {
    const events: SessionEvent[] = [];
    const session = new Session(boxHole({ par: 1 }));
    session.on((e) => events.push(e));
    expect(session.strokeLimit).toBe(2);
    for (let i = 0; i < 2; i++) {
      expect(session.shoot({ x: 1, y: 0, z: 0 }, 0.1)).toBe(true);
      runUntilSettled(session);
    }
    expect(session.phase).toBe('done');
    expect(session.outcome).toMatchObject({ holed: false, strokes: 2, stars: 1 });
    expect(events.at(-1)?.type).toBe('finished');
    expect(session.shoot({ x: 1, y: 0, z: 0 }, 0.1)).toBe(false);
    session.dispose();
  });

  it('counts an out-of-bounds penalty toward the limit', () => {
    const hole = boxHole({ par: 1 });
    const open = { ...hole, pieces: hole.pieces.filter((p) => p.type !== 'wall') };
    const session = playOut(open, [[0, -1, 1]]);
    expect(session.stats.outOfBounds).toBe(1);
    expect(session.outcome).toMatchObject({ holed: false, strokes: 2, stars: 1 });
    session.dispose();
  });

  it('honours a per-hole limit', () => {
    expect(new Session(boxHole({ par: 2, strokeLimit: 7 })).strokeLimit).toBe(7);
  });
});

describe('challenges', () => {
  const check = (def: Omit<ChallengeDef, 'text'>, change: (s: ReturnType<typeof emptyStats>) => void) => {
    const stats = emptyStats();
    change(stats);
    return challengeMet({ ...def, text }, stats);
  };

  it('evaluates each built-in type', () => {
    expect(check({ type: 'noOutOfBounds' }, () => {})).toBe(true);
    expect(check({ type: 'noOutOfBounds' }, (s) => s.outOfBounds++)).toBe(false);
    expect(check({ type: 'avoidSurface', surface: 'ice' }, (s) => s.surfaces.add('snow'))).toBe(true);
    expect(check({ type: 'avoidSurface', surface: 'ice' }, (s) => s.surfaces.add('ice'))).toBe(false);
    expect(check({ type: 'maxStrokes', strokes: 2 }, (s) => (s.strokes = 2))).toBe(true);
    expect(check({ type: 'maxStrokes', strokes: 2 }, (s) => (s.strokes = 3))).toBe(false);
    const shape = { kind: 'box', center: [0, 0, -5], halfExtents: [1, 1, 1] } as const;
    expect(check({ type: 'firstStrokeInto', shape }, (s) => s.rests.push({ x: 0, y: 0.1, z: -5 }))).toBe(true);
    expect(check({ type: 'firstStrokeInto', shape }, (s) => s.rests.push({ x: 0, y: 0.1, z: 0 }))).toBe(false);
    expect(challengeMet(undefined, emptyStats())).toBe(true);
    expect(() => check({ type: 'nope' }, () => {})).toThrow(/Unknown challenge/);
  });

  it('records which surfaces the ball rolled on and where each stroke ended', () => {
    const floors = [
      { type: 'floor', min: [-3, -3], max: [3, 0], surface: 'ice' },
      { type: 'floor', min: [-3, 0], max: [3, 3], surface: 'snow' },
    ] as const;
    const session = playOut(boxHole({ tee: [0, 0, 2] }, [...floors]), [[1, 0, 0.1]]);
    expect([...session.stats.surfaces]).toEqual(['snow']);
    expect(session.stats.rests).toHaveLength(1);
    session.shoot({ x: 0, y: 0, z: -1 }, 0.3);
    runUntilSettled(session);
    expect(session.stats.surfaces.has('ice')).toBe(true);
    expect(session.stats.rests).toHaveLength(2);
    session.dispose();
  });
});

describe('pillars and bounces', () => {
  it('bounces off a pillar, reports it and counts a wall hit', () => {
    const hole = boxHole({ tee: [0, 0, 2] });
    const withPillar: HoleDef = {
      ...hole,
      pieces: [...hole.pieces, { type: 'pillar', at: [0, -1], radius: 0.5, surface: 'rail' }],
    };
    const session = new Session(withPillar);
    const bounces: SessionEvent[] = [];
    session.on((e) => e.type === 'bounce' && bounces.push(e));
    session.shoot({ x: 0, y: 0, z: -1 }, 0.4);
    let closest = Infinity;
    while (session.phase === 'rolling') {
      session.step();
      const p = session.ball.position();
      closest = Math.min(closest, Math.hypot(p.x, p.z + 1));
    }
    // Never inside the pillar, and it came straight back.
    expect(closest).toBeGreaterThan(0.5 + 0.1 - 0.01);
    expect(session.ball.position().z).toBeGreaterThan(-0.4);
    expect(session.stats.wallHits).toBeGreaterThanOrEqual(1);
    expect(bounces[0]).toMatchObject({ type: 'bounce', kind: 'wall' });
    expect((bounces[0] as { speed: number }).speed).toBeGreaterThan(3);
    session.dispose();
  });
});
