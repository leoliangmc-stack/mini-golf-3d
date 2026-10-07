import { beforeAll, describe, expect, it } from 'vitest';
import { CITY_WORLD } from '../src/data/worlds/city';
import { SKY_WORLD } from '../src/data/worlds/sky';
import { Session, type SessionEvent } from '../src/game/session';
import { DEFAULT_BALL } from '../src/physics/ball';
import { runUntilSettled, setupEngine } from './helpers';

beforeAll(setupEngine);

const r = DEFAULT_BALL.radius;
const [twoRoofs, threeRoofs, fourRoofs] = CITY_WORLD.holes;

describe('rooftops (SPEC v2 2.4)', () => {
  it('costs nothing to drop onto a lower roof: the ball lands and the next stroke is played from there', () => {
    const session = new Session(twoRoofs);
    const events: SessionEvent[] = [];
    session.on((e) => events.push(e));
    expect(session.ball.position().y).toBeCloseTo(4 + r, 2);
    // A little off line, so that it does not simply drop into the cup.
    session.shoot({ x: 0.3, y: 0, z: -1 }, 0.45);
    runUntilSettled(session);

    expect(session.phase).toBe('aiming');
    expect(session.strokes).toBe(1);
    expect(session.stats.outOfBounds).toBe(0);
    expect(events.some((e) => e.type === 'outOfBounds')).toBe(false);
    // Two metres down, at rest on the lower roof.
    const landed = { ...session.ball.position() };
    expect(landed.y).toBeCloseTo(2 + r, 2);
    expect(landed.z).toBeLessThan(1);
    // It came down hard enough to be heard as a landing.
    const landing = events.find((e) => e.type === 'bounce' && e.kind === 'ground');
    expect(landing && landing.type === 'bounce' && landing.speed).toBeGreaterThan(4);

    // The second stroke starts where the ball lies, not back up on the first roof.
    session.shoot({ x: -landed.x, y: 0, z: -6.5 - landed.z }, 0.2);
    expect(session.strokes).toBe(2);
    session.step();
    expect(session.ball.position().y).toBeLessThan(2.3);
    session.dispose();
  });

  it('is out of bounds only at street level', () => {
    // Off the open side of the top roof, hard: clean over the bottom roof and down to the street.
    const session = new Session(threeRoofs);
    const events: SessionEvent[] = [];
    session.on((e) => events.push(e));
    const tee = { ...session.ball.position() };
    session.shoot({ x: -1, y: 0, z: 0 }, 1);
    let lowest = Infinity;
    while (session.phase === 'rolling') {
      session.step();
      lowest = Math.min(lowest, session.ball.position().y);
    }
    // It passed the height of every roof on the way down without being called out early.
    expect(lowest).toBeLessThan(1);
    expect(lowest).toBeGreaterThan(0);
    expect(events.filter((e) => e.type === 'outOfBounds')).toHaveLength(1);
    expect(session.strokes).toBe(2);
    expect(session.stats.outOfBounds).toBe(1);
    // Default rule: back to where the stroke was played from.
    const back = session.ball.position();
    expect(Math.hypot(back.x - tee.x, back.y - tee.y, back.z - tee.z)).toBeLessThan(1e-3);
    session.dispose();
  });

  it('allows several drops in one stroke', () => {
    // Four buildings stepping down two metres at a time: one stroke can cross more than one alley.
    const session = new Session(fourRoofs);
    session.shoot({ x: 0.374606593415912, y: 0, z: -0.9271838545667874 }, 0.48);
    runUntilSettled(session);
    expect(session.stats.outOfBounds).toBe(0);
    expect(session.strokes).toBe(1);
    expect(session.ball.position().y).toBeLessThan(6);
    session.dispose();
  });

  it('differs from Sky Island, where the same kind of fall is a penalty', () => {
    const session = new Session(SKY_WORLD.holes[0]);
    session.shoot({ x: 1, y: 0, z: 0 }, 0.5);
    runUntilSettled(session);
    expect(session.stats.outOfBounds).toBe(1);
    expect(session.strokes).toBe(2);
    session.dispose();
  });
});
