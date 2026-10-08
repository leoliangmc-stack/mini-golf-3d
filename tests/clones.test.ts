import { beforeAll, describe, expect, it } from 'vitest';
import { checkReplay, recordReplay } from '../src/game/replay';
import { Session, type SessionEvent } from '../src/game/session';
import type { HoleDef, PieceDef } from '../src/level/schema';
import { growPad, splitPad } from '../src/physics/zones/pads';
import { boxHole, runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const FALL = boxHole().zones[0];
const CUP = { radius: 0.22, captureSpeed: 3.5 };

const walls = (minZ: number): PieceDef[] => [
  { type: 'wall', from: [-4, 7], to: [4, 7], surface: 'rail' },
  { type: 'wall', from: [4, 7], to: [4, minZ], surface: 'rail' },
  { type: 'wall', from: [4, minZ], to: [-4, minZ], surface: 'rail' },
  { type: 'wall', from: [-4, minZ], to: [-4, 7], surface: 'rail' },
];

/** A wide walled room, tee at z = 5, a split pad two metres on. */
const room = (extra: Partial<HoleDef> = {}): HoleDef => ({
  ...boxHole({ tee: [0, 0, 5] }),
  maxBalls: 2,
  pieces: [{ type: 'floor', min: [-4, -10], max: [4, 7], surface: 'grass' }, ...walls(-10)],
  zones: [FALL, splitPad([0, 0, 3])],
  ...extra,
});

function strike(session: Session, power: number, x = 0): SessionEvent[] {
  const events: SessionEvent[] = [];
  const off = session.on((event) => events.push(event));
  stepTicks(session, 10);
  expect(session.shoot({ x, y: 0, z: -1 }, power)).toBe(true);
  runUntilSettled(session);
  off();
  return events;
}

describe('clone ball (SPEC v3 2.4)', () => {
  it('splits in two at a fixed angle to either side, both at the same speed', () => {
    const session = new Session(room());
    stepTicks(session, 10);
    session.shoot({ x: 0, y: 0, z: -1 }, 0.5);
    while (session.balls.live.length === 1) session.step();
    const [a, b] = session.balls.live.map((ball) => ball.velocity());
    // 20 degrees each way: mirror images about the line of the stroke.
    expect(a.x).toBeCloseTo(-b.x, 6);
    expect(a.z).toBeCloseTo(b.z, 6);
    expect(Math.abs(Math.atan2(a.x, -a.z))).toBeCloseTo((20 * Math.PI) / 180, 4);
    expect(Math.hypot(a.x, a.z)).toBeCloseTo(Math.hypot(b.x, b.z), 6);
    runUntilSettled(session);
    expect(session.phase).toBe('aiming');
    expect(session.balls.live).toHaveLength(2);
    expect(session.stats.cues.split).toBe(1);
    session.dispose();
  });

  it('never has more balls than the hole allows', () => {
    const pads = [FALL, splitPad([0, 0, 3]), splitPad([0, 0, 1], 20, 2.5), splitPad([0, 0, -2], 20, 3.5)];
    for (const maxBalls of [1, 2, 3, 4, 9]) {
      const session = new Session(room({ maxBalls, zones: pads }));
      let most = 1;
      stepTicks(session, 10);
      session.shoot({ x: 0, y: 0, z: -1 }, 0.8);
      while (session.phase === 'rolling') {
        session.step();
        most = Math.max(most, session.balls.live.length);
      }
      // Four is the most there ever is, whatever the hole asks for.
      expect(most).toBe(Math.min(maxBalls, 4));
      session.dispose();
    }
    expect(new Session(boxHole()).maxBalls).toBe(1);
  });

  it('does not end the stroke until every ball has stopped (SPEC v3 5.3 #5)', () => {
    // One half dies in sand at once, the other rolls on.
    const hole = room({
      pieces: [
        { type: 'floor', min: [0.5, -1], max: [4, 2.5], surface: 'sand' },
        { type: 'floor', min: [-4, -10], max: [4, 7], surface: 'grass' },
        ...walls(-10),
      ],
    });
    const session = new Session(hole);
    stepTicks(session, 10);
    session.shoot({ x: 0, y: 0, z: -1 }, 0.9);
    let slowTicks = 0;
    while (session.phase === 'rolling') {
      session.step();
      if (session.balls.live.some((ball) => ball.speed() < 0.01)) slowTicks++;
      else if (slowTicks > 0) break;
    }
    // One ball lay still for a long while before the stroke ended.
    expect(slowTicks).toBeGreaterThan(60);
    expect(session.phase).toBe('aiming');
    for (const ball of session.balls.live) expect(ball.speed()).toBe(0);
    session.dispose();
  });

  it('finishes the hole when any one ball drops in', () => {
    // The cup is on the right-hand half's line only.
    const session = new Session(room({ goal: { type: 'cup', position: [-1.092, 0, 0], ...CUP } }));
    const events = strike(session, 0.34);
    expect(session.outcome).toMatchObject({ holed: true, strokes: 1 });
    expect(events.filter((event) => event.type === 'holed')).toHaveLength(1);
    expect(session.stats.cues.holed).toBe(1);
    session.dispose();
  });

  it('waits for the second ball, and counts it, when both are on their way in', () => {
    // A cup wide enough to lie on both halves' lines.
    const hole = room({
      goal: { type: 'cup', position: [0, 0, -0.2], radius: 1.4, captureSpeed: 6 },
      challenge: { type: 'minCues', cue: 'holed', count: 2, text: { en: 'Hole both halves', zh: '两个分身都进洞' } },
    });
    const session = new Session(hole);
    const events = strike(session, 0.3);
    const holedAt = events.flatMap((event, i) => (event.type === 'holed' ? [i] : []));
    expect(holedAt).toHaveLength(2);
    // The round is not over at the first one...
    expect(events.findIndex((event) => event.type === 'finished')).toBeGreaterThan(holedAt[1]);
    expect(session.outcome).toMatchObject({ holed: true, strokes: 1, challengeMet: true, stars: 3 });
    session.dispose();
  });

  it('a ball that leaves the course is simply gone while another plays on', () => {
    // No wall on the left: the left-hand half runs off, the right-hand one stays.
    const hole = room({
      pieces: [
        { type: 'floor', min: [-2, -10], max: [4, 7], surface: 'grass' },
        { type: 'wall', from: [4, 7], to: [4, -10], surface: 'rail' },
        { type: 'wall', from: [4, -10], to: [-2, -10], surface: 'rail' },
      ],
    });
    const session = new Session(hole);
    const events = strike(session, 0.7);
    expect(events.filter((event) => event.type === 'ballRemoved')).toEqual([
      { type: 'ballRemoved', ball: expect.any(Number), reason: 'outOfBounds' },
    ]);
    expect(session.balls.live).toHaveLength(1);
    expect(session.stats.outOfBounds).toBe(0);
    expect(session.strokes).toBe(1);
    expect(session.phase).toBe('aiming');
    session.dispose();
  });

  it('costs a stroke and returns one ball only when all of them leave', () => {
    const hole = room({ pieces: [{ type: 'floor', min: [-2, 0], max: [2, 7], surface: 'grass' }] });
    const session = new Session(hole);
    const tee = { ...session.ball.position() };
    const events = strike(session, 1);
    expect(events.filter((event) => event.type === 'ballRemoved')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'outOfBounds')).toHaveLength(1);
    expect(session.stats.outOfBounds).toBe(1);
    expect(session.strokes).toBe(2);
    expect(session.balls.live).toHaveLength(1);
    expect(session.ball.position().z).toBeCloseTo(tee.z, 6);
    expect(session.phase).toBe('aiming');
    session.dispose();
  });

  it('lets the player pick which ball to play on with; the others vanish at the stroke', () => {
    const session = new Session(room());
    strike(session, 0.5);
    const [first, second] = session.balls.live;
    expect(session.ball).toBe(first);
    const events: SessionEvent[] = [];
    session.on((event) => events.push(event));
    expect(session.select(second)).toBe(true);
    expect(session.ball).toBe(second);
    // Picking is free and can be undone; nothing is lost until the stroke.
    expect(session.balls.live).toHaveLength(2);
    expect(session.select(first)).toBe(true);
    expect(session.select(second)).toBe(true);
    const where = { ...second.position() };
    expect(session.shoot({ x: 1, y: 0, z: 0 }, 0.2)).toBe(true);
    expect(session.balls.live).toEqual([second]);
    expect(events).toContainEqual({ type: 'ballRemoved', ball: first.id, reason: 'unpicked' });
    expect(session.inputs[session.inputs.length - 1]).toMatchObject({ type: 'shot', ball: 1 });
    runUntilSettled(session);
    expect(Math.abs(session.ball.position().x - where.x)).toBeGreaterThan(0.3);
    // A ball that is no longer there cannot be picked.
    expect(session.select(first)).toBe(false);
    session.dispose();
  });

  it('gives both halves the size the ball had (SPEC v3 2.7)', () => {
    const session = new Session(room({ zones: [FALL, growPad([0, 0, 4]), splitPad([0, 0, 2])] }));
    strike(session, 0.5);
    expect(session.balls.live.map((ball) => ball.state.size)).toEqual(['large', 'large']);
    session.dispose();
  });

  it('balls pass through one another', () => {
    // The halves bounce off the side walls and cross paths on the way back.
    const session = new Session(room({ zones: [FALL, splitPad([0, 0, 3], 60)] }));
    stepTicks(session, 10);
    session.shoot({ x: 0, y: 0, z: -1 }, 0.9);
    let crossed = false;
    while (session.phase === 'rolling') {
      session.step();
      const [a, b] = session.balls.live;
      if (b && a.position().x < b.position().x) crossed = true;
      // Mirror images all the way: neither ever knocked the other off its line.
      if (b) expect(a.position().x).toBeCloseTo(-b.position().x, 4);
    }
    expect(crossed).toBe(true);
    session.dispose();
  });

  it('records which ball each stroke was played with, and plays back exactly', () => {
    const hole = room({ goal: { type: 'cup', position: [3, 0, -6], ...CUP }, maxBalls: 3 });
    const session = new Session(hole);
    strike(session, 0.5);
    session.select(session.balls.live[1]);
    const target = session.ball.position();
    stepTicks(session, 25);
    session.shoot({ x: 3 - target.x, y: 0, z: -6 - target.z }, 0.3);
    runUntilSettled(session);
    for (let tries = 0; tries < 6 && session.phase === 'aiming'; tries++) {
      const p = session.ball.position();
      const reach = Math.hypot(3 - p.x, -6 - p.z);
      stepTicks(session, 15);
      session.shoot({ x: 3 - p.x, y: 0, z: -6 - p.z }, Math.min(0.5, 0.08 + reach * 0.06));
      runUntilSettled(session);
    }
    const file = recordReplay(hole, session.inputs);
    expect(file).not.toBeNull();
    expect(file!.inputs[1]).toMatchObject({ ball: 1 });
    expect(file!.expect.strokes).toBe(session.outcome?.strokes ?? session.strokeLimit);
    expect(checkReplay(hole, file!)).toMatchObject({ ok: true, exact: true });
    session.dispose();
  });
});
