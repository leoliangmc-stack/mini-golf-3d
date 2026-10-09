import { beforeAll, describe, expect, it } from 'vitest';
import { RULES } from '../src/game/rules';
import type { Echo, EchoPlate } from '../src/game/field/strange';
import type { Gate, Plate } from '../src/game/field/tomb';
import { playReplay } from '../src/game/replay';
import { Session } from '../src/game/session';
import type { HoleDef, MoverDef, PhantomDef } from '../src/level/schema';
import { DEFAULT_BALL } from '../src/physics/ball';
import { phantomDue } from '../src/physics/movers';
import { createZone, type ZoneContext } from '../src/physics/zones';
import { hall, hallOf, WRAP_APRON } from '../src/physics/zones/wrap';
import { PhysicsWorld } from '../src/physics/world';
import { Ball } from '../src/physics/ball';
import { boxHole, runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const r = DEFAULT_BALL.radius;
const speed = (metresPerSecond: number) => metresPerSecond / RULES.maxShotSpeed;

// --- Bridges that come and go (SPEC v8 3.2) -------------------------------------

/** Two banks with two metres of air between them, and one bridge across that comes and goes. */
function gapHole(phantom: PhantomDef, extra: Partial<MoverDef> = {}): HoleDef {
  const bridge: MoverDef = {
    role: 'platform',
    size: [1.6, 0.3, 2.2],
    position: [0, 0.004 - 0.15, 0],
    surface: 'grass',
    motion: { type: 'slide', offset: [0, 0, 0], period: 1 },
    phantom,
    ...extra,
  };
  return {
    ...boxHole({ tee: [0, 0, 3] }),
    pieces: [
      { type: 'floor', min: [-2, 1], max: [2, 5], surface: 'grass' },
      { type: 'floor', min: [-2, -6], max: [2, -1], surface: 'grass' },
      { type: 'wall', from: [-2, 5], to: [2, 5], surface: 'rail' },
      { type: 'wall', from: [-2, -6], to: [2, -6], surface: 'rail' },
    ],
    movers: [bridge],
  };
}

describe('bridges that come and go (SPEC v8 3.2)', () => {
  // There for the first two seconds of every four.
  const blink: PhantomDef = { period: 4, shown: 0.5 };

  it('is there for its share of every cycle, to the tick', () => {
    expect(phantomDue(blink, 0)).toBe(true);
    expect(phantomDue(blink, 119)).toBe(true);
    expect(phantomDue(blink, 120)).toBe(false);
    expect(phantomDue(blink, 239)).toBe(false);
    expect(phantomDue(blink, 240)).toBe(true);
    expect(phantomDue({ ...blink, phase: 0.5 }, 0)).toBe(false);
    expect(phantomDue({ ...blink, phase: 0.5 }, 120)).toBe(true);

    const session = new Session(gapHole(blink));
    const seen: boolean[] = [];
    for (let tick = 0; tick < 480; tick++) {
      session.step();
      seen.push(session.movers[0].present);
    }
    expect(seen.every((present, tick) => present === phantomDue(blink, tick))).toBe(true);
    session.dispose();
  });

  it('carries a ball across while it is there, and is nothing at all while it is gone', () => {
    const across = new Session(gapHole(blink));
    stepTicks(across, 5);
    across.shoot({ x: 0, y: 0, z: -1 }, speed(7));
    let lowest = Infinity;
    while (across.phase === 'rolling') {
      across.step();
      lowest = Math.min(lowest, across.ball.position().y);
    }
    // Never more than the hair a platform stands above the ground it joins.
    expect(lowest).toBeGreaterThan(r - 0.001);
    expect(across.ball.position().z).toBeLessThan(-1);
    expect(across.strokes).toBe(1);
    across.dispose();

    const gone = new Session(gapHole(blink));
    stepTicks(gone, 130);
    expect(gone.movers[0].present).toBe(false);
    // No collider is left behind for a ray to find: the ball over the gap is in the air.
    gone.shoot({ x: 0, y: 0, z: -1 }, speed(7));
    runUntilSettled(gone);
    expect(gone.stats.outOfBounds).toBe(1);
    expect(gone.strokes).toBe(2);
    expect(gone.ball.position().z).toBeCloseTo(3, 3);
    gone.dispose();
  });

  it('drops a ball that is on it when it goes', () => {
    const session = new Session(gapHole(blink));
    // A slow roll that is half way over when the two seconds are up.
    stepTicks(session, 70);
    session.shoot({ x: 0, y: 0, z: -1 }, speed(4));
    let onBridgeAtTheEnd = false;
    while (session.phase === 'rolling') {
      if (session.world.tick === 120) onBridgeAtTheEnd = Math.abs(session.ball.position().z) < 0.9;
      session.step();
    }
    expect(onBridgeAtTheEnd).toBe(true);
    expect(session.stats.outOfBounds).toBe(1);
    session.dispose();
  });

  it('moves a ball that stops on it to a safe spot, like any moving part', () => {
    const lasting: PhantomDef = { period: 30, shown: 0.9 };
    const session = new Session(gapHole(lasting, { rest: [[0, 0, -2]] }));
    stepTicks(session, 5);
    // Just enough to die on the bridge.
    session.shoot({ x: 0, y: 0, z: -1 }, speed(3.4));
    let last = { ...session.ball.position() };
    while (session.phase === 'rolling') {
      last = { ...session.ball.position() };
      session.step();
    }
    expect(Math.abs(last.z)).toBeLessThan(1);
    const p = session.ball.position();
    expect([p.x, p.z]).toEqual([0, -2]);
    expect(session.strokes).toBe(1);
    expect(session.stats.outOfBounds).toBe(0);
    session.dispose();
  });

  it('keeps the stroke open under a ball that stops on one that holds, until it goes and the ball with it', () => {
    const holding: PhantomDef = { period: 12, shown: 0.5, holds: true };
    const session = new Session(gapHole(holding));
    stepTicks(session, 5);
    session.shoot({ x: 0, y: 0, z: -1 }, speed(3.4));
    let stoodStill = 0;
    let fellAt = -1;
    while (session.phase === 'rolling') {
      session.step();
      const p = session.ball.position();
      if (session.world.tick < 360 && session.ball.speed() < 0.01 && Math.abs(p.z) < 1) stoodStill++;
      if (fellAt < 0 && p.y < -0.5) fellAt = session.world.tick;
    }
    // It lay there for seconds, and the stroke did not end.
    expect(stoodStill).toBeGreaterThan(120);
    expect(fellAt).toBeGreaterThanOrEqual(360);
    expect(session.stats.outOfBounds).toBe(1);
    expect(session.strokes).toBe(2);
    expect(session.ball.position().z).toBeCloseTo(3, 3);
    session.dispose();
  });

  it('does not come back into a ball that is in its place: it waits for the ball to have gone', () => {
    const session = new Session(gapHole(blink));
    stepTicks(session, 238);
    expect(session.movers[0].present).toBe(false);
    // A ball dropping through the gap, its underside already below where the top face will be.
    session.ball.teleport({ x: 0, y: 0.004 + r - 0.06, z: 0 });
    let rose = false;
    let waited = 0;
    for (let i = 0; i < 30; i++) {
      session.step();
      if (session.ball.velocity().y > 0) rose = true;
      if (phantomDue(blink, session.world.tick - 1) && !session.movers[0].present) waited++;
    }
    // Due back on tick 240, it stayed away while the ball was passing, and never threw it up.
    expect(waited).toBeGreaterThan(0);
    expect(rose).toBe(false);
    expect(session.movers[0].present).toBe(true);
    expect(session.ball.position().y).toBeLessThan(-0.3);
    session.dispose();
  });

  it('plays the same stroke over it the same way every time', () => {
    const play = () => {
      const session = new Session(gapHole(blink));
      stepTicks(session, 70);
      session.shoot({ x: 0.03, y: 0, z: -1 }, speed(6));
      runUntilSettled(session);
      const p = session.ball.position();
      const result = [p.x, p.y, p.z, session.world.tick, session.strokes];
      session.dispose();
      return result;
    };
    expect(play()).toStrictEqual(play());
  });
});

// --- Halls with joined edges (SPEC v8 3.3) --------------------------------------

/** A hall eight metres by six, with a skirt of ground a metre wide beyond each joined edge. */
function hallHole(joined: { x?: boolean; z?: boolean }, overrides: Partial<HoleDef> = {}): HoleDef {
  const sx = joined.x ? 1 : 0;
  const sz = joined.z ? 1 : 0;
  return {
    ...boxHole({ tee: [0, 0, 0] }),
    pieces: [
      { type: 'floor', min: [-4 - sx, -3 - sz], max: [4 + sx, 3 + sz], surface: 'grass' },
      ...(joined.x
        ? []
        : ([
            { type: 'wall', from: [-4, -3 - sz], to: [-4, 3 + sz], surface: 'rail' },
            { type: 'wall', from: [4, -3 - sz], to: [4, 3 + sz], surface: 'rail' },
          ] as const)),
      ...(joined.z
        ? []
        : ([
            { type: 'wall', from: [-4 - sx, -3], to: [4 + sx, -3], surface: 'rail' },
            { type: 'wall', from: [-4 - sx, 3], to: [4 + sx, 3], surface: 'rail' },
          ] as const)),
    ],
    zones: [
      { type: 'outOfBounds', shape: { kind: 'box', center: [0, -7, 0], halfExtents: [60, 5, 60] } },
      hall([-4, -3], [4, 3], joined),
    ],
    ...overrides,
  };
}

const wraps = (session: Session): number => session.stats.cues.wrap ?? 0;

describe('halls with joined edges (SPEC v8 3.3)', () => {
  it('reads a hall back from its data', () => {
    expect(hallOf(hall([-4, -3], [4, 3], { x: true }))).toEqual({ min: [-4, -3], max: [4, 3], y: 0, x: true, z: false, skirt: 2.5 });
    expect(hallOf(hall([0, 0], [6, 6], { x: true, z: true }, 1, 2))).toEqual({ min: [0, 0], max: [6, 6], y: 1, x: true, z: true, skirt: 2 });
  });

  it('takes a ball across with its speed and its place along the edge untouched, to the last bit', () => {
    const world = new PhysicsWorld([0, -RULES.gravity, 0]);
    const zone = createZone(hall([-4, -3], [4, 3], { x: true, z: true }));
    const ball = new Ball(world, DEFAULT_BALL, [4.21, r, 1.2345]);
    let snapped = 0;
    const cues: string[] = [];
    const ctx = {
      world,
      ball,
      emit: (event: { type: string; name?: string }) => cues.push(event.name ?? event.type),
      snap: () => snapped++,
    } as unknown as ZoneContext;
    ball.body.setLinvel({ x: 6.5, y: 0, z: -2.25 }, true);
    const before = { p: { ...ball.position() }, v: { ...ball.velocity() } };
    zone.preStep(ctx);
    const p = ball.position();
    expect({ ...ball.velocity() }).toStrictEqual(before.v);
    expect(p.z).toBe(before.p.z);
    expect(p.y).toBe(before.p.y);
    expect(p.x).toBe(Math.fround(before.p.x - 8));
    expect(snapped).toBe(1);
    expect(cues).toEqual(['wrap']);

    // Not again: it is inside now, and going further in.
    zone.preStep(ctx);
    expect(ball.position().x).toBe(p.x);
    expect(snapped).toBe(1);

    // Out by the near edge, in by the far one.
    ball.body.setTranslation({ x: 0.5, y: r, z: 3.1 }, true);
    ball.body.setLinvel({ x: 0, y: 0, z: 3 }, true);
    zone.preStep(ctx);
    expect(ball.position().z).toBe(Math.fround(Math.fround(3.1) - 6));
    expect(ball.position().x).toBe(0.5);

    // By a corner, both at once.
    ball.body.setTranslation({ x: -4.1, y: r, z: -3.2 }, true);
    ball.body.setLinvel({ x: -5, y: 0, z: -5 }, true);
    zone.preStep(ctx);
    expect(ball.position().x).toBe(Math.fround(Math.fround(-4.1) + 8));
    expect(ball.position().z).toBe(Math.fround(Math.fround(-3.2) + 6));
    expect(snapped).toBe(3);
    world.free();
  });

  it('leaves alone a ball that is over the line but not going out, or too far off to be crossing', () => {
    const world = new PhysicsWorld([0, -RULES.gravity, 0]);
    const zone = createZone(hall([-4, -3], [4, 3], { x: true }));
    const ball = new Ball(world, DEFAULT_BALL, [4.2, r, 0]);
    let snapped = 0;
    const ctx = { world, ball, emit: () => {}, snap: () => snapped++ } as unknown as ZoneContext;
    const tries: [x: number, y: number, z: number, vx: number, vz: number][] = [
      [4.2, r, 0, -3, 0], // over the line, coming back in
      [4.2, r, 0, 0, 0], // lying there
      [4 + WRAP_APRON + 0.3, r, 0, 5, 0], // well beyond: another part of the course
      [4.2, r, 3 + WRAP_APRON + 0.3, 5, 0], // off the end of the edge
      [4.2, r + 1.5, 0, 5, 0], // far above the floor
      [0, r, 3.2, 0, 5], // over an edge that is not joined
    ];
    for (const [x, y, z, vx, vz] of tries) {
      ball.body.setTranslation({ x, y, z }, true);
      ball.body.setLinvel({ x: vx, y: 0, z: vz }, true);
      zone.preStep(ctx);
      expect(ball.position().x).toBe(Math.fround(x));
      expect(ball.position().z).toBe(Math.fround(z));
    }
    expect(snapped).toBe(0);
    world.free();
  });

  it('rolls a ball over a joined edge as over plain ground: no drop, no bump, no speed lost', () => {
    const shot = (def: HoleDef) => {
      const session = new Session(def);
      stepTicks(session, 5);
      session.shoot({ x: 1, y: 0, z: 0.1 }, speed(8));
      let low = Infinity;
      let high = -Infinity;
      while (session.phase === 'rolling') {
        session.step();
        low = Math.min(low, session.ball.position().y);
        high = Math.max(high, session.ball.position().y);
      }
      const p = { ...session.ball.position() };
      const result = { p, low, high, wraps: wraps(session), ticks: session.world.tick };
      session.dispose();
      return result;
    };
    const joined = shot(hallHole({ x: true }));
    // The same stroke on one long floor, with nothing to cross.
    const plain = shot({
      ...boxHole({ tee: [0, 0, 0] }),
      pieces: [{ type: 'floor', min: [-5, -3], max: [20, 3], surface: 'grass' }],
    });
    expect(joined.wraps).toBe(1);
    expect(joined.low).toBeGreaterThan(r - 0.001);
    expect(joined.high).toBeLessThan(r + 0.001);
    expect(joined.ticks).toBe(plain.ticks);
    expect(joined.p.x).toBeCloseTo(plain.p.x - 8, 3);
    expect(joined.p.z).toBeCloseTo(plain.p.z, 3);
  });

  it('never lets a ball out, however hard it is struck, and never sends one back and forth over a line', () => {
    for (let n = 0; n < 48; n++) {
      // Joined all round, and joined left to right only: with one pair, two crossings
      // are never nearer than the hall is wide.
      const torus = n < 24;
      const session = new Session(hallHole(torus ? { x: true, z: true } : { x: true }));
      stepTicks(session, 5);
      const angle = (n / 24) * Math.PI * 2 + 0.07;
      session.shoot({ x: Math.sin(angle), y: 0, z: Math.cos(angle) }, [1, 0.55, 0.25][n % 3]);
      let lowest = Infinity;
      let crossings = 0;
      let last = 0;
      let quickest = Infinity;
      session.on((event) => {
        if (event.type !== 'cue' || event.name !== 'wrap') return;
        if (crossings > 0) quickest = Math.min(quickest, session.world.tick - last);
        crossings++;
        last = session.world.tick;
      });
      while (session.phase === 'rolling') {
        session.step();
        lowest = Math.min(lowest, session.ball.position().y);
      }
      const p = session.ball.position();
      expect(lowest).toBeGreaterThan(r - 0.001);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(4 + WRAP_APRON);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(3 + WRAP_APRON);
      expect(session.stats.outOfBounds).toBe(0);
      // A full stroke goes round more than once. Eight metres at 18 m/s is 26 ticks:
      // no two crossings of the one pair are ever nearer than that.
      if (torus && n % 3 === 0) expect(crossings).toBeGreaterThan(2);
      if (!torus) expect(quickest).toBeGreaterThan(25);
      session.dispose();
    }
  });

  it('crosses a ball that dies right on the line once, and leaves it where it stopped', () => {
    for (const metres of [3.9, 3.95, 4, 4.05, 4.1, 4.2]) {
      const session = new Session(hallHole({ x: true }));
      stepTicks(session, 5);
      // v0 for a roll of that length on grass: found by stepping, so the ball stops within centimetres of the line.
      let low = 0;
      let high = 10;
      for (let i = 0; i < 30; i++) {
        const mid = (low + high) / 2;
        const trial = new Session({ ...boxHole({ tee: [0, 0, 0] }), pieces: [{ type: 'floor', min: [-5, -3], max: [20, 3], surface: 'grass' }] });
        trial.shoot({ x: 1, y: 0, z: 0 }, speed(mid));
        runUntilSettled(trial);
        if (trial.ball.position().x < metres) low = mid;
        else high = mid;
        trial.dispose();
      }
      session.shoot({ x: 1, y: 0, z: 0 }, speed(high));
      runUntilSettled(session);
      expect(wraps(session)).toBeLessThanOrEqual(1);
      const rest = { ...session.ball.position() };
      stepTicks(session, 120);
      expect({ ...session.ball.position() }).toStrictEqual(rest);
      expect(session.phase).toBe('aiming');
      session.dispose();
    }
  });
});

// --- The mirror and the shadow ball (SPEC v8 3.4) ---------------------------------

/**
 * Two rooms side by side with a wall between them where the mirror stands: the player's
 * on the left, the shadow's on the right. `open` leaves one outer wall out, for a ball
 * to leave the course by.
 */
function mirrorHole(overrides: Partial<HoleDef> = {}, open: 'none' | 'left' | 'right' = 'none', shadowFloor = 'grass'): HoleDef {
  return {
    ...boxHole({ tee: [-3, 0, 3] }),
    pieces: [
      { type: 'floor', min: [-6, -5], max: [0, 5], surface: 'grass' },
      { type: 'floor', min: [0, -5], max: [6, 5], surface: shadowFloor },
      { type: 'wall', from: [0, -5], to: [0, 5], surface: 'rail' },
      { type: 'wall', from: [-6, -5], to: [6, -5], surface: 'rail' },
      { type: 'wall', from: [-6, 5], to: [6, 5], surface: 'rail' },
      ...(open === 'left' ? [] : ([{ type: 'wall', from: [-6, -5], to: [-6, 5], surface: 'rail' }] as const)),
      ...(open === 'right' ? [] : ([{ type: 'wall', from: [6, -5], to: [6, 5], surface: 'rail' }] as const)),
    ],
    mirror: { axis: 'x', at: 0, span: [-5, 5] },
    ...overrides,
  };
}

describe('the mirror and the shadow ball (SPEC v8 3.4)', () => {
  it("starts the shadow at the tee's reflection, or wherever the hole says", () => {
    const session = new Session(mirrorHole());
    const shadow = session.shadow!;
    expect(session.balls.live).toEqual([session.ball, shadow]);
    expect(session.balls.playable).toEqual([session.ball]);
    expect(shadow.position().x).toBe(3);
    expect(shadow.position().z).toBe(3);
    session.dispose();

    const placed = new Session(mirrorHole({ mirror: { axis: 'x', at: 0, span: [-5, 5], shadow: [4, 0, -2] } }));
    expect(placed.shadow!.position().x).toBe(4);
    expect(placed.shadow!.position().z).toBe(-2);
    placed.dispose();

    const across = new Session({ ...mirrorHole(), tee: [-3, 0, 3], mirror: { axis: 'z', at: 0, span: [-6, 0] } });
    expect(across.shadow!.position().x).toBe(-3);
    expect(across.shadow!.position().z).toBe(-3);
    across.dispose();
  });

  it('strikes both balls at once, as hard as each other, in directions that are exact reflections', () => {
    for (const [x, z, power] of [[0.37, -1, 0.5], [-1, 0.21, 0.83], [-0.6, -0.8, 0.3]] as const) {
      const session = new Session(mirrorHole());
      stepTicks(session, 3);
      expect(session.shoot({ x, y: 0, z }, power)).toBe(true);
      const mine = { ...session.ball.velocity() };
      const theirs = { ...session.shadow!.velocity() };
      // Not nearly the same: the same, with one sign turned.
      expect(theirs).toStrictEqual({ x: -mine.x, y: mine.y, z: mine.z });
      session.dispose();
    }
    // A mirror across the course turns near into far instead.
    const session = new Session({ ...mirrorHole(), mirror: { axis: 'z', at: 6, span: [-6, 0] } });
    session.shoot({ x: 0.37, y: 0, z: -1 }, 0.4);
    const mine = { ...session.ball.velocity() };
    expect({ ...session.shadow!.velocity() }).toStrictEqual({ x: mine.x, y: mine.y, z: -mine.z });
    session.dispose();
  });

  it('strikes each from where it lies: the two drift apart, and the next stroke takes them as they are', () => {
    // A pillar in the shadow's room only: the same stroke ends differently on the two sides.
    const def = mirrorHole();
    const session = new Session({ ...def, pieces: [...def.pieces, { type: 'pillar', at: [3, 0], radius: 0.5, surface: 'rail' }] });
    stepTicks(session, 3);
    session.shoot({ x: 0, y: 0, z: -1 }, speed(7));
    runUntilSettled(session);
    const mine = { ...session.ball.position() };
    const theirs = { ...session.shadow!.position() };
    expect(mine.z).toBeLessThan(-0.5);
    expect(theirs.z).toBeGreaterThan(0.5);
    session.shoot({ x: -1, y: 0, z: 0 }, speed(3));
    session.step();
    // One step on, each has moved from its own place, in its own direction.
    expect(session.ball.position().x).toBeLessThan(mine.x);
    expect(session.ball.position().z).toBeCloseTo(mine.z, 2);
    expect(session.shadow!.position().x).toBeGreaterThan(theirs.x);
    expect(session.shadow!.position().z).toBeCloseTo(theirs.z, 2);
    session.dispose();
  });

  it('is one input a stroke, as ever: a replay file says nothing of the shadow', () => {
    const session = new Session(mirrorHole());
    stepTicks(session, 3);
    session.shoot({ x: 0.2, y: 0, z: -1 }, 0.4);
    runUntilSettled(session);
    expect(session.inputs).toEqual([{ type: 'shot', tick: 3, dir: [0.2, 0, -1], power: 0.4 }]);
    session.dispose();
  });

  it('does not end the stroke until both balls have stopped', () => {
    // Ice under the shadow: it rolls on long after the player's ball has stopped.
    const session = new Session(mirrorHole({}, 'none', 'ice'));
    stepTicks(session, 3);
    session.shoot({ x: 0, y: 0, z: -1 }, speed(5));
    let mineStopped = -1;
    let waitedOnShadow = 0;
    while (session.phase === 'rolling') {
      session.step();
      if (mineStopped < 0 && session.ball.speed() < 0.01) mineStopped = session.world.tick;
      if (mineStopped >= 0 && session.shadow!.speed() > 0.2) waitedOnShadow++;
    }
    expect(mineStopped).toBeGreaterThan(0);
    expect(waitedOnShadow).toBeGreaterThan(30);
    expect(session.shadow!.speed()).toBe(0);
    expect(session.strokes).toBe(1);
    session.dispose();
  });

  it('puts a shadow that leaves the course back where the stroke found it, and charges nothing', () => {
    const session = new Session(mirrorHole({}, 'right'));
    stepTicks(session, 3);
    // A first stroke, so that where the shadow goes back to is not where it started.
    session.shoot({ x: 0, y: 0, z: -1 }, speed(4));
    runUntilSettled(session);
    const shadowWas = { ...session.shadow!.position() };
    const strokes = session.strokes;
    const events: string[] = [];
    session.on((event) => events.push(event.type === 'cue' ? event.name : event.type));
    // To the left for the player, so to the right for the shadow, and off the edge.
    session.shoot({ x: -1, y: 0, z: 0 }, speed(9));
    runUntilSettled(session);
    expect(events).toContain('shadowBack');
    expect(events).not.toContain('outOfBounds');
    expect(session.strokes).toBe(strokes + 1);
    expect(session.stats.outOfBounds).toBe(0);
    expect({ ...session.shadow!.position() }).toStrictEqual(shadowWas);
    // The player's ball is where its stroke took it, off the wall and back: only the shadow was put back.
    expect(Math.abs(session.ball.position().x + 3)).toBeGreaterThan(0.5);
    expect(session.phase).toBe('aiming');
    session.dispose();
  });

  it("takes the shadow back with the player's ball when that leaves the course, at the usual price", () => {
    const session = new Session(mirrorHole({}, 'left'));
    stepTicks(session, 3);
    session.shoot({ x: 0, y: 0, z: -1 }, speed(4));
    runUntilSettled(session);
    const mineWas = { ...session.ball.position() };
    const shadowWas = { ...session.shadow!.position() };
    session.shoot({ x: -1, y: 0, z: 0 }, speed(9));
    runUntilSettled(session);
    expect(session.stats.outOfBounds).toBe(1);
    expect(session.strokes).toBe(3);
    expect({ ...session.ball.position() }).toStrictEqual(mineWas);
    expect({ ...session.shadow!.position() }).toStrictEqual(shadowWas);
    expect(session.shadow!.speed()).toBe(0);
    expect(session.phase).toBe('aiming');
    session.dispose();
  });

  it('never holes the shadow, and never lets it be picked or struck by itself', () => {
    // The cup lies on the shadow's side, right in its way.
    const session = new Session(mirrorHole({ goal: { type: 'cup', position: [3, 0, 0], radius: 0.3, captureSpeed: 9 } }));
    stepTicks(session, 3);
    expect(session.select(session.shadow!)).toBe(false);
    expect(session.shoot({ x: 0, y: 0, z: -1 }, 0.3, session.shadow!)).toBe(false);
    session.shoot({ x: 0, y: 0, z: -1 }, speed(4));
    let overCup = false;
    while (session.phase === 'rolling') {
      session.step();
      const p = session.shadow!.position();
      if (Math.hypot(p.x - 3, p.z) < 0.2) overCup = true;
    }
    expect(overCup).toBe(true);
    expect(session.outcome).toBeNull();
    expect(session.balls.sunk).toEqual([]);
    session.dispose();
  });

  it("opens a gate on the player's side with a plate on the shadow's, and puts all of it back with a stroke", () => {
    const def = mirrorHole({
      field: {
        parts: [
          { kind: 'plate', id: 'plate', at: [3, 0, 0], mode: 'latch' },
          { kind: 'gate', id: 'gate', from: [-6, -2], to: [0, -2], when: 'plate' },
        ],
      },
    });
    const session = new Session(def);
    stepTicks(session, 3);
    const plate = session.field!.part('plate') as Plate;
    const gate = session.field!.part('gate') as Gate;
    const before = JSON.stringify(session.field!.save());
    const shadowWas = { ...session.shadow!.position() };
    const mineWas = { ...session.ball.position() };
    session.shoot({ x: 0, y: 0, z: -1 }, speed(5));
    runUntilSettled(session);
    expect(plate.on).toBe(true);
    expect(gate.open).toBe(true);
    // The player's ball never went near the plate: it is a wall away.
    expect(session.ball.position().x).toBeLessThan(0);

    expect(session.canUndo).toBe(true);
    expect(session.undo()).toBe(true);
    expect(plate.on).toBe(false);
    expect(gate.open).toBe(false);
    expect(JSON.stringify(session.field!.save())).toBe(before);
    expect({ ...session.shadow!.position() }).toStrictEqual(shadowWas);
    expect({ ...session.ball.position() }).toStrictEqual(mineWas);
    expect(session.strokes).toBe(2);
    session.dispose();
  });

  it('wins the hole the moment the ball drops, without waiting for the shadow', () => {
    const session = new Session(
      mirrorHole({ goal: { type: 'cup', position: [-3, 0, 1], radius: 0.25, captureSpeed: 6 } }, 'none', 'ice'),
    );
    stepTicks(session, 3);
    session.shoot({ x: 0, y: 0, z: -1 }, speed(5));
    while (session.playing) session.step();
    expect(session.outcome).toMatchObject({ holed: true, strokes: 1 });
    // And the ball the round ends on is the player's, not the shadow.
    expect(session.ball).not.toBe(session.shadow);
    expect(session.ball.position().x).toBeLessThan(0);
    session.dispose();
  });

  it('only answers a stroke played where it can see: elsewhere the shadow stays put', () => {
    const def = mirrorHole({
      mirror: { axis: 'x', at: 0, span: [-5, 0], reach: { kind: 'box', center: [-3, 0.5, -2.5], halfExtents: [3, 1, 2.5] } },
    });
    const session = new Session(def);
    stepTicks(session, 60);
    expect(session.mirroring).toBe(false);
    const shadowWas = { ...session.shadow!.position() };
    session.shoot({ x: 0, y: 0, z: -1 }, speed(6));
    runUntilSettled(session);
    expect({ ...session.shadow!.position() }).toStrictEqual(shadowWas);
    expect(session.stats.cues.mirrorShot ?? 0).toBe(0);
    // Now the ball is in front of the mirror.
    expect(session.ball.position().z).toBeLessThan(0);
    expect(session.mirroring).toBe(true);
    session.shoot({ x: -1, y: 0, z: 0 }, speed(3));
    runUntilSettled(session);
    expect(session.shadow!.position().x).toBeGreaterThan(shadowWas.x + 0.5);
    expect(session.stats.cues.mirrorShot).toBe(1);
    session.dispose();
  });

  it('refuses a mirror on a hole that splits balls or has skills', () => {
    expect(() => new Session(mirrorHole({ maxBalls: 2 }))).toThrow(/mirror/);
    expect(() => new Session(mirrorHole({ skills: { freeze: 1 } }))).toThrow(/mirror/);
  });

  it('plays a round with a shadow the same way every time', () => {
    const def = mirrorHole({ goal: { type: 'cup', position: [-3, 0, -3], radius: 0.25, captureSpeed: 6 } });
    const inputs = [
      { type: 'shot' as const, tick: 5, dir: [0.4, 0, -1] as const, power: 0.5 },
      { type: 'shot' as const, tick: 900, dir: [-1, 0, 0.3] as const, power: 0.3 },
    ];
    const play = () => {
      const session = new Session(def);
      session.replay(inputs);
      while (session.replaying || session.phase === 'rolling') session.step();
      const a = session.ball.position();
      const b = session.shadow!.position();
      const result = [a.x, a.y, a.z, b.x, b.y, b.z, session.world.tick];
      session.dispose();
      return result;
    };
    expect(play()).toStrictEqual(play());
    expect(playReplay(def, inputs)).toStrictEqual(playReplay(def, inputs));
  });
});

// --- Echoes (SPEC v8 3.5) ----------------------------------------------------------

/**
 * A long room. Its near half is an echo zone with an echo plate in it; a gate across
 * the middle listens to that plate. A plain plate lies in the zone as well.
 */
function echoHole(mode: 'latch' | 'hold' = 'hold', overrides: Partial<HoleDef> = {}): HoleDef {
  return {
    ...boxHole({ tee: [0, 0, 6], par: 6 }),
    pieces: [
      { type: 'floor', min: [-3, -8], max: [3, 8], surface: 'grass' },
      { type: 'wall', from: [-3, -8], to: [3, -8], surface: 'rail' },
      { type: 'wall', from: [3, -8], to: [3, 8], surface: 'rail' },
      { type: 'wall', from: [3, 8], to: [-3, 8], surface: 'rail' },
      { type: 'wall', from: [-3, 8], to: [-3, -8], surface: 'rail' },
    ],
    field: {
      parts: [
        { kind: 'echo', id: 'zone', min: [-3, 0], max: [3, 8] },
        { kind: 'echoPlate', id: 'silver', at: [0, 0, 3], mode, radius: 0.5 },
        { kind: 'plate', id: 'plain', at: [1.5, 0, 4.5], mode: 'latch' },
        { kind: 'gate', id: 'gate', from: [-3, -1], to: [3, -1], when: 'silver', delay: 1 },
      ],
    },
    ...overrides,
  };
}

const zoneOf = (session: Session) => session.field!.part('zone') as Echo;
const silverOf = (session: Session) => session.field!.part('silver') as EchoPlate;

/** Plays a stroke to its end, keeping where the ball was before each step: what an echo zone hears. */
function strokeHeard(session: Session, dir: [number, number], metresPerSecond: number): { from: number; path: { x: number; y: number; z: number }[] } {
  const from = session.world.tick;
  expect(session.shoot({ x: dir[0], y: 0, z: dir[1] }, speed(metresPerSecond))).toBe(true);
  const path: { x: number; y: number; z: number }[] = [];
  while (session.phase === 'rolling') {
    path.push({ ...session.ball.position() });
    session.step();
  }
  path.push({ ...session.ball.position() });
  return { from, path };
}

describe('echoes (SPEC v8 3.5)', () => {
  it('plays the last stroke back in the zone tick for tick, in exactly the places the ball was', () => {
    const session = new Session(echoHole());
    stepTicks(session, 4);
    expect(zoneOf(session).now).toBeNull();
    // Out of the zone at the far end, off the gate, and back into it.
    const first = strokeHeard(session, [0.12, -1], 11);
    expect(first.path.some((p) => p.z < 0)).toBe(true);
    expect(first.path.at(-1)!.z).toBeGreaterThan(0);
    // Nothing is played back until the next stroke.
    stepTicks(session, 40);
    expect(zoneOf(session).now).toBeNull();

    const from = session.world.tick;
    expect(session.shoot({ x: 1, y: 0, z: 0 }, speed(1.5))).toBe(true);
    let compared = 0;
    let gaps = 0;
    for (let k = 0; k < first.path.length + 200; k++) {
      session.step();
      const was = first.path[Math.min(k, first.path.length - 1)];
      const inside = was.z >= 0;
      const echo = zoneOf(session).now;
      if (inside) {
        // Not close to where the ball was: the very numbers.
        expect(echo).toStrictEqual(was);
        compared++;
      } else {
        expect(echo).toBeNull();
        gaps++;
      }
    }
    expect(session.world.tick).toBe(from + first.path.length + 200);
    expect(compared).toBeGreaterThan(100);
    // It left the zone and came back: the echo was gone meanwhile.
    expect(gaps).toBeGreaterThan(10);
    session.dispose();
  });

  it('leaves the echo standing where the stroke ended, if that was in the zone, until the next stroke', () => {
    const session = new Session(echoHole());
    stepTicks(session, 4);
    const first = strokeHeard(session, [0, -1], 3.5);
    const end = first.path.at(-1)!;
    expect(end.z).toBeGreaterThan(0);
    const second = strokeHeard(session, [1, 0], 1.5);
    stepTicks(session, 600);
    expect(zoneOf(session).now).toStrictEqual(end);
    expect(zoneOf(session).on).toBe(true);
    // The next stroke sets the second one going instead, which began where the first ended and moved off.
    expect(session.shoot({ x: -1, y: 0, z: 0 }, speed(1.5))).toBe(true);
    for (let k = 0; k < 30; k++) {
      session.step();
      expect(zoneOf(session).now).toStrictEqual(second.path[k]);
    }
    expect(zoneOf(session).now).not.toStrictEqual(end);
    session.dispose();

    // A stroke that ends outside leaves nothing behind once it has been played back.
    const gone = new Session(echoHole('hold', { tee: [0, 0, 1] }));
    stepTicks(gone, 4);
    const leaving = strokeHeard(gone, [0, -1], 2);
    expect(leaving.path.at(-1)!.z).toBeLessThan(0);
    expect(gone.shoot({ x: 1, y: 0, z: 0 }, speed(1.5))).toBe(true);
    gone.step();
    expect(zoneOf(gone).now).toStrictEqual(leaving.path[0]);
    stepTicks(gone, leaving.path.length + 30);
    expect(zoneOf(gone).now).toBeNull();
    expect(zoneOf(gone).on).toBe(false);
    gone.dispose();
  });

  it('presses an echo plate with an echo and with nothing else, and a plain plate with a ball and not with an echo', () => {
    const session = new Session(echoHole());
    stepTicks(session, 4);
    const silver = silverOf(session);
    const plain = session.field!.part('plain') as Plate;
    const gate = session.field!.part('gate') as Gate;
    // The ball rolls onto the silver plate and stops there: nothing happens.
    const first = strokeHeard(session, [0, -1], 3.6);
    const end = first.path.at(-1)!;
    expect(Math.hypot(end.x, end.z - 3)).toBeLessThan(0.45);
    stepTicks(session, 60);
    expect(silver.pressed).toBe(false);
    expect(gate.open).toBe(false);

    // The next stroke rolls over the plain plate; meanwhile the echo of the first arrives on the silver one.
    const events: string[] = [];
    session.on((event) => event.type === 'cue' && events.push(event.name));
    const from = session.world.tick;
    session.shoot({ x: 1.5, y: 0, z: 4.5 - end.z }, speed(3));
    let pressedAt = -1;
    while (session.phase === 'rolling' || session.world.tick < from + first.path.length + 5) {
      session.step();
      if (pressedAt < 0 && silver.pressed) pressedAt = session.world.tick - from;
    }
    expect(events).toContain('echoStart');
    expect(events).toContain('echoPlateDown');
    expect(plain.on).toBe(true);
    // The echo took as long to get onto the plate as the ball had: neither sooner nor later.
    const ballOnPlate = first.path.findIndex((p) => Math.hypot(p.x, p.z - 3) <= 0.5);
    expect(pressedAt).toBeGreaterThan(20);
    expect(Math.abs(pressedAt - ballOnPlate)).toBeLessThanOrEqual(2);
    expect(silver.on).toBe(true);
    expect(gate.open).toBe(true);

    session.dispose();
  });

  it('lets go of a hold plate when the next stroke replaces the echo, and keeps a latch plate down', () => {
    for (const mode of ['hold', 'latch'] as const) {
      const session = new Session(echoHole(mode));
      stepTicks(session, 4);
      strokeHeard(session, [0, -1], 3.6);
      // A nudge sideways, off the plate; the echo of the first stroke comes to stand on it.
      strokeHeard(session, [1, 0], 3);
      stepTicks(session, 200);
      expect(silverOf(session).on).toBe(true);
      expect((session.field!.part('gate') as Gate).open).toBe(true);
      // Now the echo is of the nudge, which began on the plate and left it.
      expect(session.shoot({ x: 1, y: 0, z: 0 }, speed(1.5))).toBe(true);
      stepTicks(session, 150);
      expect(silverOf(session).pressed).toBe(false);
      expect(silverOf(session).on).toBe(mode === 'latch');
      expect((session.field!.part('gate') as Gate).open).toBe(mode === 'latch');
      session.dispose();
    }
  });

  it('goes back with a stroke: the echo is then of the stroke before the one taken back', () => {
    const session = new Session(echoHole());
    stepTicks(session, 4);
    const first = strokeHeard(session, [0, -1], 3.6);
    const second = strokeHeard(session, [1, 0.2], 2.5);
    stepTicks(session, 30);
    // As things stand before the third stroke: the first is being played back, the second was heard last.
    const before = session.field!.save();
    const zone = zoneOf(session);
    const heard = zone.heard;
    expect(heard!.at.length).toBeGreaterThan(10);
    const ballWas = { ...session.ball.position() };

    strokeHeard(session, [-1, -0.4], 4);
    expect(zone.heard).not.toBe(heard);
    expect(session.undo()).toBe(true);
    // The very same recordings, not copies that happen to match.
    const after = session.field!.save();
    expect(after).toStrictEqual(before);
    expect(zone.heard).toBe(heard);
    expect({ ...session.ball.position() }).toStrictEqual(ballWas);
    // The echo on the course is the first stroke's again, at rest where that ended.
    expect(zone.now).toStrictEqual(first.path.at(-1));
    expect(silverOf(session).pressed).toBe(true);
    expect((session.field!.part('gate') as Gate).open).toBe(true);

    // And the stroke played now sets the second one going, from its first tick.
    expect(session.shoot({ x: 0, y: 0, z: 1 }, speed(1.5))).toBe(true);
    for (let k = 0; k < 40; k++) {
      session.step();
      expect(zone.now).toStrictEqual(second.path[k]);
    }
    session.dispose();
  });

  it('does not hear a stroke that ends out of bounds', () => {
    const def = echoHole();
    const open: HoleDef = { ...def, pieces: def.pieces.filter((piece) => !(piece.type === 'wall' && piece.from[0] === 3 && piece.to[0] === 3)) };
    const session = new Session(open);
    stepTicks(session, 4);
    const first = strokeHeard(session, [0, -1], 3.6);
    const heard = zoneOf(session).heard;
    session.shoot({ x: 1, y: 0, z: 0 }, speed(9));
    runUntilSettled(session);
    expect(session.stats.outOfBounds).toBe(1);
    expect(zoneOf(session).heard).toBe(heard);
    // The next stroke still plays the first one back.
    expect(session.shoot({ x: -1, y: 0, z: 0 }, speed(1.5))).toBe(true);
    session.step();
    expect(zoneOf(session).now).toStrictEqual(first.path[0]);
    session.dispose();
  });

  it('makes a hole one where a stroke can be taken back', () => {
    const session = new Session(echoHole());
    expect(session.rewindable).toBe(true);
    session.dispose();
  });

  it('plays a round with echoes the same way every time', () => {
    const inputs = [
      { type: 'shot' as const, tick: 5, dir: [0, 0, -1] as const, power: speed(3.6) },
      { type: 'shot' as const, tick: 400, dir: [0.4, 0, -1] as const, power: speed(5) },
      { type: 'undo' as const, tick: 900 },
      { type: 'shot' as const, tick: 950, dir: [-0.3, 0, -1] as const, power: speed(9) },
    ];
    const play = () => {
      const session = new Session(echoHole());
      session.replay(inputs);
      const echoes: unknown[] = [];
      while (session.replaying || session.phase === 'rolling') {
        session.step();
        echoes.push(zoneOf(session).now);
      }
      const p = session.ball.position();
      const result = { end: [p.x, p.y, p.z, session.world.tick, session.strokes], echoes, field: session.field!.save() };
      session.dispose();
      return result;
    };
    const first = play();
    expect(first).toStrictEqual(play());
    expect(first.end[4]).toBe(4);
    expect(first.echoes.filter((echo) => echo !== null).length).toBeGreaterThan(100);
  });
});
