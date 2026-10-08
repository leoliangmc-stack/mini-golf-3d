import { beforeAll, describe, expect, it } from 'vitest';
import { checkReplay, playReplay, recordReplay } from '../src/game/replay';
import { RULES } from '../src/game/rules';
import { Session } from '../src/game/session';
import type { HoleDef } from '../src/level/schema';
import { DEFAULT_BALL } from '../src/physics/ball';
import { boxHole, runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const r = DEFAULT_BALL.radius;
const FALL = boxHole().zones[0];
const CUP = { radius: 0.22, captureSpeed: 3.5 };

/**
 * A high deck the ball runs off the end of, with a landing island off to the right:
 * straight ahead there is nothing but the drop.
 */
const jump = (extra: Partial<HoleDef> = {}): HoleDef => ({
  ...boxHole({ tee: [0, 2, 5] }),
  par: 3,
  goal: { type: 'cup', position: [6, 0, -3], ...CUP },
  pieces: [
    { type: 'floor', min: [-1, 0], max: [1, 7], y: 2, surface: 'grass' },
    { type: 'floor', min: [3, -6], max: [9, 0], surface: 'grass' },
    // A backstop, so a ball that lands on the island stays on it.
    { type: 'wall', from: [9, -6], to: [9, 0], surface: 'rail' },
  ],
  zones: [FALL],
  skills: { freeze: 2 },
  ...extra,
});

/** Strikes the ball off the deck and steps until it is in the air beyond the edge. */
function launch(session: Session, power = 0.5): void {
  stepTicks(session, 10);
  session.shoot({ x: 0, y: 0, z: -1 }, power);
  while (session.phase === 'rolling' && session.ball.position().z > -1) session.step();
  expect(session.phase).toBe('rolling');
}

describe('time freeze (SPEC v3 2.3)', () => {
  it('is offered by the hole, a set number of times', () => {
    const session = new Session(jump());
    expect(session.skills.get('freeze')).toEqual({ max: 2, charges: 2 });
    expect(new Session(boxHole()).skills.size).toBe(0);
    session.dispose();
  });

  it('cannot be used while the ball is at rest', () => {
    const session = new Session(jump());
    expect(session.canUseSkill('freeze')).toBe(false);
    expect(session.useSkill('freeze')).toBe(false);
    expect(session.skills.get('freeze')!.charges).toBe(2);
    session.dispose();
  });

  it('stops everything: no tick passes, nothing moves, the countdown waits', () => {
    const session = new Session(jump({ timer: { seconds: 20 } }));
    launch(session);
    expect(session.useSkill('freeze')).toBe(true);
    expect(session.frozen).toBe(true);
    const tick = session.world.tick;
    const at = { ...session.ball.position() };
    const speed = { ...session.ball.velocity() };
    const timeLeft = session.timeLeft;
    stepTicks(session, 300);
    expect(session.world.tick).toBe(tick);
    expect(session.ball.position()).toEqual(at);
    expect(session.ball.velocity()).toEqual(speed);
    expect(session.timeLeft).toBe(timeLeft);
    expect(session.phase).toBe('rolling');
    session.dispose();
  });

  it('carries on exactly as if nothing had happened when time is let run again', () => {
    const play = (freezeFor: number) => {
      const session = new Session(jump());
      launch(session);
      if (freezeFor > 0) {
        session.useSkill('freeze');
        stepTicks(session, freezeFor);
        expect(session.resume()).toBe(true);
      }
      stepTicks(session, 20);
      const state = [session.world.tick, { ...session.ball.position() }, { ...session.ball.velocity() }];
      session.dispose();
      return state;
    };
    expect(play(500)).toStrictEqual(play(0));
    expect(play(3)).toStrictEqual(play(0));
  });

  it('lets the ball be struck again in mid-air, replacing its speed outright', () => {
    const session = new Session(jump());
    launch(session);
    const before = session.ball.velocity();
    expect(before.z).toBeLessThan(-3);
    expect(session.ball.position().y).toBeGreaterThan(r + 0.5);
    session.useSkill('freeze');
    expect(session.shoot({ x: 1, y: 0, z: 0 }, 0.3)).toBe(true);
    expect(session.frozen).toBe(false);
    expect(session.strokes).toBe(2);
    // Horizontal only (SPEC v3 2.3): the old speed is gone, falling starts from nothing.
    const after = session.ball.velocity();
    expect(after.x).toBeCloseTo(0.3 * RULES.maxShotSpeed, 5);
    expect(after.y).toBe(0);
    expect(after.z).toBe(0);
    runUntilSettled(session);
    // It came down on the island to the right instead of dropping off the course.
    expect(session.stats.outOfBounds).toBe(0);
    expect(session.ball.position().x).toBeGreaterThan(3);
    expect(session.ball.position().y).toBeCloseTo(r, 2);
    session.dispose();
  });

  it('runs out: two uses per hole here, whether or not a stroke was played', () => {
    const session = new Session(jump());
    launch(session);
    expect(session.useSkill('freeze')).toBe(true);
    // Already frozen: a second press does nothing and costs nothing.
    expect(session.useSkill('freeze')).toBe(false);
    session.resume();
    expect(session.useSkill('freeze')).toBe(true);
    session.resume();
    expect(session.skills.get('freeze')!.charges).toBe(0);
    expect(session.canUseSkill('freeze')).toBe(false);
    expect(session.useSkill('freeze')).toBe(false);
    expect(session.stats.cues.freeze).toBe(2);
    session.dispose();
  });

  it('puts a ball that then leaves the course back where the last stroke from the ground was played', () => {
    const session = new Session(jump());
    const tee = { ...session.ball.position() };
    launch(session);
    session.useSkill('freeze');
    // Struck the wrong way in mid-air: away from the island.
    session.shoot({ x: -1, y: 0, z: 0 }, 0.6);
    runUntilSettled(session);
    expect(session.stats.outOfBounds).toBe(1);
    expect(session.strokes).toBe(3);
    const back = session.ball.position();
    expect(back.x).toBeCloseTo(tee.x, 6);
    expect(back.y).toBeCloseTo(tee.y, 3);
    expect(back.z).toBeCloseTo(tee.z, 6);
    session.dispose();
  });

  it('counts a frozen stroke played from the ground as a stroke from the ground', () => {
    const session = new Session(jump());
    stepTicks(session, 10);
    session.shoot({ x: 0, y: 0, z: -1 }, 0.5);
    // Frozen while still rolling along the deck, nowhere near the edge.
    stepTicks(session, 8);
    expect(session.ball.position().z).toBeGreaterThan(2);
    expect(session.ball.position().y).toBeCloseTo(2 + r, 2);
    expect(session.useSkill('freeze')).toBe(true);
    const from = { ...session.ball.position() };
    // Struck sideways off the deck, into the drop: it comes back to where that stroke
    // was played, not to the tee.
    expect(session.shoot({ x: -1, y: 0, z: 0 }, 0.6)).toBe(true);
    runUntilSettled(session);
    expect(session.stats.outOfBounds).toBe(1);
    const back = session.ball.position();
    expect(back.x).toBeCloseTo(from.x, 6);
    expect(back.z).toBeCloseTo(from.z, 6);
    session.dispose();
  });

  it('does not let the stroke limit be passed in mid-air', () => {
    const session = new Session(jump({ par: 1, strokeLimit: 1 }));
    launch(session);
    session.useSkill('freeze');
    expect(session.shoot({ x: 1, y: 0, z: 0 }, 0.5)).toBe(false);
    expect(session.frozen).toBe(true);
    session.resume();
    runUntilSettled(session);
    expect(session.strokes).toBeLessThanOrEqual(2);
    session.dispose();
  });

  it('is recorded and plays back exactly (SPEC v3 5.3 #6)', () => {
    const hole = jump();
    const session = new Session(hole);
    launch(session);
    session.useSkill('freeze');
    stepTicks(session, 77);
    session.shoot({ x: 1, y: 0, z: -0.2 }, 0.5);
    runUntilSettled(session);
    stepTicks(session, 30);
    // A second freeze, let go of without a stroke.
    session.shoot({ x: 1, y: 0, z: -0.6 }, 0.3);
    stepTicks(session, 12);
    session.useSkill('freeze');
    session.resume();
    runUntilSettled(session);
    expect(session.inputs.map((input) => input.type)).toEqual(['shot', 'skill', 'shot', 'shot', 'skill', 'resume']);

    const result = playReplay(hole, session.inputs);
    const live = session.ball.position();
    if (result) expect(result.position).toStrictEqual([live.x, live.y, live.z]);
    const again = new Session(hole);
    again.replay(session.inputs);
    for (let i = 0; i < 5000 && (again.replaying || again.phase === 'rolling'); i++) again.step();
    expect(again.world.tick).toBe(session.world.tick);
    expect(again.ball.position()).toStrictEqual(live);
    expect(again.strokes).toBe(session.strokes);
    expect(again.skills.get('freeze')!.charges).toBe(0);
    again.dispose();
    session.dispose();
  });

  it('can be part of a reference solution', () => {
    // Off the deck, freeze, turn right in mid-air, and roll into a wide cup on the island.
    const hole = jump({ goal: { type: 'cup', position: [5.2, 0, -1.1], radius: 0.5, captureSpeed: 6 } });
    const session = new Session(hole);
    launch(session);
    session.useSkill('freeze');
    session.shoot({ x: 1, y: 0, z: 0 }, 0.3);
    runUntilSettled(session);
    expect(session.outcome).toMatchObject({ holed: true, strokes: 2 });
    const file = recordReplay(hole, session.inputs);
    expect(file).not.toBeNull();
    expect(checkReplay(hole, file!)).toMatchObject({ ok: true, exact: true });
    session.dispose();
  });
});
