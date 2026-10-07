import { beforeAll, describe, expect, it } from 'vitest';
import { WORLDS } from '../src/data/worlds';
import { TEST_WORLD } from '../src/data/worlds/test';
import { verifyDeterminism } from '../src/game/replay';
import { Session } from '../src/game/session';
import { getTheme } from '../src/render/theme';
import { runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const holes = [...WORLDS, TEST_WORLD].flatMap((world) => world.holes.map((hole) => ({ world, hole })));

describe('world data', () => {
  it('has three holes per world, unique ids and a registered theme', () => {
    const ids = holes.map((h) => h.hole.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const world of WORLDS) {
      expect(world.holes).toHaveLength(3);
      expect(() => getTheme(world.theme)).not.toThrow();
    }
  });

  it.each(holes)('$hole.id is well formed', ({ hole }) => {
    const session = new Session(hole);
    const { ground } = session.compiled;
    expect(ground!.surfaceAt({ x: hole.cup.position[0], y: hole.cup.position[1], z: hole.cup.position[2] })).not.toBeNull();
    expect(hole.zones.some((zone) => zone.type === 'outOfBounds')).toBe(true);

    // The ball rests on the tee: it is on ground and does not drift or fall.
    const start = { ...session.ball.position() };
    stepTicks(session, 120);
    const p = session.ball.position();
    expect(Math.hypot(p.x - start.x, p.y - start.y, p.z - start.z)).toBeLessThan(0.01);
    expect(ground!.surfaceAt({ x: p.x, y: p.y - session.ball.props.radius, z: p.z })).not.toBeNull();
    expect(session.strokes).toBe(0);
    session.dispose();
  });
});

describe('replay', () => {
  it('reproduces a recorded round exactly, through the same API the dev panel uses', () => {
    const hole = WORLDS[0].holes[1];
    const session = new Session(hole);
    stepTicks(session, 20);
    session.shoot({ x: 0.05, y: 0, z: -1 }, 0.62);
    runUntilSettled(session);
    stepTicks(session, 45);
    session.shoot({ x: 1, y: 0, z: -0.2 }, 0.3);
    runUntilSettled(session);
    const p = session.ball.position();

    const { identical, outcome } = verifyDeterminism(hole, session.shots, 10);
    expect(identical).toBe(true);
    expect(outcome.strokes).toBe(session.strokes);
    expect(outcome.phase).toBe(session.phase);
    expect(outcome.position).toStrictEqual([p.x, p.y, p.z]);
    session.dispose();
  });
});
