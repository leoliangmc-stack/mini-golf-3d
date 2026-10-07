import { beforeAll, describe, expect, it } from 'vitest';
import { verifyDeterminism } from '../src/game/replay';
import { RULES } from '../src/game/rules';
import { Session, type SessionEvent } from '../src/game/session';
import type { HoleDef, PieceDef } from '../src/level/schema';
import { DEFAULT_BALL } from '../src/physics/ball';
import type { ZoneDef } from '../src/physics/zones';
import { headingVector, tunnelPair, type TunnelEnd } from '../src/physics/zones/tunnel';
import { boxHole, runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const r = DEFAULT_BALL.radius;
const speed = (metresPerSecond: number) => metresPerSecond / RULES.maxShotSpeed;

/** A walled 16 m square of grass with whatever stands on it. */
function yard(tee: [number, number, number], zones: ZoneDef[], extra: PieceDef[] = []): HoleDef {
  const base = boxHole({ tee });
  return {
    ...base,
    pieces: [
      { type: 'floor', min: [-8, -8], max: [8, 8], surface: 'grass' },
      { type: 'wall', from: [-8, -8], to: [8, -8], surface: 'rail' },
      { type: 'wall', from: [8, -8], to: [8, 8], surface: 'rail' },
      { type: 'wall', from: [8, 8], to: [-8, 8], surface: 'rail' },
      { type: 'wall', from: [-8, 8], to: [-8, -8], surface: 'rail' },
      ...extra,
    ],
    zones: [...base.zones, ...zones],
  };
}

/** A tree trunk standing right behind a mouth, as in the forest. */
function trunk(end: TunnelEnd): PieceDef {
  const dir = headingVector(end.facing);
  return { type: 'pillar', at: [end.at[0] - dir.x * 0.55, end.at[2] - dir.z * 0.55], radius: 0.55, height: 2, surface: 'rail' };
}

/** A faces the tee side (+Z); B stands off to the right and faces right (+X). */
const A: TunnelEnd = { at: [0, 0, -3], facing: 180 };
const B: TunnelEnd = { at: [5, 0, 2], facing: 90 };
const pair = tunnelPair(A, B);

interface Trip {
  events: { name: string; tick: number }[];
  /** Ball speed on the last step before it was taken, and velocity and position on the step it was let go. */
  speedIn: number;
  out: { x: number; y: number; z: number } | null;
  at: { x: number; y: number; z: number } | null;
}

/** Shoots once and follows the ball until it rests, noting what the tunnel did to it. */
function follow(session: Session, heading: number, metresPerSecond: number): Trip {
  const trip: Trip = { events: [], speedIn: 0, out: null, at: null };
  session.on((e: SessionEvent) => {
    if (e.type !== 'surface') trip.events.push({ name: e.type === 'cue' ? e.name : e.type, tick: session.world.tick });
  });
  const dir = headingVector(heading);
  expect(session.shoot(dir, speed(metresPerSecond))).toBe(true);
  let inside = false;
  let ticks = 0;
  while (session.phase === 'rolling' && ticks++ < 4000) {
    const before = session.ball.speed();
    session.step();
    const enabled = session.ball.body.isEnabled();
    if (!inside && !enabled) {
      inside = true;
      trip.speedIn = before;
    } else if (inside && enabled && !trip.out) {
      // One step has already run since the ball was let go, so it has slowed a touch.
      trip.out = { ...session.ball.velocity() };
      trip.at = { ...session.ball.position() };
    }
  }
  return trip;
}

describe('tunnel pair (SPEC v2 2.3)', () => {
  it('lets the ball out of the other mouth at the speed it went in with, along that mouth', () => {
    const session = new Session(yard([0, 0, 0], [pair], [trunk(A), trunk(B)]));
    const trip = follow(session, 0, 7);
    const names = trip.events.map((e) => e.name);
    expect(names.slice(0, 3)).toEqual(['shot', 'tunnelEnter', 'tunnelExit']);
    // Never judged as stopped while inside, and it did not have to bounce off the trunk first.
    expect(names.filter((n) => n === 'stopped')).toHaveLength(1);
    expect(names.indexOf('stopped')).toBeGreaterThan(names.indexOf('tunnelExit'));
    expect(names.slice(0, names.indexOf('tunnelEnter'))).not.toContain('bounce');

    // Same speed, new direction: straight along +X, nothing sideways or upward.
    expect(trip.speedIn).toBeGreaterThan(4);
    expect(trip.out!.x).toBeGreaterThan(trip.speedIn - 0.2);
    expect(trip.out!.x).toBeLessThanOrEqual(trip.speedIn + 1e-6);
    expect(Math.abs(trip.out!.z)).toBeLessThan(1e-6);
    expect(Math.abs(trip.out!.y)).toBeLessThan(0.2);
    // It reappears just in front of the far mouth, not at the near one.
    expect(trip.at!.x).toBeGreaterThan(5.1);
    expect(trip.at!.x).toBeLessThan(5.5);
    expect(trip.at!.z).toBeCloseTo(2, 5);

    // A visible trip, not a teleport: about 0.3 s between going in and being let go.
    const entered = trip.events.find((e) => e.name === 'tunnelEnter')!.tick;
    const emerging = trip.events.find((e) => e.name === 'tunnelExit')!.tick;
    expect(emerging - entered).toBe(9);
    expect(session.stats.cues).toEqual({ tunnelEnter: 1, tunnelExit: 1 });
    expect(session.strokes).toBe(1);
    session.dispose();
  });

  it('works both ways', () => {
    // From the right of B, rolling left into it: out of A, heading +Z.
    const session = new Session(yard([7, 0, 2], [pair], [trunk(A), trunk(B)]));
    const trip = follow(session, 270, 6);
    expect(trip.out!.z).toBeGreaterThan(trip.speedIn - 0.2);
    expect(Math.abs(trip.out!.x)).toBeLessThan(1e-6);
    expect(trip.at!.x).toBeCloseTo(0, 5);
    expect(trip.at!.z).toBeGreaterThan(-2.9);
    expect(trip.at!.z).toBeLessThan(-2.5);
    session.dispose();
  });

  it('takes a full-power ball too, before it can bounce off the trunk', () => {
    const session = new Session(yard([0, 0, 5], [pair], [trunk(A), trunk(B)]));
    const trip = follow(session, 0, RULES.maxShotSpeed);
    expect(trip.events[1].name).toBe('tunnelEnter');
    expect(trip.speedIn).toBeGreaterThan(12);
    expect(trip.out!.x).toBeGreaterThan(12);
    session.dispose();
  });

  it('accepts a ball coming in at an angle, and still lets it out dead straight', () => {
    const session = new Session(yard([1.8, 0, 2], [pair], [trunk(A), trunk(B)]));
    // About 20 degrees off the axis of the mouth.
    const trip = follow(session, -20, 7);
    expect(trip.events[1].name).toBe('tunnelEnter');
    expect(Math.abs(trip.out!.z)).toBeLessThan(1e-6);
    session.dispose();
  });

  it('leaves alone a ball that is not rolling into the mouth', () => {
    // Lying right in front of the mouth.
    const still = new Session(yard([0, 0, -2.8], [pair], [trunk(A), trunk(B)]));
    stepTicks(still, 120);
    expect(still.stats.cues).toEqual({});
    expect(still.ball.body.isEnabled()).toBe(true);
    // Shot away from the mouth it is lying in.
    still.shoot({ x: 0, y: 0, z: 1 }, speed(5));
    runUntilSettled(still);
    expect(still.stats.cues).toEqual({});
    expect(still.ball.position().z).toBeGreaterThan(0);
    still.dispose();

    // Rolling straight across the front of it.
    const across = new Session(yard([-3, 0, -2.75], [pair], [trunk(A), trunk(B)]));
    across.shoot({ x: 1, y: 0, z: 0 }, speed(5));
    runUntilSettled(across);
    expect(across.stats.cues).toEqual({});
    expect(across.ball.position().x).toBeGreaterThan(0.5);
    across.dispose();
  });

  it('pauses every tunnel for a moment after the ball comes out of one', () => {
    // A second pair whose mouth stands right in the way out of B.
    const blocked = (gap: number): ZoneDef =>
      tunnelPair({ at: [5 + gap, 0, 2], facing: 270 }, { at: [-6, 0, 6], facing: 0 }, { color: 0xff0000 });

    // One metre on: the ball is there long before the pause is over, and rolls on by.
    const near = new Session(yard([0, 0, 2], [pair, blocked(1)], [trunk(A), trunk(B)]));
    follow(near, 0, 7);
    expect(near.stats.cues.tunnelEnter).toBe(1);
    expect(near.ball.position().x).toBeGreaterThan(6.5);
    near.dispose();

    // Far enough, for a slower ball, that the pause has passed: the second tunnel takes it.
    const far = new Session(yard([0, 0, 0], [pair, blocked(2.6)], [trunk(A), trunk(B)]));
    follow(far, 0, 6.5);
    expect(far.stats.cues.tunnelEnter).toBe(2);
    expect(far.ball.position().z).toBeLessThan(6);
    expect(far.ball.position().x).toBeLessThan(-5);
    far.dispose();
  });

  it('gives the same result every time (SPEC v2 5.2 #3)', () => {
    const hole = yard([0, 0, 2], [pair], [trunk(A), trunk(B)]);
    const session = new Session(hole);
    stepTicks(session, 23);
    session.shoot(headingVector(-4), speed(9.3));
    runUntilSettled(session);
    // Second stroke: back into the mouth it came out of.
    const p = session.ball.position();
    stepTicks(session, 41);
    session.shoot({ x: 5 - p.x, y: 0, z: 2 - p.z }, speed(8.1));
    runUntilSettled(session);
    expect(session.stats.cues.tunnelEnter).toBe(2);
    const end = session.ball.position();

    const { identical, outcome } = verifyDeterminism(hole, session.shots, 10);
    expect(identical).toBe(true);
    expect(outcome.position).toStrictEqual([end.x, end.y, end.z]);
    expect(outcome.tick).toBe(session.world.tick);
    session.dispose();
  });

  it('always comes to rest, even between two mouths that face each other', () => {
    // Exactly what hole data must never do (tests/worlds.test.ts forbids it). Even so the
    // ball slows a little on every crossing and stops: there is no endless loop.
    const facing = tunnelPair({ at: [-6, 0, 0], facing: 90 }, { at: [6, 0, 0], facing: 270 });
    const session = new Session(yard([0, 0, 0], [facing]));
    session.shoot({ x: 1, y: 0, z: 0 }, 1);
    const ticks = runUntilSettled(session, 20000);
    expect(session.phase).toBe('aiming');
    expect(ticks).toBeLessThan(6000);
    // Round and round a couple of times, then it runs out of speed.
    expect(session.stats.cues.tunnelEnter).toBeGreaterThanOrEqual(2);
    expect(session.stats.cues.tunnelEnter).toBeLessThan(10);
    expect(Math.abs(session.ball.position().y - r)).toBeLessThan(0.01);
    session.dispose();
  });

  it('starts afresh on a retry taken in mid-tunnel', () => {
    const session = new Session(yard([0, 0, 0], [pair], [trunk(A), trunk(B)]));
    session.shoot({ x: 0, y: 0, z: -1 }, speed(7));
    while (session.ball.body.isEnabled()) session.step();
    session.reset();
    expect(session.ball.body.isEnabled()).toBe(true);
    expect(session.strokes).toBe(0);
    const trip = follow(session, 0, 7);
    expect(trip.out!.x).toBeGreaterThan(4);
    expect(session.stats.cues).toEqual({ tunnelEnter: 1, tunnelExit: 1 });
    session.dispose();
  });
});
