import { beforeAll, describe, expect, it } from 'vitest';
import { playTo } from '../src/debug/search';
import type { Valve } from '../src/game/field/elements';
import type { Belt, Dial, Pulse, TimeZone } from '../src/game/field/machines';
import type { Gate } from '../src/game/field/tomb';
import { Session, type InputRecord } from '../src/game/session';
import type { PartDef } from '../src/level/field';
import type { HoleDef, MoverDef, PieceDef } from '../src/level/schema';
import { DEFAULT_BALL } from '../src/physics/ball';
import { moverPose } from '../src/physics/movers';
import type { ZoneDef } from '../src/physics/zones';
import { armAt, isArm, robotArm } from '../src/physics/zones/arm';
import { drumAt, drumPad } from '../src/physics/zones/drum';
import { runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const r = DEFAULT_BALL.radius;
const FALL: ZoneDef = { type: 'outOfBounds', shape: { kind: 'box', center: [0, -8, 0], halfExtents: [60, 5, 60] } };
const RAILS: PieceDef[] = [
  { type: 'wall', from: [-3, -10], to: [3, -10], surface: 'rail' },
  { type: 'wall', from: [3, -10], to: [3, 8], surface: 'rail' },
  { type: 'wall', from: [3, 8], to: [-3, 8], surface: 'rail' },
  { type: 'wall', from: [-3, 8], to: [-3, -10], surface: 'rail' },
];

/** A walled lane six metres wide and eighteen long, the tee near its south end. */
function lane(extra: Partial<HoleDef> = {}, floors?: PieceDef[]): HoleDef {
  return {
    id: 'lane',
    par: 4,
    tee: [0, 0, 6],
    goal: { type: 'cup', position: [2.5, 0, -9.5], radius: 0.22, captureSpeed: 3.5 },
    pieces: [...(floors ?? [{ type: 'floor', min: [-3, -10], max: [3, 8], surface: 'grass' } as const]), ...RAILS],
    zones: [FALL],
    outOfBounds: 'lastPosition',
    ...extra,
  };
}

const NORTH = { x: 0, y: 0, z: -1 };
const place = (session: Session, x: number, z: number, y = r) => session.ball.teleport({ x, y, z });
const part = <T>(session: Session, id: string): T => session.field!.part(id) as unknown as T;
const knock = (session: Session, id: string) =>
  (session.field!.part(id) as unknown as { hit(ball: unknown, speed: number): void }).hit(session.ball, 1);

describe('conveyor belts (SPEC v6 3.2, 7.4 #2)', () => {
  // A belt over the middle of the lane that runs south, toward the tee, until its lever is thrown.
  const works: PartDef[] = [
    { kind: 'valve', id: 'lever', at: [2.4, 0, 6.5], look: 'lever' },
    { kind: 'belt', id: 'belt', min: [-3, -4], max: [3, 3], velocity: [0, 3], when: 'lever' },
  ];
  const factory = lane({ field: { parts: works } });

  it('carries a ball the way water does: up to its pace and never beyond it', () => {
    const session = new Session(factory);
    knock(session, 'lever');
    stepTicks(session, 80);
    expect(part<Belt>(session, 'belt').flow).toBe(-1);
    session.shoot(NORTH, 0.25);
    let fastest = 0;
    for (let i = 0; i < 3000 && session.phase === 'rolling'; i++) {
      session.step();
      const { z } = session.ball.position();
      if (z < 2 && z > -4) fastest = Math.max(fastest, -session.ball.velocity().z);
    }
    // The tap alone would have stopped four metres on. The belt took it to its far end.
    expect(session.ball.position().z).toBeLessThan(-4);
    expect(fastest).toBeGreaterThan(2);
    expect(fastest).toBeLessThanOrEqual(3);
    session.dispose();
  });

  it('brings back a ball that is sent against it, however hard', () => {
    const session = new Session(factory);
    session.shoot(NORTH, 1);
    let furthest = 10;
    for (let i = 0; i < 3000 && session.phase === 'rolling'; i++) {
      session.step();
      furthest = Math.min(furthest, session.ball.position().z);
    }
    expect(furthest).toBeGreaterThan(-3.5);
    expect(session.ball.position().z).toBeGreaterThan(3);
    session.dispose();
  });

  it('turns round over half a second, and a ball on it goes smoothly round with it', () => {
    const session = new Session(factory);
    place(session, 0, 0);
    session.shoot(NORTH, 0.1);
    stepTicks(session, 60);
    const belt = part<Belt>(session, 'belt');
    expect(session.ball.velocity().z).toBeGreaterThan(2);
    knock(session, 'lever');
    let biggestStep = 0;
    let before = session.ball.velocity().z;
    const flows: number[] = [];
    for (let i = 0; i < 90; i++) {
      session.step();
      const now = session.ball.velocity().z;
      biggestStep = Math.max(biggestStep, Math.abs(now - before));
      before = now;
      flows.push(belt.flow);
    }
    // No jump: from one tick to the next the ball's speed never changes by more than a fifth of a metre a second.
    expect(biggestStep).toBeLessThan(0.2);
    expect(session.ball.velocity().z).toBeLessThan(-2);
    // The belt itself passed through every pace in between, and was busy while it did.
    expect(flows).toContain(0);
    expect(new Set(flows).size).toBeGreaterThan(30);
    expect(belt.flow).toBe(-1);
    expect(belt.on).toBe(true);
    expect(belt.busy).toBe(false);
    session.dispose();
  });

  it('never leaves a ball hanging on a belt that runs: the stroke ends only where the ball is stopped (SPEC v6 3.2)', () => {
    const session = new Session(factory);
    const belt = part<Belt>(session, 'belt');
    // Onto the belt against the way it runs: it is slowed, stopped and sent back.
    session.shoot(NORTH, 0.5);
    let slowest = Infinity;
    let ticksOnBelt = 0;
    for (let i = 0; i < 3000 && session.phase === 'rolling'; i++) {
      session.step();
      if (!belt.carries(session.ball)) continue;
      ticksOnBelt++;
      slowest = Math.min(slowest, session.ball.speed());
    }
    // It did turn round on the belt, passing through a standstill, and the stroke went on.
    expect(ticksOnBelt).toBeGreaterThan(20);
    expect(slowest).toBeLessThan(0.25);
    expect(session.phase).toBe('aiming');
    expect(belt.carries(session.ball)).toBe(false);
    session.dispose();
  });

  it('lets a ball rest where the belt has pressed it against a wall', () => {
    const blocked = lane({ field: { parts: [{ kind: 'belt', id: 'belt', min: [-3, -10], max: [3, 3], velocity: [0, -3] }] } });
    const session = new Session(blocked);
    session.shoot(NORTH, 0.3);
    runUntilSettled(session);
    expect(session.phase).toBe('aiming');
    expect(session.ball.position().z).toBeLessThan(-9.5);
    // And it stays there while the player aims.
    const at = { ...session.ball.position() };
    stepTicks(session, 300);
    expect(Math.abs(session.ball.position().z - at.z)).toBeLessThan(0.02);
    session.dispose();
  });

  it('is thrown by a real knock on its lever, and thrown back by the next', () => {
    const session = new Session(factory);
    const lever = part<Valve>(session, 'lever');
    const cues: string[] = [];
    session.on((event) => event.type === 'cue' && cues.push(event.name));
    place(session, 2.4, 7.4);
    session.shoot(NORTH, 0.3);
    runUntilSettled(session);
    expect(lever.open).toBe(true);
    expect(part<Belt>(session, 'belt').on).toBe(true);
    expect(cues).toContain('leverOn');
    expect(cues).toContain('beltTurn');
    expect(cues).not.toContain('valveOpen');
    session.dispose();
  });

  it('goes back with a stroke that is taken back, and with one that ends out of bounds (SPEC v6 3.7, 7.4 #8)', () => {
    const session = new Session(factory);
    place(session, 2.4, 7.4);
    session.shoot(NORTH, 0.3);
    runUntilSettled(session);
    const belt = part<Belt>(session, 'belt');
    expect(belt.flow).toBe(-1);
    expect(session.canUndo).toBe(true);
    session.undo();
    expect(part<Valve>(session, 'lever').open).toBe(false);
    expect(belt.flow).toBe(1);
    expect(belt.on).toBe(false);
    expect(session.strokes).toBe(2);
    session.dispose();
  });

  it('runs the way two levers say between them (SPEC v6 3.2: `when`)', () => {
    const both = lane({
      field: {
        parts: [
          { kind: 'valve', id: 'a', at: [2.4, 0, 6.5], look: 'lever' },
          { kind: 'valve', id: 'b', at: [-2.4, 0, 6.5], look: 'lever' },
          { kind: 'belt', id: 'belt', min: [-3, -4], max: [3, 3], velocity: [0, 3], when: { all: ['a'], none: ['b'] } },
        ],
      },
    });
    const session = new Session(both);
    const belt = part<Belt>(session, 'belt');
    const settle = () => stepTicks(session, 120);
    settle();
    expect(belt.flow).toBe(1);
    knock(session, 'b');
    settle();
    expect(belt.flow).toBe(1);
    knock(session, 'a');
    settle();
    expect(belt.flow).toBe(1);
    knock(session, 'b');
    settle();
    expect(belt.flow).toBe(-1);
    session.dispose();
  });
});

describe('works that only keep time bring no undo (SPEC v6 3.1)', () => {
  it('offers none on a hole whose only work is a belt that never turns', () => {
    const session = new Session(lane({ field: { parts: [{ kind: 'belt', id: 'belt', min: [-3, -4], max: [3, 3], velocity: [1, 0] }] } }));
    expect(session.field).not.toBeNull();
    expect(session.rewindable).toBe(false);
    session.shoot({ x: 1, y: 0, z: 0 }, 0.1);
    runUntilSettled(session);
    expect(session.canUndo).toBe(false);
    expect(session.undo()).toBe(false);
    session.dispose();
  });

  it('offers none on a hole of gates that keep the beat, and puts only the ball back when it is lost', () => {
    const hole = lane(
      {
        beat: { ticks: 30 },
        field: {
          parts: [
            { kind: 'pulse', id: 'beat', at: [2, 0, 0], pattern: [1, 1, 0, 0] },
            { kind: 'gate', id: 'gate', from: [-3, 0], to: [3, 0], when: 'beat', delay: 1, unlinked: true, look: 'shutter' },
          ],
        },
      },
      // Open sky to the west of the tee, to lose a ball in.
      [
        { type: 'floor', min: [-3, -10], max: [3, 8], surface: 'grass' },
      ],
    );
    const session = new Session({ ...hole, pieces: hole.pieces.filter((piece) => !(piece.type === 'wall' && piece.from[0] === -3 && piece.to[0] === -3)) });
    expect(session.rewindable).toBe(false);
    expect(session.field!.isClockwork('gate')).toBe(true);
    const gate = part<Gate>(session, 'gate');
    session.shoot({ x: -1, y: 0, z: 0 }, 0.6);
    let ticks = 0;
    while (session.stats.outOfBounds === 0 && ticks++ < 600) session.step();
    expect(session.stats.outOfBounds).toBe(1);
    expect(session.strokes).toBe(2);
    expect(session.canUndo).toBe(false);
    // The gate is where the beat has it, not where it was when the stroke was played.
    for (let i = 0; i < 240; i++) {
      const beat = Math.floor(session.world.tick / 30) % 4;
      session.step();
      expect(gate.open).toBe(beat < 2);
    }
    session.dispose();
  });

  it('still offers it on every shipped hole that had it', async () => {
    const { CHAPTERS } = await import('../src/data/chapters');
    const { stagesOf } = await import('../src/level/chapters');
    for (const chapter of CHAPTERS.slice(0, 5)) {
      for (const hole of stagesOf(chapter).flatMap((stage) => stage.holes)) {
        if (!hole.field) continue;
        const session = new Session(hole);
        expect(session.rewindable, hole.id).toBe(true);
        session.dispose();
      }
    }
  });
});

describe('robot arms (SPEC v6 3.3, 7.4 #3)', () => {
  // The pad north of the tee, two drops beyond it, one trip every two seconds.
  const drops = [
    [-2, 0, -6],
    [2, 0, -6],
  ] as const;
  const crane = robotArm([0, 0, 2], [4, 0, -2], drops, 2);
  const plant = lane({ zones: [FALL, crane] });
  const zone = (session: Session) => session.zones.find(isArm)!;

  it('goes round its drops in turn on the clock, and its lamp tells where the next trip goes', () => {
    // 120 ticks a trip: 30 at the pad, 42 out, 10 at the drop, 38 back.
    expect(armAt(crane, 0)).toMatchObject({ trip: 0, next: 0, leaving: false });
    expect(armAt(crane, 0).grip).toEqual({ x: 0, y: 0, z: 2 });
    expect(armAt(crane, 29).next).toBe(0);
    expect(armAt(crane, 30)).toMatchObject({ trip: 0, next: 1, leaving: true });
    expect(armAt(crane, 72)).toMatchObject({ arriving: true, grip: { x: -2, y: 0, z: -6 } });
    expect(armAt(crane, 119).next).toBe(1);
    expect(armAt(crane, 120)).toMatchObject({ trip: 1, next: 1 });
    expect(armAt(crane, 150)).toMatchObject({ trip: 1, next: 0, leaving: true });
    expect(armAt(crane, 192).grip).toEqual({ x: 2, y: 0, z: -6 });
    expect(armAt(crane, 240)).toEqual(armAt(crane, 0));
    // The countdown on the lamp runs out as the trip leaves.
    expect(armAt(crane, 29).left).toBeCloseTo(1 / 120, 9);
    expect(armAt(crane, 31).left).toBeCloseTo(119 / 120, 9);
    // It is carried high between the two ends, and comes straight down at each.
    expect(armAt(crane, 51).grip.y).toBeGreaterThan(1.5);
    expect(armAt(crane, 71).grip.x).toBeCloseTo(-2, 9);
  });

  it('holds a ball on its pad without the stroke ending, then sets it down at rest where the lamp said', () => {
    const session = new Session(plant);
    const cues: string[] = [];
    session.on((event) => event.type === 'cue' && cues.push(event.name));
    session.shoot(NORTH, 0.3);
    let caughtAt = -1;
    let promised = -1;
    let waited = 0;
    for (let i = 0; i < 2000 && session.phase === 'rolling'; i++) {
      session.step();
      if (caughtAt < 0 && zone(session).loaded) {
        caughtAt = session.world.tick;
        promised = zone(session).pose.next;
      }
      if (zone(session).loaded) {
        waited++;
        // Held by the arm: no stroke can be played, and none is asked for.
        expect(session.shoot(NORTH, 0.5)).toBe(false);
      }
    }
    expect(caughtAt).toBeGreaterThan(0);
    // It waited far longer than a ball needs to be judged at rest, and the stroke went on.
    expect(waited).toBeGreaterThan(60);
    expect(cues.filter((name) => name.startsWith('arm'))).toEqual(['armCatch', 'armLift', 'armRelease']);
    const drop = drops[promised];
    const p = session.ball.position();
    expect(p.x).toBeCloseTo(drop[0], 3);
    expect(p.z).toBeCloseTo(drop[2], 3);
    expect(p.y).toBeCloseTo(r, 2);
    expect(session.ball.speed()).toBe(0);
    expect(session.phase).toBe('aiming');
    expect(session.strokes).toBe(1);
    // The next stroke is played from the drop, like any other.
    expect(session.shoot(NORTH, 0.2)).toBe(true);
    session.dispose();
  });

  it('takes the ball to whichever drop its trip was in time for', () => {
    const ends = [20, 140].map((wait) => {
      const session = new Session(plant);
      stepTicks(session, wait);
      session.shoot(NORTH, 0.3);
      runUntilSettled(session);
      const x = session.ball.position().x;
      session.dispose();
      return x;
    });
    expect(ends[0]).toBeCloseTo(2, 3);
    expect(ends[1]).toBeCloseTo(-2, 3);
  });

  it('ends the same stroke on the same tick the same way every time', () => {
    const inputs: InputRecord[] = [{ type: 'shot', tick: 37, dir: [0.02, 0, -1], power: 0.33 }];
    const first = playTo(plant, inputs);
    const second = playTo(plant, inputs);
    expect({ ...second.ball.position() }).toStrictEqual({ ...first.ball.position() });
    expect(second.world.tick).toBe(first.world.tick);
    first.dispose();
    second.dispose();
  });

  it('leaves alone a ball it has just set down, and one that flies over its pad', () => {
    const session = new Session(plant);
    place(session, 0, 2, 1.2);
    stepTicks(session, 1);
    expect(zone(session).loaded).toBe(false);
    session.dispose();
  });
});

describe('the beat (SPEC v6 3.4, 7.4 #4)', () => {
  const pattern = [1, 1, 0, 0] as const;
  const hall = lane({
    beat: { ticks: 30 },
    field: {
      parts: [
        { kind: 'pulse', id: 'beat', at: [2, 0, 0], pattern },
        { kind: 'gate', id: 'gate', from: [-3, 0], to: [3, 0], when: 'beat', delay: 1, unlinked: true, look: 'shutter' },
      ],
    },
  });

  it('is a whole number of ticks, or the hole will not build', () => {
    expect(() => new Session(lane({ beat: { ticks: 37.5 } }))).toThrow(/whole number of ticks/);
    expect(() => new Session(lane({ beat: { ticks: 30 } })).dispose()).not.toThrow();
    // A pulse has nothing to keep on a hole without a beat.
    expect(() => new Session(lane({ field: { parts: [{ kind: 'pulse', id: 'beat', at: [0, 0, 0], pattern }] } }))).toThrow(/has none/);
  });

  it('opens and shuts a gate on the very tick a beat begins, for as many bars as you like', () => {
    const session = new Session(hall);
    const gate = part<Gate>(session, 'gate');
    const pulse = part<Pulse>(session, 'beat');
    const cues: { name: string; tick: number }[] = [];
    session.on((event) => event.type === 'cue' && cues.push({ name: event.name, tick: session.world.tick }));
    for (let i = 0; i < 30 * 4 * 6; i++) {
      // What the round does on this step is decided before the world moves on.
      const beat = Math.floor(session.world.tick / 30) % 4;
      session.step();
      expect(pulse.def.pattern[beat]).toBe(pattern[beat]);
      expect(gate.open).toBe(pattern[beat] === 1);
    }
    // It shut on beat 3 and opened on beat 1 of every bar, never a tick out.
    const shut = cues.filter((cue) => cue.name === 'shutterShut').map((cue) => cue.tick);
    const open = cues.filter((cue) => cue.name === 'shutterOpen').map((cue) => cue.tick);
    expect(shut).toEqual([60, 180, 300, 420, 540, 660]);
    expect(open).toEqual([0, 120, 240, 360, 480, 600]);
    session.dispose();
  });

  it('lets a ball through on an open beat and stops it on a shut one', () => {
    const through = new Session(hall);
    stepTicks(through, 5);
    through.shoot(NORTH, 0.6);
    runUntilSettled(through);
    expect(through.ball.position().z).toBeLessThan(0);
    through.dispose();

    // The same stroke a few beats on arrives while the gate is shut.
    const stopped = new Session(hall);
    stepTicks(stopped, 50);
    stopped.shoot(NORTH, 0.6);
    let furthest = 10;
    let met = -1;
    for (let i = 0; i < 400 && stopped.phase === 'rolling'; i++) {
      stopped.step();
      furthest = Math.min(furthest, stopped.ball.position().z);
      if (met < 0 && stopped.stats.wallHits > 0) met = stopped.world.tick;
    }
    expect(furthest).toBeGreaterThan(0);
    expect(Math.floor(met / 30) % 4).toBeGreaterThanOrEqual(2);
    stopped.dispose();
  });

  it('never shuts a gate on a ball: it waits for the doorway to clear', () => {
    const session = new Session(hall);
    const gate = part<Gate>(session, 'gate');
    place(session, 0, 0);
    stepTicks(session, 100);
    // Beat 3: it should be shut, and is not, because the ball is lying in the doorway.
    expect(gate.open).toBe(true);
    place(session, 0, 3);
    stepTicks(session, 2);
    expect(gate.open).toBe(false);
    session.dispose();
  });
});

describe('piano keys: lifts that keep the beat (SPEC v6 3.4)', () => {
  // A block four metres long across the lane that stands level with the ground for two
  // beats, rises 0.6 m over two, stands for two and comes down over two. It is slick,
  // so a ball is still rolling when the block has got to the top.
  const key: MoverDef = {
    role: 'lift',
    size: [6, 0.9, 4],
    position: [0, -0.446, 0],
    surface: 'ice',
    motion: { type: 'slide', offset: [0, 0.6, 0], period: 4, hold: [0.25, 0.25] },
    rest: [[0, 0, 5]],
  };
  const stairs = lane({ beat: { ticks: 30 }, movers: [key] }, [
    { type: 'floor', min: [-3, 2], max: [3, 8], surface: 'grass' },
    { type: 'floor', min: [-3, -2], max: [3, 2], surface: 'grass' },
    { type: 'floor', min: [-3, -10], max: [3, -2], y: 0.6, depth: 1, surface: 'grass' },
  ]);

  it('is where it was a bar of eight beats ago, to the last bit', () => {
    for (const tick of [0, 17, 60, 95, 120, 200]) {
      expect(moverPose(key, tick + 240)).toStrictEqual(moverPose(key, tick));
    }
    expect(moverPose(key, 0).position.y).toBe(-0.446);
    expect(moverPose(key, 120).position.y).toBeCloseTo(0.154, 12);
  });

  it('is rolled onto without a bump while it is level, and carries the ball up to the next floor', () => {
    const session = new Session(stairs);
    const bumps: string[] = [];
    session.on((event) => event.type === 'bounce' && bumps.push(event.kind));
    // Onto the key near the end of its two beats on the ground.
    session.shoot(NORTH, 0.36);
    let entered = -1;
    let before = 0;
    let jolt = 0;
    for (let i = 0; i < 3000 && session.phase === 'rolling'; i++) {
      const v = session.ball.velocity().z;
      session.step();
      if (entered < 0 && session.ball.position().z < 2) {
        entered = session.world.tick;
        before = v;
        jolt = Math.abs(session.ball.velocity().z - v);
      }
    }
    expect(entered).toBeGreaterThan(0);
    expect(entered).toBeLessThan(60);
    // Its edge took nothing off the ball: no more than a tick of rolling does.
    expect(Math.abs(before)).toBeGreaterThan(3);
    expect(jolt).toBeLessThan(0.08);
    expect(bumps).toEqual([]);
    // And it rolled off the far end at the height of the upper floor.
    expect(session.ball.position().z).toBeLessThan(-2);
    expect(session.ball.position().y).toBeCloseTo(0.6 + r, 2);
    session.dispose();
  });

  it('is a wall to a ball that comes when it has risen', () => {
    const session = new Session(stairs);
    stepTicks(session, 120);
    session.shoot(NORTH, 0.4);
    let furthest = 10;
    for (let i = 0; i < 60; i++) {
      session.step();
      furthest = Math.min(furthest, session.ball.position().z);
    }
    // It never got past the near face of the key, which stands at z = 2.
    expect(furthest).toBeGreaterThan(2);
    expect(session.stats.moverHits).toBeGreaterThan(0);
    session.dispose();
  });

  it('may not be rested on: a ball that stops there is put on the safe spot the hole names', () => {
    // A key that is not slick, so that a tap from the middle of it dies on it.
    const session = new Session({ ...stairs, movers: [{ ...key, surface: 'grass' }] });
    place(session, 0, 0);
    session.shoot(NORTH, 0.07);
    runUntilSettled(session);
    expect(session.ball.position().z).toBeCloseTo(5, 6);
    expect(session.ball.position().y).toBeCloseTo(r, 6);
    session.dispose();
  });
});

describe('drums (SPEC v6 3.4, 7.4 #5)', () => {
  const skin = drumPad([0, 0, 0], 0.8, { beat: 30, every: 2, offset: 1, velocity: [0, 6, -3], rest: [[0, 0, 4]] });
  const stage = lane({ beat: { ticks: 30 }, zones: [FALL, skin] });

  it('strikes every so many beats, for a few ticks, on the clock', () => {
    expect(drumAt(skin, 0).striking).toBe(false);
    expect(drumAt(skin, 29).striking).toBe(false);
    expect(drumAt(skin, 30)).toMatchObject({ striking: true, count: 1 });
    expect(drumAt(skin, 35).striking).toBe(true);
    expect(drumAt(skin, 36).striking).toBe(false);
    expect(drumAt(skin, 90)).toMatchObject({ striking: true, count: 2 });
    expect(drumAt(skin, 89).left).toBeCloseTo(1 / 60, 9);
  });

  it('throws a ball that is on it when it strikes, always the same way', () => {
    const throws = [-0.5, 0.3].map((x) => {
      const session = new Session(stage);
      const cues: string[] = [];
      session.on((event) => event.type === 'cue' && cues.push(event.name));
      place(session, x, 0);
      session.shoot({ x: 1, y: 0, z: 0 }, 0.07);
      stepTicks(session, 31);
      const v = { ...session.ball.velocity() };
      expect(cues).toContain('drumThrow');
      session.dispose();
      return v;
    });
    // Whatever it was doing and wherever on the skin, it leaves the same way: at the
    // drum's own velocity, less one tick of the ground's hold and one of gravity.
    expect(throws[1]).toStrictEqual(throws[0]);
    expect(throws[0].x).toBe(0);
    expect(throws[0].z).toBeCloseTo(-3, 1);
    expect(throws[0].y).toBeGreaterThan(5.7);
  });

  it('is plain ground between strikes, and nothing to a ball in the air', () => {
    const rolling = new Session(stage);
    stepTicks(rolling, 40);
    rolling.shoot(NORTH, 0.7);
    let highest = 0;
    for (let i = 0; i < 44; i++) {
      rolling.step();
      highest = Math.max(highest, rolling.ball.position().y);
    }
    // It crossed the drum between two strikes and never left the ground.
    expect(rolling.ball.position().z).toBeLessThan(-1);
    expect(highest).toBeLessThan(r + 0.01);
    rolling.dispose();

    const flying = new Session(stage);
    const cues: string[] = [];
    flying.on((event) => event.type === 'cue' && cues.push(event.name));
    stepTicks(flying, 12);
    flying.ball.teleport({ x: 0, y: 2.4, z: 0 });
    stepTicks(flying, 24);
    // It is over the drum as it strikes, and too high to be touched.
    expect(drumAt(skin, flying.world.tick - 1).striking).toBe(true);
    expect(flying.ball.position().y).toBeGreaterThan(0.3);
    expect(cues).toContain('drumBeat');
    expect(cues).not.toContain('drumThrow');
    flying.dispose();
  });

  it('throws a ball once per strike, and is heard once per strike', () => {
    const session = new Session(stage);
    const cues: string[] = [];
    session.on((event) => event.type === 'cue' && cues.push(event.name));
    stepTicks(session, 200);
    expect(cues.filter((name) => name === 'drumBeat')).toHaveLength(3);
    session.dispose();
  });

  it('may not be rested on (SPEC v6 3.4)', () => {
    // A drum that will not strike for a long while yet, and a ball that stops on it.
    const quiet = lane({ beat: { ticks: 30 }, zones: [FALL, drumPad([0, 0, 0], 0.8, { beat: 30, every: 40, offset: 39, velocity: [0, 6, -3], rest: [[0, 0, 4]] })] });
    const session = new Session(quiet);
    place(session, 0, 0.6);
    session.shoot(NORTH, 0.07);
    runUntilSettled(session);
    expect(session.phase).toBe('aiming');
    expect(session.ball.position().z).toBeCloseTo(4, 6);
    session.dispose();
  });
});

describe('time zones (SPEC v6 3.5, 7.4 #6, #7, #8)', () => {
  // A bar that sweeps the lane once every four seconds of its own time.
  const hand: MoverDef = {
    role: 'pusher',
    size: [0.4, 0.6, 3],
    position: [0, 0.3, -3],
    surface: 'iron',
    motion: { type: 'spin', pivot: [0, -3], period: 4 },
    clock: 'zone',
  };
  const works = (zone: Partial<Extract<PartDef, { kind: 'timeZone' }>> = {}, dial: Partial<Extract<PartDef, { kind: 'dial' }>> = {}): PartDef[] => [
    { kind: 'dial', id: 'dial', at: [2.4, 0, 6.5], ...dial },
    { kind: 'timeZone', id: 'zone', min: [-3, -6], max: [3, 0], dial: 'dial', ...zone },
  ];
  const tower = (parts = works(), movers: MoverDef[] = [hand]) => lane({ movers, field: { parts } });

  it('runs its machines at the rate the dial shows: half speed, full speed, double', () => {
    const session = new Session(tower());
    const zone = part<TimeZone>(session, 'zone');
    stepTicks(session, 100);
    expect(zone.rate).toBe(1);
    expect(zone.now).toBe(100);
    expect(session.movers[0].pose).toStrictEqual(moverPose(hand, 100));
    // One knock: fast. The clock gains two ticks for every one of the hole's.
    knock(session, 'dial');
    stepTicks(session, 20);
    expect(zone.rate).toBe(2);
    const fast = zone.now;
    stepTicks(session, 50);
    expect(zone.now).toBe(fast + 100);
    // The next: slow. And the machine is where its motion has it at the zone's time, whatever that is.
    knock(session, 'dial');
    stepTicks(session, 20);
    expect(zone.rate).toBe(0.5);
    const slow = zone.now;
    stepTicks(session, 50);
    expect(zone.now).toBe(slow + 25);
    expect(session.movers[0].pose).toStrictEqual(moverPose(hand, zone.now));
    expect(zone.on).toBe(true);
    knock(session, 'dial');
    stepTicks(session, 20);
    expect(zone.rate).toBe(1);
    expect(zone.on).toBe(false);
    session.dispose();
  });

  it('never makes a machine jump when the rate changes: it carries on from where it is (7.4 #6)', () => {
    const session = new Session(tower());
    const zone = part<TimeZone>(session, 'zone');
    const mover = session.movers[0];
    const turn = () => {
      const before = mover.pose.yaw;
      session.step();
      return mover.pose.yaw - before;
    };
    const full = (2 * Math.PI) / 240;
    stepTicks(session, 37);
    expect(turn()).toBeCloseTo(full, 9);
    knock(session, 'dial');
    const steps: number[] = [];
    for (let i = 0; i < 40; i++) steps.push(turn());
    // Each tick it turns a little more than the one before, up to double, and never more.
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1] - 1e-12);
      expect(steps[i] - steps[i - 1]).toBeLessThan(full * 0.13);
    }
    expect(steps.at(-1)).toBeCloseTo(full * 2, 9);
    expect(zone.rate).toBe(2);
    session.dispose();
  });

  it('does nothing to the ball: the same stroke ends in the same place at any rate', () => {
    // No machine in the way this time, so only the ball's own speed could tell the rates apart.
    const ends = [0, 1, 2].map((knocks) => {
      const session = new Session(tower(works(), []));
      for (let i = 0; i < knocks; i++) {
        knock(session, 'dial');
        stepTicks(session, 25);
      }
      stepTicks(session, 100 - 25 * knocks);
      session.shoot({ x: 0.1, y: 0, z: -1 }, 0.7);
      runUntilSettled(session);
      const end = [{ ...session.ball.position() }, session.world.tick];
      session.dispose();
      return end;
    });
    expect(ends[1]).toStrictEqual(ends[0]);
    expect(ends[2]).toStrictEqual(ends[0]);
  });

  it('slows its machines for as long as the ball is inside, when the ball brings slow time with it (7.4 #7)', () => {
    const session = new Session(tower(works({ dial: undefined, rate: 2, carried: 0.5 }), []));
    const zone = part<TimeZone>(session, 'zone');
    const cues: string[] = [];
    session.on((event) => event.type === 'cue' && cues.push(event.name));
    stepTicks(session, 10);
    expect(zone.rate).toBe(2);
    session.shoot(NORTH, 0.5);
    const rates: number[] = [];
    let inside = false;
    for (let i = 0; i < 2000 && session.phase === 'rolling'; i++) {
      session.step();
      inside ||= zone.holds(session.ball);
      rates.push(zone.rate);
    }
    // The ball came to rest inside the zone, and the zone is slow, and stays slow while the player aims.
    expect(zone.holds(session.ball)).toBe(true);
    expect(zone.rate).toBe(0.5);
    stepTicks(session, 100);
    expect(zone.rate).toBe(0.5);
    // On its way from fast to slow it passed through every eighth in between.
    expect(new Set(rates).size).toBe(13);
    expect(cues).toContain('timeSlow');
    // Out of the zone again, and it is fast again.
    place(session, 0, 5);
    stepTicks(session, 20);
    expect(zone.rate).toBe(2);
    expect(cues).toContain('timeFast');
    session.dispose();
  });

  it('can be told its rate by signals too (SPEC v6 3.5: `when`)', () => {
    const parts: PartDef[] = [
      { kind: 'valve', id: 'a', at: [2.4, 0, 6.5], look: 'lever' },
      { kind: 'timeZone', id: 'zone', min: [-3, -6], max: [3, 0], rates: [{ rate: 0.5, when: 'a' }] },
    ];
    const session = new Session(tower(parts));
    const zone = part<TimeZone>(session, 'zone');
    stepTicks(session, 10);
    expect(zone.rate).toBe(1);
    knock(session, 'a');
    stepTicks(session, 10);
    expect(zone.rate).toBe(0.5);
    session.dispose();
  });

  it('puts the dial back with a stroke that is taken back, and leaves the clock where it has got to (7.4 #8)', () => {
    const session = new Session(tower());
    const zone = part<TimeZone>(session, 'zone');
    const dial = part<Dial>(session, 'dial');
    place(session, 2.4, 7.4);
    stepTicks(session, 30);
    session.shoot(NORTH, 0.3);
    runUntilSettled(session);
    expect(dial.position).toBe(2);
    expect(zone.rate).toBe(2);
    const reached = zone.now;
    expect(reached).toBeGreaterThan(session.world.tick);
    expect(session.undo()).toBe(true);
    expect(dial.position).toBe(1);
    expect(dial.on).toBe(false);
    // At once, and without a sound: the rate is the dial's again. The clock is not turned back.
    expect(zone.rate).toBe(1);
    expect(zone.now).toBe(reached);
    session.step();
    expect(zone.now).toBe(reached + 1);
    expect(session.movers[0].pose).toStrictEqual(moverPose(hand, zone.now));
    session.dispose();
  });

  it('keeps its own time through a retry: a fresh round starts every clock at nought', () => {
    const session = new Session(tower());
    knock(session, 'dial');
    stepTicks(session, 90);
    session.reset();
    const zone = part<TimeZone>(session, 'zone');
    expect(zone.now).toBe(0);
    expect(session.movers[0].pose).toStrictEqual(moverPose(hand, 0));
    stepTicks(session, 10);
    expect(session.movers[0].pose).toStrictEqual(moverPose(hand, 10));
    session.dispose();
  });

  it('refuses a rate that is not a whole number of eighths, and a clock that is not there', () => {
    expect(() => new Session(tower(works({ rate: 0.3 })))).toThrow(/eighths/);
    expect(() => new Session(tower(works({}, { rates: [0.5, 1.1] })))).toThrow(/eighths/);
    expect(() => new Session(lane({ movers: [hand] }))).toThrow(/has no works/);
    expect(() => new Session(tower(works(), [{ ...hand, clock: 'dial' }]))).toThrow(/keeps no clock/);
  });
});
