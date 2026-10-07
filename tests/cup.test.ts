import { beforeAll, describe, expect, it } from 'vitest';
import { FIXED_DT } from '../src/core/loop';
import { cupAnchor, cupLidOpenness, cupOpenAt, cupPositionAt, cupTrack } from '../src/game/cup';
import { verifyDeterminism } from '../src/game/replay';
import { cupCaptures, RULES } from '../src/game/rules';
import { Session, type SessionEvent } from '../src/game/session';
import type { CupDef, HoleDef } from '../src/level/schema';
import { DEFAULT_BALL } from '../src/physics/ball';
import { moverPose } from '../src/physics/movers';
import { boxHole, runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const r = DEFAULT_BALL.radius;
const speed = (metresPerSecond: number) => metresPerSecond / RULES.maxShotSpeed;
const CUP = { radius: 0.22, captureSpeed: 3.5 };

/** A long walled lane along X, with the cup somewhere on it. */
function lane(cup: CupDef, tee: [number, number, number] = [0, 0, 2]): HoleDef {
  return {
    ...boxHole({ tee, cup }),
    pieces: [
      { type: 'floor', min: [-9, -3], max: [9, 3], surface: 'grass' },
      { type: 'wall', from: [-9, -3], to: [9, -3], surface: 'rail' },
      { type: 'wall', from: [9, -3], to: [9, 3], surface: 'rail' },
      { type: 'wall', from: [9, 3], to: [-9, 3], surface: 'rail' },
      { type: 'wall', from: [-9, 3], to: [-9, -3], surface: 'rail' },
    ],
  };
}

/** Slides 12 m and back in 4 s: slow near the ends, far faster than any putt in the middle. */
const racing: CupDef = { position: [-6, 0, 0], ...CUP, motion: { type: 'slide', offset: [12, 0, 0], period: 4 } };
/** Slides 4 m and back in 8 s, pausing at each end: never faster than about 2 m/s. */
const strolling: CupDef = {
  position: [-2, 0, 0],
  ...CUP,
  motion: { type: 'slide', offset: [4, 0, 0], period: 8, hold: [0.1, 0.1] },
};

const cupSpeedAt = (cup: CupDef, tick: number): number => {
  const a = cupPositionAt(cup, tick);
  const b = cupPositionAt(cup, tick + 1);
  return Math.hypot(b.x - a.x, b.z - a.z) / FIXED_DT;
};

describe('moving cup (SPEC v2 2.5)', () => {
  it('runs on the same schedule as a moving part with the same motion', () => {
    for (const tick of [0, 1, 37, 120, 239, 240, 5000]) {
      const cup = cupPositionAt(strolling, tick);
      const mover = moverPose(
        { role: 'pusher', size: [1, 1, 1], position: strolling.position, surface: 'rail', motion: strolling.motion! },
        tick,
      ).position;
      expect(cup).toEqual(mover);
    }
    // Out and back once per period, to the tick.
    expect(cupPositionAt(strolling, 0)).toEqual({ x: -2, y: 0, z: 0 });
    expect(cupPositionAt(strolling, 240).x).toBeCloseTo(2, 9);
    expect(cupPositionAt(strolling, 480)).toEqual(cupPositionAt(strolling, 0));
  });

  it('circles a pivot', () => {
    const circling: CupDef = { position: [2, 0, -5], ...CUP, motion: { type: 'spin', pivot: [0, -5], period: 8 } };
    for (const point of cupTrack(circling)) expect(Math.hypot(point.x, point.z + 5)).toBeCloseTo(2, 9);
    expect(cupAnchor(circling)).toEqual({ x: expect.closeTo(0, 6), y: 0, z: expect.closeTo(-5, 6) });
    expect(cupSpeedAt(circling, 100)).toBeCloseTo((2 * Math.PI * 2) / 8, 3);
  });

  it('describes its track for the line on the ground', () => {
    const track = cupTrack(strolling);
    expect(Math.min(...track.map((p) => p.x))).toBeCloseTo(-2, 9);
    expect(Math.max(...track.map((p) => p.x))).toBeCloseTo(2, 9);
    expect(cupAnchor(strolling)).toEqual({ x: expect.closeTo(0, 9), y: 0, z: 0 });
    // A cup that stays put has no track.
    expect(cupTrack({ position: [1, 0, 2], ...CUP })).toEqual([{ x: 1, y: 0, z: 2 }]);
  });

  it('judges the ball by how fast it and the cup close on each other', () => {
    const at = { x: 0, y: 0, z: 0 };
    const on = { x: 0.1, y: r, z: 0 };
    expect(cupCaptures(racing, at, on, 3.4, r)).toBe(true);
    expect(cupCaptures(racing, at, on, 3.6, r)).toBe(false);
    // Wherever the cup is now, not where its data says it starts.
    expect(cupCaptures(racing, at, { x: -6, y: r, z: 0 }, 0, r)).toBe(false);
    expect(cupCaptures(racing, { x: -6, y: 0, z: 0 }, { x: -6, y: r, z: 0 }, 0, r)).toBe(true);
  });

  it('takes a ball rolling fast, if it is going the cup\'s way at nearly the cup\'s pace (5.2 #4)', () => {
    const session = new Session(lane(racing));
    // In the middle of its run the cup does over 9 m/s.
    stepTicks(session, 55);
    expect(cupSpeedAt(racing, 55)).toBeGreaterThan(9);
    const cup = cupPositionAt(racing, 55);
    // The ball is just ahead of it, sent the same way at 8 m/s: more than twice the capture speed.
    session.ball.teleport({ x: cup.x + 0.15, y: r, z: 0 });
    session.shoot({ x: 1, y: 0, z: 0 }, speed(8));
    session.step();
    expect(session.outcome?.holed).toBe(true);
    expect(session.strokes).toBe(1);
    session.dispose();
  });

  it('does not take a slow ball when the cup comes at it head-on (5.2 #4)', () => {
    const session = new Session(lane(racing));
    stepTicks(session, 55);
    const cup = cupPositionAt(racing, 55);
    // A putt of 2.5 m/s, well under the capture speed, rolling straight at the oncoming cup.
    session.ball.teleport({ x: cup.x + 0.6, y: r, z: 0 });
    session.shoot({ x: -1, y: 0, z: 0 }, speed(2.5));
    let closest = Infinity;
    for (let i = 0; i < 20; i++) {
      session.step();
      closest = Math.min(closest, Math.abs(session.ball.position().x - session.cup.position.x));
    }
    // They passed right over each other, and the ball rolled on.
    expect(closest).toBeLessThan(0.22);
    expect(session.phase).toBe('rolling');
    expect(session.outcome).toBeNull();
    session.dispose();
  });

  it('ignores a ball lying on the track while the cup races over it, and takes it once the cup comes by slowly', () => {
    // In the middle of the track the cup passes at over 9 m/s.
    const middle = new Session(lane(racing, [0, 0, 0]));
    stepTicks(middle, 480);
    expect(middle.outcome).toBeNull();
    middle.dispose();

    // Near the end of the track it has slowed to walking pace.
    const end = new Session(lane(racing, [5.9, 0, 0]));
    expect(cupSpeedAt(racing, 115)).toBeLessThan(3.5);
    const events: SessionEvent[] = [];
    end.on((e) => events.push(e));
    stepTicks(end, 130);
    // Taken without a stroke having been played: the hole came to the ball.
    expect(end.outcome).toMatchObject({ holed: true, strokes: 0 });
    expect(events.map((e) => e.type)).toEqual(['holed', 'finished']);
    end.dispose();
  });

  it('lets a ball wait on the track for a cup that never goes fast', () => {
    const session = new Session(lane(strolling, [1, 0, 2.5]));
    // Rolled onto the line, well away from where the cup is at that moment.
    session.shoot({ x: 0, y: 0, z: -1 }, speed(3.05));
    runUntilSettled(session);
    expect(session.phase).toBe('aiming');
    expect(Math.abs(session.ball.position().z)).toBeLessThan(0.2);
    stepTicks(session, 480);
    expect(session.outcome).toMatchObject({ holed: true, strokes: 1, stars: 3 });
    session.dispose();
  });

  it('stops where the hole ended', () => {
    const session = new Session(lane(strolling, [1, 0, 0]));
    stepTicks(session, 480);
    expect(session.phase).toBe('done');
    const where = { ...session.cup.position };
    stepTicks(session, 200);
    expect(session.cup.position).toEqual(where);
    expect(session.cup.prevPosition).toEqual(where);
    session.dispose();
  });

  it('replays exactly, cup and all', () => {
    const hole = lane(strolling, [0.5, 0, 2.5]);
    const session = new Session(hole);
    stepTicks(session, 97);
    session.shoot({ x: 0.2, y: 0, z: -1 }, speed(6));
    runUntilSettled(session);
    stepTicks(session, 33);
    if (session.phase === 'aiming') {
      const p = session.ball.position();
      session.shoot({ x: -p.x, y: 0, z: -p.z }, speed(2.4));
      runUntilSettled(session);
    }
    const { identical, outcome } = verifyDeterminism(hole, session.shots, 10);
    expect(identical).toBe(true);
    expect(outcome.strokes).toBe(session.strokes);
    session.dispose();
  });
});

describe('cup with a lid (SPEC v2 2.5)', () => {
  /** Open for the first two seconds of every four. */
  const lidded: CupDef = { position: [0, 0, -2], ...CUP, hidden: { period: 4, openRatio: 0.5 } };
  const hole = boxHole({ cup: lidded });

  it('opens and shuts on a fixed schedule', () => {
    expect(cupOpenAt(lidded, 0)).toBe(true);
    expect(cupOpenAt(lidded, 119)).toBe(true);
    expect(cupOpenAt(lidded, 120)).toBe(false);
    expect(cupOpenAt(lidded, 239)).toBe(false);
    expect(cupOpenAt(lidded, 240)).toBe(true);
    expect(cupOpenAt({ ...lidded, hidden: { period: 4, openRatio: 0.5, phase: 0.5 } }, 0)).toBe(false);
    // The lid is drawn fully open only while the cup takes balls, and fully shut whenever it does not.
    for (let tick = 0; tick < 240; tick++) {
      const openness = cupLidOpenness(lidded, tick);
      if (!cupOpenAt(lidded, tick)) expect(openness).toBe(0);
      else expect(openness).toBeGreaterThanOrEqual(0);
      expect(openness).toBeLessThanOrEqual(1);
    }
    expect(cupLidOpenness(lidded, 60)).toBe(1);
    expect(cupLidOpenness({ position: [0, 0, 0], ...CUP }, 60)).toBe(1);
  });

  it('is plain ground while shut: a putt that would drop rolls straight over', () => {
    const session = new Session(hole);
    stepTicks(session, 130);
    expect(session.cup.open).toBe(false);
    session.shoot({ x: 0, y: 0, z: -1 }, speed(3.3));
    let beyond = false;
    for (let i = 0; i < 100 && !beyond; i++) {
      session.step();
      beyond = session.ball.position().z < -2.3;
    }
    expect(beyond).toBe(true);
    expect(session.cup.open).toBe(false);
    expect(session.outcome).toBeNull();
    session.dispose();
  });

  it('takes the same putt while open', () => {
    const session = new Session(hole);
    stepTicks(session, 10);
    session.shoot({ x: 0, y: 0, z: -1 }, speed(3.3));
    runUntilSettled(session);
    expect(session.outcome).toMatchObject({ holed: true, strokes: 1 });
    session.dispose();
  });

  it('drops a ball that came to rest on the lid, the moment the lid opens', () => {
    // Shut for four seconds at a time: long enough for a ball to roll up and stop on it.
    const slow: CupDef = { ...lidded, hidden: { period: 8, openRatio: 0.5 } };
    const session = new Session(boxHole({ cup: slow }));
    const cues: string[] = [];
    session.on((e) => e.type === 'cue' && cues.push(`${e.name}@${session.world.tick}`));
    stepTicks(session, 245);
    // Just enough to die on top of the cup, two metres away.
    session.shoot({ x: 0, y: 0, z: -1 }, speed(2.46));
    runUntilSettled(session);
    expect(session.phase).toBe('aiming');
    expect(Math.abs(session.ball.position().z + 2)).toBeLessThan(0.15);
    expect(session.world.tick).toBeLessThan(470);
    while (session.world.tick < 479) session.step();
    expect(session.outcome).toBeNull();
    stepTicks(session, 2);
    expect(session.outcome).toMatchObject({ holed: true, strokes: 1 });
    expect(cues).toEqual(['cupShut@240', 'cupOpen@480']);
    session.dispose();
  });
});
