import { beforeAll, describe, expect, it } from 'vitest';
import type { Crumble, Float, Valve, Water } from '../src/game/field/elements';
import { Session } from '../src/game/session';
import type { PartDef } from '../src/level/field';
import type { HoleDef, PieceDef } from '../src/level/schema';
import type { ZoneDef } from '../src/physics/zones';
import { bubbles, stream } from '../src/physics/zones/water';
import { gustAt, gusts } from '../src/physics/zones/wind';
import { runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const FALL: ZoneDef = { type: 'outOfBounds', shape: { kind: 'box', center: [0, -8, 0], halfExtents: [60, 5, 60] } };
const RAILS: PieceDef[] = [
  { type: 'wall', from: [-5, -8], to: [5, -8], surface: 'rail' },
  { type: 'wall', from: [5, -8], to: [5, 8], surface: 'rail' },
  { type: 'wall', from: [5, 8], to: [-5, 8], surface: 'rail' },
  { type: 'wall', from: [-5, 8], to: [-5, -8], surface: 'rail' },
];

/** A walled lane ten metres wide and sixteen long, the tee near its south end. */
function lane(extra: Partial<HoleDef> = {}, floors?: PieceDef[]): HoleDef {
  return {
    id: 'lane',
    par: 4,
    tee: [0, 0, 6],
    goal: { type: 'cup', position: [4.5, 0, -7.5], radius: 0.22, captureSpeed: 3.5 },
    pieces: [...(floors ?? [{ type: 'floor', min: [-5, -8], max: [5, 8], surface: 'grass' } as const]), ...RAILS],
    zones: [FALL],
    outOfBounds: 'lastPosition',
    ...extra,
  };
}

const NORTH = { x: 0, y: 0, z: -1 };
const SOUTH = { x: 0, y: 0, z: 1 };
const place = (session: Session, x: number, z: number, y = 0.1) => session.ball.teleport({ x, y, z });
const part = <T>(session: Session, id: string): T => session.field!.part(id) as unknown as T;

describe('currents (SPEC v5 3.2, 7.4 #2)', () => {
  // Water flowing north at 3 m/s over the middle six metres of the lane.
  const river = lane({ zones: [FALL, stream([-5, -3], [5, 3], [0, -3])] });
  const inWater = (z: number) => z > -3 && z < 3;

  it('carries a ball that was barely tapped, and never faster than the water', () => {
    const session = new Session(river);
    session.shoot(NORTH, 0.25);
    let fastest = 0;
    for (let i = 0; i < 3000 && session.phase === 'rolling'; i++) {
      session.step();
      const { z } = session.ball.position();
      if (inWater(z) && z < 2) fastest = Math.max(fastest, -session.ball.velocity().z);
    }
    // On dry ground this tap goes four metres. The water took it the rest of the way.
    expect(session.ball.position().z).toBeLessThan(-3);
    expect(fastest).toBeGreaterThan(2);
    expect(fastest).toBeLessThanOrEqual(3);
    session.dispose();
  });

  it('does not go on adding speed the way a slope does: the ball settles at one pace', () => {
    const session = new Session(lane({ zones: [FALL, stream([-5, -60], [5, 60], [0, -3])] }, [
      { type: 'floor', min: [-5, -60], max: [5, 8], surface: 'grass' },
    ]));
    place(session, 0, 5);
    stepTicks(session, 120);
    const early = -session.ball.velocity().z;
    stepTicks(session, 120);
    const late = -session.ball.velocity().z;
    expect(early).toBeGreaterThan(2);
    expect(late).toBeLessThanOrEqual(3);
    expect(Math.abs(late - early)).toBeLessThan(0.01);
    session.dispose();
  });

  it('slows a ball that goes against it, stops it and brings it back', () => {
    const session = new Session(river);
    place(session, 0, -5);
    session.shoot(SOUTH, 0.5);
    let furthest = -Infinity;
    for (let i = 0; i < 3000 && session.phase === 'rolling'; i++) {
      session.step();
      furthest = Math.max(furthest, session.ball.position().z);
    }
    // It got into the water and nowhere near the far side of it.
    expect(furthest).toBeGreaterThan(-3);
    expect(furthest).toBeLessThan(2);
    expect(session.ball.position().z).toBeLessThan(-3);
    session.dispose();
  });

  it('slows down a ball that came in faster than the water', () => {
    const exitSpeed = (hole: HoleDef): number => {
      const session = new Session(hole);
      session.shoot(NORTH, 0.7);
      let speed = 0;
      for (let i = 0; i < 3000 && session.ball.position().z > -3; i++) {
        session.step();
        speed = -session.ball.velocity().z;
      }
      session.dispose();
      return speed;
    };
    expect(exitSpeed(river)).toBeLessThan(exitSpeed(lane()) - 1);
    // Down to the water's pace, less what the ground takes off any rolling ball.
    expect(exitSpeed(river)).toBeGreaterThan(2.2);
    expect(exitSpeed(river)).toBeLessThanOrEqual(3);
  });

  it('leaves a ball pinned against a wall at rest, to be played from there', () => {
    const session = new Session(lane({ zones: [FALL, stream([-5, -8], [5, 3], [0, -3])] }));
    session.shoot(NORTH, 0.2);
    runUntilSettled(session);
    expect(session.phase).toBe('aiming');
    expect(session.ball.position().z).toBeLessThan(-7.6);
    // Still there after a long wait: it does not creep, and the stroke does not reopen.
    const at = { ...session.ball.position() };
    stepTicks(session, 300);
    expect(Math.abs(session.ball.position().z - at.z)).toBeLessThan(0.02);
    session.dispose();
  });
});

describe('bubble columns (SPEC v5 3.2, 7.4 #3)', () => {
  const column = lane({ zones: [FALL, bubbles([0, 0, 0], 3, [0, 1, -3.5])] });

  it('lifts a ball in plain sight and sets it down in the same place however it came in', () => {
    const ride = (dir: { x: number; y: number; z: number }, power: number) => {
      const session = new Session(column);
      const cues: string[] = [];
      session.on((event) => event.type === 'cue' && cues.push(event.name));
      session.shoot(dir, power);
      let highest = 0;
      let rising = 0;
      let jumps = 0;
      let last = session.ball.position().y;
      for (let i = 0; i < 4000 && session.phase === 'rolling'; i++) {
        session.step();
        const y = session.ball.position().y;
        if (!session.ball.body.isEnabled()) {
          rising++;
          // Never more than a few centimetres a tick: it is carried, not moved in one go.
          if (Math.abs(y - last) > 0.06) jumps++;
        }
        highest = Math.max(highest, y);
        last = y;
      }
      const p = session.ball.position();
      session.dispose();
      return { end: [p.x, p.y, p.z], cues, highest, rising, jumps };
    };
    const soft = ride(NORTH, 0.3);
    const hard = ride(NORTH, 0.6);
    const aslant = ride({ x: 0.04, y: 0, z: -1 }, 0.45);
    expect(soft.cues).toEqual(['bubbleCatch', 'bubbleRelease']);
    expect(soft.highest).toBeGreaterThan(3);
    expect(soft.rising).toBeGreaterThan(60);
    expect(soft.jumps).toBe(0);
    // Let go from the top with the same velocity every time, it ends in the same place.
    expect(hard.end).toStrictEqual(soft.end);
    expect(aslant.end).toStrictEqual(soft.end);
    expect(soft.end[2]).toBeLessThan(-1.5);
  });

  it('does not take the ball again as it comes down past the foot', () => {
    // Let go almost straight up: it lands back beside the column a second later.
    const session = new Session(lane({ zones: [FALL, bubbles([0, 0, 0], 3, [0, 0.5, -1.2])] }));
    const cues: string[] = [];
    session.on((event) => event.type === 'cue' && cues.push(event.name));
    session.shoot(NORTH, 0.3);
    runUntilSettled(session);
    expect(cues).toEqual(['bubbleCatch', 'bubbleRelease']);
    expect(session.phase).toBe('aiming');
    session.dispose();
  });
});

describe('wind (SPEC v5 3.3, 7.4 #4, #5)', () => {
  const sky = { kind: 'box', center: [0, 4, 0], halfExtents: [8, 5, 10] } as const;
  // A deck two metres up at the south end: a ball rolled off it is in the air for 0.6 s.
  const deck: PieceDef[] = [
    { type: 'floor', min: [-5, -8], max: [5, 4], surface: 'grass' },
    { type: 'floor', min: [-1, 4], max: [1, 8], y: 2, depth: 2.4, surface: 'grass' },
  ];
  const windy = (shelters: Parameters<typeof gusts>[4] = []): HoleDef =>
    lane({ tee: [0, 2, 6], zones: [FALL, gusts(sky, [[7, 0], [-7, 0]], 3, [3, 0, 3], shelters)] }, deck);

  const drop = (hole: HoleDef, wait = 0): { landed: number; rolled: number } => {
    const session = new Session(hole);
    stepTicks(session, wait);
    session.shoot(NORTH, 0.2);
    // Sideways drift while still on the deck, and where it first touched the floor below.
    let rolled = 0;
    let landed = NaN;
    for (let i = 0; i < 3000 && session.phase === 'rolling'; i++) {
      session.step();
      const p = session.ball.position();
      if (p.z > 4.1) rolled = Math.max(rolled, Math.abs(p.x));
      if (Number.isNaN(landed) && p.z < 4 && p.y < 0.15) landed = p.x;
    }
    session.dispose();
    return { landed, rolled };
  };

  it('pushes a ball in the air and leaves one on the ground alone', () => {
    const east = drop(windy());
    expect(east.rolled).toBe(0);
    expect(east.landed).toBeGreaterThan(0.8);
  });

  it('blows the other way once the gust has changed, on the tick the hole says', () => {
    // Three seconds a gust: the second one starts on tick 180.
    const west = drop(windy(), 200);
    expect(west.rolled).toBe(0);
    expect(west.landed).toBeLessThan(-0.8);
    // The same stroke on the same tick meets the same wind.
    expect(drop(windy(), 200)).toStrictEqual(west);
    expect(drop(windy(), 17)).toStrictEqual(drop(windy(), 17));
  });

  it('does nothing inside a shelter', () => {
    const lee = { kind: 'box', center: [0, 2, 3], halfExtents: [3, 3, 2] } as const;
    expect(drop(windy([lee])).landed).toBe(0);
  });

  it('keeps time by the tick alone', () => {
    const def = gusts(sky, [[7, 0], [0, 0], [-7, 0]], 2, [0, 0, 0]);
    expect(gustAt(def, 0)).toMatchObject({ index: 0, x: 7, z: 0, left: 1, turning: false, next: { x: 0, z: 0 } });
    expect(gustAt(def, 119)).toMatchObject({ index: 0, turning: true });
    expect(gustAt(def, 120)).toMatchObject({ index: 1, x: 0, left: 1, next: { x: -7, z: 0 } });
    expect(gustAt(def, 240).index).toBe(2);
    expect(gustAt(def, 360).index).toBe(0);
    expect(gustAt(def, 60).left).toBe(0.5);
  });

  it('does not reach the zones that were there before: none of them asks about the ground', () => {
    // The 58 recorded rounds, which tests/solutions.test.ts replays to the last bit, are the proof.
    const session = new Session(lane({ zones: [FALL, { type: 'gravity', shape: sky, params: { gravity: [2, -9, 0] } }] }));
    session.shoot(NORTH, 0.3);
    runUntilSettled(session);
    expect(session.ball.position().x).toBeGreaterThan(0.5);
    session.dispose();
  });
});

/** Two banks with a pool between them, a raft in the pool and a valve that fills it. */
function pool(parts: PartDef[], extra: Partial<HoleDef> = {}): HoleDef {
  return lane(
    {
      tee: [0, 0, 6],
      field: {
        parts: [
          { kind: 'water', id: 'pool', min: [-5, -2], max: [5, 2], level: -1, levels: [{ level: -0.1, when: 'valve' }] },
          { kind: 'float', id: 'raft', water: 'pool', at: [0, 0], size: [2, 0.4, 4.2], freeboard: 0.104, surface: 'raft' },
          ...parts,
        ],
      },
      ...extra,
    },
    [
      { type: 'floor', min: [-5, 2], max: [5, 8], depth: 1.6, surface: 'grass' },
      { type: 'floor', min: [-5, -8], max: [5, -2], depth: 1.6, surface: 'grass' },
      // A ledge under the high water mark, on the east side of the pool.
      { type: 'floor', min: [3, -2], max: [5, 2], y: -0.6, depth: 1, surface: 'grass' },
    ],
  );
}

const VALVE: PartDef = { kind: 'valve', id: 'valve', at: [3, 0, 4] };

describe('valves, water and rafts (SPEC v5 3.4, 7.4 #6, #7)', () => {
  it('turns a valve with each knock, and the water follows it up and down', () => {
    const session = new Session(pool([VALVE]));
    const water = part<Water>(session, 'pool');
    const raft = part<Float>(session, 'raft');
    expect(raft.top).toBeCloseTo(-0.896, 9);

    session.shoot({ x: 3, y: 0, z: -2 }, 0.3);
    let moving = 0;
    for (let i = 0; i < 3000 && session.phase === 'rolling'; i++) {
      session.step();
      if (water.busy) moving++;
    }
    expect(part<Valve>(session, 'valve').open).toBe(true);
    // 0.9 m at 1.2 m/s: the surface took its time, and the stroke waited for it.
    expect(moving).toBeGreaterThan(40);
    expect(water.level).toBe(-0.1);
    expect(water.on).toBe(true);
    expect(raft.top).toBeCloseTo(0.004, 9);
    expect(raft.mover.pose.position.y).toBeCloseTo(0.004 - 0.2, 6);
    expect(session.field!.busy).toBe(false);

    // One more knock and it is back where it began: a valve cannot be got wrong for good.
    place(session, 0, 6);
    session.shoot({ x: 3, y: 0, z: -2 }, 0.3);
    runUntilSettled(session);
    expect(part<Valve>(session, 'valve').open).toBe(false);
    expect(water.level).toBe(-1);
    expect(water.on).toBe(false);
    session.dispose();
  });

  it('picks the first level whose signal is on, and the resting one when none is', () => {
    const session = new Session(
      lane({
        field: {
          parts: [
            { kind: 'valve', id: 'a', at: [3, 0, 4] },
            { kind: 'valve', id: 'b', at: [-3, 0, 4] },
            {
              kind: 'water',
              id: 'pool',
              min: [-5, -8],
              max: [5, -7],
              level: -1,
              speed: 60,
              levels: [
                { level: 0, when: { all: ['a'], none: ['b'] } },
                { level: -2, when: { all: ['b'], none: ['a'] } },
              ],
            },
          ],
        },
      }),
    );
    const water = part<Water>(session, 'pool');
    const turn = (id: string) => {
      part<Valve>(session, id).hit(session.ball, 1);
      stepTicks(session, 30);
    };
    expect(water.level).toBe(-1);
    turn('a');
    expect(water.level).toBe(0);
    turn('b');
    expect(water.level).toBe(-1);
    turn('a');
    expect(water.level).toBe(-2);
    turn('b');
    expect(water.level).toBe(-1);
    session.dispose();
  });

  it('is a bridge at high water and a drop at low water', () => {
    const high = new Session(pool([{ ...VALVE, open: true } as PartDef]));
    stepTicks(high, 90);
    high.shoot(NORTH, 0.55);
    let worst = 0;
    for (let i = 0; i < 3000 && high.phase === 'rolling'; i++) {
      high.step();
      const p = high.ball.position();
      // Level all the way across: no step up, no dip, no kick from the edge of the raft.
      if (p.z < 2.5 && p.z > -2.5) worst = Math.max(worst, Math.abs(p.y - 0.1));
    }
    expect(high.stats.outOfBounds).toBe(0);
    expect(high.ball.position().z).toBeLessThan(-2.5);
    expect(worst).toBeLessThan(0.012);
    high.dispose();

    const low = new Session(pool([VALVE]));
    low.shoot(NORTH, 0.3);
    runUntilSettled(low);
    // It rolled off the bank onto the raft lying a metre down, and is stuck in the pool.
    expect(low.ball.position().y).toBeLessThan(-0.6);
    low.dispose();
  });

  it('drowns a ball where the surface is now, not where it was', () => {
    const session = new Session(pool([VALVE]));
    // Dry on the ledge while the water is low.
    place(session, 4, 0, -0.5);
    stepTicks(session, 120);
    expect(session.stats.outOfBounds).toBe(0);
    part<Valve>(session, 'valve').hit(session.ball, 1);
    let drownedAt = NaN;
    session.on((event) => {
      if (event.type === 'outOfBounds') drownedAt = part<Water>(session, 'pool').level;
    });
    stepTicks(session, 120);
    expect(session.stats.outOfBounds).toBe(1);
    // Under as soon as the rising surface passed the middle of the ball.
    expect(drownedAt).toBeGreaterThan(-0.52);
    expect(drownedAt).toBeLessThan(-0.45);
    session.dispose();
  });

  it('lifts a ball that is on the raft, and the stroke is not over until they have arrived', () => {
    // The valve stands at the edge of the pool and reaches down into it: it can be struck from the raft.
    const session = new Session(pool([{ kind: 'valve', id: 'valve', at: [0, 0, 1.95], depth: 1.2 }]));
    place(session, 0, 0, -0.796);
    stepTicks(session, 30);
    expect(session.ball.position().y).toBeCloseTo(-0.796, 2);
    session.shoot(SOUTH, 0.2);
    const water = part<Water>(session, 'pool');
    let rising = 0;
    for (let i = 0; i < 3000 && session.phase === 'rolling'; i++) {
      session.step();
      if (water.busy) rising++;
      // The player is never handed the ball while the water is still on its way.
      expect((session.phase as string) === 'aiming' && water.busy).toBe(false);
    }
    expect(part<Valve>(session, 'valve').open).toBe(true);
    expect(rising).toBeGreaterThan(40);
    expect(water.level).toBe(-0.1);
    const p = session.ball.position();
    // Still on the raft, level with the banks.
    expect(Math.abs(p.x)).toBeLessThan(1);
    expect(p.y).toBeCloseTo(0.104, 2);
    expect(session.stats.outOfBounds).toBe(0);
    session.dispose();
  });

  it('rises and falls with a tide by the clock, and will not keep a ball', () => {
    const tidal = lane(
      {
        field: {
          parts: [
            { kind: 'water', id: 'lock', min: [-5, -2], max: [5, 2], level: -1, tide: { to: -0.1, period: 4, hold: [0.25, 0.25] } },
            { kind: 'float', id: 'raft', water: 'lock', at: [0, 0], size: [2, 0.4, 4.2], freeboard: 0.104, rest: [[0, 0, 3]], surface: 'raft' },
          ],
        },
      },
      [
        { type: 'floor', min: [-5, 2], max: [5, 8], depth: 1.6, surface: 'grass' },
        { type: 'floor', min: [-5, -8], max: [5, -2], depth: 1.6, surface: 'grass' },
      ],
    );
    const session = new Session(tidal);
    const water = part<Water>(session, 'lock');
    const seen: number[] = [];
    for (let i = 0; i < 240; i++) {
      session.step();
      seen.push(water.level);
    }
    expect(Math.min(...seen)).toBeCloseTo(-1, 6);
    expect(Math.max(...seen)).toBeCloseTo(-0.1, 6);
    // It never holds a stroke open, and it is not part of what a stroke goes back to.
    expect(session.field!.busy).toBe(false);
    expect(water.save()).toBeNull();
    // One whole tide later it is exactly where it was.
    const then = water.level;
    stepTicks(session, 240);
    expect(water.level).toBe(then);

    // A ball that stops on the raft is put on the bank.
    place(session, 0, 0, part<Float>(session, 'raft').top + 0.1);
    session.shoot(NORTH, 0.07);
    runUntilSettled(session);
    const p = session.ball.position();
    expect([p.x, p.z]).toEqual([0, 3]);
    session.dispose();
  });
});

/** Two cliffs with a bridge of three cracked slabs between them. */
function bridge(delay?: number, extra: Partial<HoleDef> = {}): HoleDef {
  const slab = (id: string, z: number): PartDef => ({ kind: 'crumble', id, at: [0, 0, z], size: [2, 1.7], delay });
  return lane(
    { field: { parts: [slab('first', 1.25), slab('second', -0.25), slab('third', -1.75)] }, ...extra },
    [
      { type: 'floor', min: [-5, 2], max: [5, 8], depth: 1.6, surface: 'grass' },
      { type: 'floor', min: [-5, -8], max: [5, -2.5], depth: 1.6, surface: 'grass' },
    ],
  );
}

describe('cracked bridges (SPEC v5 3.5, 7.4 #8)', () => {
  const fallen = (session: Session) => ['first', 'second', 'third'].map((id) => part<Crumble>(session, id).on);

  it('carries a rolling ball across the joins without a bump, and falls behind it', () => {
    const session = new Session(bridge());
    session.shoot({ x: 0.02, y: 0, z: -1 }, 0.5);
    let worstHeight = 0;
    let worstLift = 0;
    const headings: number[] = [];
    for (let i = 0; i < 3000 && session.phase === 'rolling'; i++) {
      session.step();
      const p = session.ball.position();
      const v = session.ball.velocity();
      if (p.z < 2.6 && p.z > -3.1) {
        worstHeight = Math.max(worstHeight, Math.abs(p.y - 0.1));
        worstLift = Math.max(worstLift, Math.abs(v.y));
        headings.push(v.x / v.z);
      }
    }
    // Four millimetres proud of the ground and no more; never thrown up; never turned aside.
    expect(worstHeight).toBeLessThan(0.006);
    expect(worstLift).toBeLessThan(0.3);
    expect(Math.max(...headings) - Math.min(...headings)).toBeLessThan(1e-3);
    expect(session.ball.position().z).toBeLessThan(-2.6);
    expect(fallen(session)).toEqual([true, true, true]);
    expect(session.field!.busy).toBe(false);
    // Nothing is left to stand on: the next ball that tries goes down.
    place(session, 0, 6);
    session.shoot(NORTH, 0.5);
    runUntilSettled(session);
    expect(session.stats.outOfBounds).toBe(1);
    session.dispose();
  });

  it('holds for as long as the ball stays on it, and falls when the ball has left', () => {
    const session = new Session(bridge());
    place(session, 0, 2.6);
    session.shoot(NORTH, 0.17);
    runUntilSettled(session);
    const z = session.ball.position().z;
    expect(z).toBeLessThan(0.3);
    expect(z).toBeGreaterThan(-1);
    // The one it crossed is gone; the one it is on has cracked and holds.
    expect(fallen(session)).toEqual([true, false, false]);
    expect(part<Crumble>(session, 'second').touched).toBe(true);
    stepTicks(session, 600);
    expect(fallen(session)).toEqual([true, false, false]);
    expect(session.stats.outOfBounds).toBe(0);
    session.shoot(NORTH, 0.3);
    runUntilSettled(session);
    expect(fallen(session)).toEqual([true, true, true]);
    session.dispose();
  });

  it('with a delay, falls on time whether the ball has left or not', () => {
    const session = new Session(bridge(40));
    // A stroke that stops on the bridge goes down with it, and is put back, bridge and all.
    const before = JSON.stringify(session.field!.save());
    session.shoot(NORTH, 0.32);
    runUntilSettled(session);
    expect(session.stats.outOfBounds).toBe(1);
    expect(session.strokes).toBe(2);
    expect(JSON.stringify(session.field!.save())).toBe(before);
    expect(fallen(session)).toEqual([false, false, false]);
    expect(session.ball.position().z).toBe(6);
    // Hard enough, and it is across before any of it goes.
    session.shoot(NORTH, 0.6);
    runUntilSettled(session);
    expect(session.stats.outOfBounds).toBe(1);
    expect(session.ball.position().z).toBeLessThan(-2.6);
    expect(fallen(session)).toEqual([true, true, true]);
    session.dispose();
  });

  it('never returns a ball to a slab that is no longer there', () => {
    // Stopped on the second slab, struck off it into the void: back on the slab, which is back too.
    const session = new Session(bridge());
    place(session, 0, 2.6);
    session.shoot(NORTH, 0.17);
    runUntilSettled(session);
    const on = { ...session.ball.position() };
    session.shoot({ x: 1, y: 0, z: 0 }, 0.3);
    runUntilSettled(session);
    expect(session.stats.outOfBounds).toBe(1);
    expect(session.phase).toBe('aiming');
    stepTicks(session, 30);
    const back = session.ball.position();
    expect([back.x, back.z]).toEqual([on.x, on.z]);
    expect(fallen(session)).toEqual([true, false, false]);
    stepTicks(session, 300);
    expect(session.stats.outOfBounds).toBe(1);
    expect(session.ball.position().y).toBeCloseTo(0.104, 2);
    session.dispose();
  });
});

describe('going back (SPEC v5 3.8, 7.4 #9, #10)', () => {
  const works = (): HoleDef =>
    pool(
      [
        { kind: 'valve', id: 'valve', at: [3, 0, 4] },
        { kind: 'crumble', id: 'slab', at: [-4, 0, 0], size: [1.6, 4.2] },
      ],
      { goal: { type: 'cup', position: [0, 0, -6], radius: 0.22, captureSpeed: 3.5 }, challenge: { type: 'noUndo', text: { en: 'x', zh: 'x' } } },
    );

  it('puts the valve, the water, the raft and the bridge back exactly, out of bounds or undone', () => {
    const session = new Session(works());
    const start = JSON.stringify(session.field!.save());
    // Fill the pool.
    session.shoot({ x: 3, y: 0, z: -2 }, 0.3);
    runUntilSettled(session);
    const filled = JSON.stringify(session.field!.save());
    expect(filled).not.toBe(start);
    // Cross the slab on the west side: it falls behind the ball.
    place(session, -4, 4);
    session.shoot(NORTH, 0.5);
    runUntilSettled(session);
    expect(part<Crumble>(session, 'slab').on).toBe(true);
    const crossed = JSON.stringify(session.field!.save());

    // Empty the pool again, then roll into it: out of bounds, and everything as before the stroke.
    place(session, 0, 6);
    session.shoot({ x: 3, y: 0, z: -2 }, 0.3);
    runUntilSettled(session);
    expect(part<Water>(session, 'pool').level).toBe(-1);
    const emptied = JSON.stringify(session.field!.save());
    place(session, -2.5, 6);
    session.shoot(NORTH, 0.4);
    runUntilSettled(session);
    expect(session.stats.outOfBounds).toBe(1);
    expect(JSON.stringify(session.field!.save())).toBe(emptied);

    // And back through the strokes, one at a time.
    expect(session.undo()).toBe(true);
    expect(JSON.stringify(session.field!.save())).toBe(crossed);
    expect(part<Float>(session, 'raft').mover.pose.position.y).toBeCloseTo(0.004 - 0.2, 6);
    expect(session.undo()).toBe(true);
    expect(JSON.stringify(session.field!.save())).toBe(filled);
    expect(part<Crumble>(session, 'slab').on).toBe(false);
    expect(part<Crumble>(session, 'slab').mover.pose.position.y).toBeCloseTo(0.004 - 0.15, 6);
    expect(session.undo()).toBe(true);
    expect(JSON.stringify(session.field!.save())).toBe(start);
    expect(part<Float>(session, 'raft').mover.pose.position.y).toBeCloseTo(-0.896 - 0.2, 6);
    session.dispose();
  });

  it('gives the third star only to a round with no stroke taken back', () => {
    const play = (undo: boolean) => {
      const session = new Session(works());
      session.shoot({ x: 3, y: 0, z: -2 }, 0.3);
      runUntilSettled(session);
      if (undo) {
        session.undo();
        session.shoot({ x: 3, y: 0, z: -2 }, 0.3);
        runUntilSettled(session);
      }
      place(session, 0, 6);
      session.shoot(NORTH, 0.62);
      runUntilSettled(session);
      const outcome = session.outcome;
      session.dispose();
      return outcome;
    };
    expect(play(false)).toMatchObject({ holed: true, strokes: 2, stars: 3, challengeMet: true });
    expect(play(true)).toMatchObject({ holed: true, strokes: 4, stars: 2, challengeMet: false });
  });
});
