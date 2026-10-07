import { beforeAll, describe, expect, it } from 'vitest';
import { challengeMet, emptyStats } from '../src/game/challenges';
import { verifyDeterminism } from '../src/game/replay';
import { RULES } from '../src/game/rules';
import { Session, type SessionEvent } from '../src/game/session';
import type { HoleDef } from '../src/level/schema';
import type { ZoneDef } from '../src/physics/zones';
import { boxHole, runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const speed = (metresPerSecond: number) => metresPerSecond / RULES.maxShotSpeed;
const text = { en: '', zh: '' };
const cup = { position: [0, 0, -2] as const, radius: 0.22, captureSpeed: 3.5 };

const clock = (x: number, z: number, seconds: number): ZoneDef => ({
  type: 'timeBonus',
  shape: { kind: 'sphere', center: [x, 0, z], radius: 0.5 },
  params: { seconds },
});

/** A walled box with a countdown, and optionally clocks. */
function timed(seconds: number, overrides: Partial<HoleDef> = {}, clocks: ZoneDef[] = []): HoleDef {
  const base = boxHole({ timer: { seconds }, ...overrides });
  return { ...base, zones: [...base.zones, ...clocks] };
}

function record(session: Session): string[] {
  const names: string[] = [];
  session.on((e: SessionEvent) => {
    if (e.type !== 'surface' && e.type !== 'bounce') names.push(e.type === 'cue' ? e.name : e.type);
  });
  return names;
}

describe('hole countdown (SPEC v2 2.6)', () => {
  it('waits for the first stroke, then runs whether the ball is rolling or the player is aiming', () => {
    const session = new Session(timed(10));
    expect(session.timeLeft).toBe(600);
    stepTicks(session, 300);
    expect(session.timeLeft).toBe(600);

    session.shoot({ x: 1, y: 0, z: 0 }, speed(2));
    const shotAt = session.world.tick;
    runUntilSettled(session);
    expect(session.phase).toBe('aiming');
    const rolled = session.world.tick - shotAt;
    expect(session.timeLeft).toBe(600 - rolled);
    // Standing over the ball costs time too.
    stepTicks(session, 100);
    expect(session.timeLeft).toBe(600 - rolled - 100);
    session.dispose();
  });

  it('ticks once a second and warns through the last three', () => {
    const session = new Session(timed(6));
    const names = record(session);
    session.shoot({ x: 1, y: 0, z: 0 }, speed(2));
    stepTicks(session, 6 * 60);
    expect(names.filter((n) => n.startsWith('timer'))).toEqual([
      'timerTick',
      'timerTick',
      'timerWarn',
      'timerWarn',
      'timerWarn',
    ]);
    session.dispose();
  });

  it('blows up when it reaches zero: the round is dead until it is reset', () => {
    const session = new Session(timed(2));
    const names = record(session);
    session.shoot({ x: 1, y: 0, z: 0 }, speed(2));
    stepTicks(session, 119);
    expect(session.phase).not.toBe('exploded');
    session.step();
    expect(session.phase).toBe('exploded');
    expect(session.timeLeft).toBe(0);
    expect(names.at(-1)).toBe('exploded');
    expect(session.outcome).toBeNull();
    expect(session.playing).toBe(false);
    expect(session.shoot({ x: 1, y: 0, z: 0 }, 0.5)).toBe(false);
    // Nothing more happens by itself, however long it is left.
    stepTicks(session, 300);
    expect(session.phase).toBe('exploded');
    expect(names.filter((n) => n === 'exploded')).toHaveLength(1);

    // Starting over: strokes back to zero, the full time back, and it waits for a stroke again.
    session.reset();
    expect(session.phase).toBe('aiming');
    expect(session.strokes).toBe(0);
    expect(session.timeLeft).toBe(120);
    expect(session.ball.body.isEnabled()).toBe(true);
    stepTicks(session, 200);
    expect(session.timeLeft).toBe(120);
    session.dispose();
  });

  it('counts a ball that drops on the very last tick as holed, not blown up', () => {
    // Find how long the putt takes, then give exactly that long.
    const probe = new Session(boxHole({ cup }));
    probe.shoot({ x: 0, y: 0, z: -1 }, speed(2.8));
    const ticks = runUntilSettled(probe);
    expect(probe.outcome?.holed).toBe(true);
    probe.dispose();

    const session = new Session(timed(ticks / 60, { cup }));
    session.shoot({ x: 0, y: 0, z: -1 }, speed(2.8));
    runUntilSettled(session);
    expect(session.outcome?.holed).toBe(true);
    expect(session.phase).toBe('done');

    const late = new Session(timed((ticks - 1) / 60, { cup }));
    late.shoot({ x: 0, y: 0, z: -1 }, speed(2.8));
    runUntilSettled(late);
    expect(late.phase).toBe('exploded');
    session.dispose();
    late.dispose();
  });

  it('can be conceded: the hole ends at the stroke limit with one star (防卡关)', () => {
    const session = new Session(timed(1, { par: 3 }));
    const names = record(session);
    session.shoot({ x: 1, y: 0, z: 0 }, speed(2));
    stepTicks(session, 60);
    expect(session.phase).toBe('exploded');
    session.concede();
    expect(session.phase).toBe('done');
    expect(session.outcome).toMatchObject({ holed: false, strokes: 6, stars: 1, challengeMet: false });
    expect(names.slice(-2)).toEqual(['exploded', 'finished']);
    // Conceding twice changes nothing.
    session.concede();
    expect(names.filter((n) => n === 'finished')).toHaveLength(1);
    session.dispose();
  });

  it('is part of what a replay reproduces', () => {
    // Six seconds, plus three from the clock: it runs out in the middle of the second stroke.
    const hole = timed(6, {}, [clock(2, 0, 3)]);
    const session = new Session(hole);
    stepTicks(session, 41);
    session.shoot({ x: 1, y: 0, z: 0.02 }, speed(6));
    runUntilSettled(session);
    expect(session.stats.cues.timeBonus).toBe(1);
    while (session.timeLeft! > 60) session.step();
    session.shoot({ x: -1, y: 0, z: 0.3 }, speed(6));
    runUntilSettled(session);
    expect(session.phase).toBe('exploded');
    const { identical, outcome } = verifyDeterminism(hole, session.shots, 10);
    expect(identical).toBe(true);
    expect(outcome.phase).toBe('exploded');
    expect(outcome.tick).toBe(session.world.tick);
    session.dispose();
  });

  it('leaves holes without a countdown alone', () => {
    const session = new Session({ ...boxHole(), zones: [...boxHole().zones, clock(1.5, 0, 5)] });
    const names = record(session);
    expect(session.timeLeft).toBeNull();
    session.shoot({ x: 1, y: 0, z: 0 }, speed(5));
    runUntilSettled(session);
    stepTicks(session, 600);
    expect(session.timeLeft).toBeNull();
    expect(session.phase).toBe('aiming');
    // The clock was rolled over and is used up, but there was no time to add to.
    expect(session.stats.cues.timeBonus).toBe(1);
    expect(names).not.toContain('timeAdded');
    session.dispose();
  });
});

describe('time bonus zone (SPEC v2 2.6)', () => {
  it('adds its seconds the first time the ball rolls through, and only then', () => {
    const session = new Session(timed(10, {}, [clock(1.5, 0, 4)]));
    const added: number[] = [];
    session.on((e) => e.type === 'timeAdded' && added.push(e.seconds));
    const zone = session.zones.at(-1)!;
    expect(zone.spent).toBe(false);

    // Out through the clock, off the rail, and back through it.
    session.shoot({ x: 1, y: 0, z: 0 }, speed(9));
    const shotAt = session.world.tick;
    runUntilSettled(session);
    expect(session.stats.wallHits).toBeGreaterThan(0);
    expect(session.ball.position().x).toBeLessThan(1);
    expect(added).toEqual([4]);
    expect(zone.spent).toBe(true);
    expect(session.stats.cues.timeBonus).toBe(1);
    expect(session.timeLeft).toBe(600 + 240 - (session.world.tick - shotAt));

    // A second stroke through the same clock gives nothing.
    session.shoot({ x: 1, y: 0, z: 0 }, speed(5));
    runUntilSettled(session);
    expect(added).toEqual([4]);
    expect(session.stats.cues.timeBonus).toBe(1);
    session.dispose();
  });

  it('is fresh again after a restart', () => {
    const session = new Session(timed(10, {}, [clock(1.5, 0, 4)]));
    session.shoot({ x: 1, y: 0, z: 0 }, speed(5));
    runUntilSettled(session);
    expect(session.zones.at(-1)!.spent).toBe(true);
    session.reset();
    expect(session.zones.at(-1)!.spent).toBe(false);
    expect(session.timeLeft).toBe(600);
    session.shoot({ x: 1, y: 0, z: 0 }, speed(5));
    runUntilSettled(session);
    expect(session.stats.cues.timeBonus).toBe(1);
    session.dispose();
  });

  it('is not skipped by a ball at full power', () => {
    for (const offset of [0, 0.07, 0.15, 0.22]) {
      const session = new Session(timed(10, { tee: [-2 - offset, 0, 0] }, [clock(1.5, 0, 4)]));
      session.shoot({ x: 1, y: 0, z: 0 }, 1);
      stepTicks(session, 20);
      expect(session.stats.cues.timeBonus).toBe(1);
      session.dispose();
    }
  });

  it('can rescue a round that would otherwise have blown up', () => {
    const play = (clocks: ZoneDef[]) => {
      const session = new Session(timed(2, {}, clocks));
      session.shoot({ x: 1, y: 0, z: 0 }, speed(5));
      stepTicks(session, 150);
      const phase = session.phase;
      session.dispose();
      return phase;
    };
    expect(play([])).toBe('exploded');
    expect(play([clock(1.5, 0, 3)])).not.toBe('exploded');
  });
});

describe('challenges on timed holes', () => {
  it('judges time left and clocks picked up', () => {
    const stats = (change: (s: ReturnType<typeof emptyStats>) => void) => {
      const s = emptyStats();
      change(s);
      return s;
    };
    const fast = { type: 'timeLeft', seconds: 10, text };
    expect(challengeMet(fast, stats((s) => (s.timeLeft = 10)))).toBe(true);
    expect(challengeMet(fast, stats((s) => (s.timeLeft = 9.9)))).toBe(false);
    expect(challengeMet(fast, stats(() => {}))).toBe(false);
    const noClocks = { type: 'maxCues', cue: 'timeBonus', count: 0, text };
    expect(challengeMet(noClocks, stats(() => {}))).toBe(true);
    expect(challengeMet(noClocks, stats((s) => (s.cues.timeBonus = 1)))).toBe(false);
    expect(challengeMet({ ...noClocks, count: 1 }, stats((s) => (s.cues.timeBonus = 1)))).toBe(true);
  });

  it('records the time left when the hole is finished', () => {
    const hole = timed(10, { cup, challenge: { type: 'timeLeft', seconds: 8, text } });
    const session = new Session(hole);
    session.shoot({ x: 0, y: 0, z: -1 }, speed(2.8));
    const ticks = runUntilSettled(session);
    // The step the ball drops on costs no time: holing out beats the clock.
    expect(session.stats.timeLeft).toBeCloseTo(10 - (ticks - 1) / 60, 9);
    expect(session.outcome).toMatchObject({ holed: true, stars: 3, challengeMet: true });
    session.dispose();
  });
});
