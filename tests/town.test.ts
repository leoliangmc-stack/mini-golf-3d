import { beforeAll, describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/chapters';
import { REPLAYS } from '../src/debug/replays';
import { playTo } from '../src/debug/search';
import { mouthPoint, type Train, type Tunnel } from '../src/game/field/city';
import type { Valve } from '../src/game/field/elements';
import type { Rotor } from '../src/game/field/maze';
import { ROTOR_TICKS } from '../src/game/field/maze';
import { Session } from '../src/game/session';
import { stagesOf } from '../src/level/chapters';
import type { TrainDef, TunnelDef } from '../src/level/field';
import type { HoleDef } from '../src/level/schema';
import { coasterNeed, coasterTracks, isCoaster } from '../src/physics/zones/coaster';
import { shapeContains } from '../src/physics/zones/shape';
import { headingVector } from '../src/physics/zones/tunnel';
import { runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const chapter = CHAPTERS[6];
const holes = stagesOf(chapter).flatMap((stage) => stage.holes);
const hole = (id: string): HoleDef => holes.find((h) => h.id === id)!;

/** Puts the ball somewhere on the ground and plays it off at a velocity, as a stroke. */
function send(session: Session, from: [number, number], velocity: [number, number], y = 0): void {
  session.ball.teleport({ x: from[0], y: y + 0.1, z: from[1] });
  const speed = Math.hypot(velocity[0], velocity[1]);
  expect(session.shoot({ x: velocity[0], y: 0, z: velocity[1] }, speed / 18)).toBe(true);
}
const at = (session: Session) => session.ball.position();
/** Throws a lever, as a knock from the ball does. */
const knock = (session: Session, id: string) => {
  const part = session.field!.part(id) as unknown as { hit(ball: unknown, speed: number, collider: number): void };
  part.hit(session.ball, 1, -1);
};

describe('Chapter 7 holes (SPEC v7 3)', () => {
  it('is City & Carnival: four worlds and a finale, open from the Chapter 6 finale', () => {
    expect(chapter.id).toBe('ch7');
    expect(chapter.after).toBe('ch6');
    expect(chapter.worlds.map((world) => world.id)).toEqual(['subway', 'rail', 'fair', 'maze']);
    expect(chapter.finale.id).toBe('ch7-finale');
    expect(holes).toHaveLength(13);
  });

  it('has a stroke to take back wherever a ball or the player can change the course, and not at the fair (SPEC v7 3.1)', () => {
    const undo = holes.filter((def) => {
      const session = new Session(def);
      const yes = session.rewindable;
      session.dispose();
      return yes;
    });
    expect(undo.map((h) => h.id)).toEqual([
      'subway-1', 'subway-2', 'subway-3', 'rail-1', 'rail-2', 'rail-3', 'maze-1', 'maze-2', 'maze-3', 'ch7-finale',
    ]);
  });

  it.each(holes)('$id is solved by its reference round with no penalty and no stroke taken back', (def) => {
    const session = playTo(def, REPLAYS[def.id].inputs);
    expect(session.outcome).toMatchObject({ holed: true, stars: 3 });
    expect(session.strokes).toBeLessThanOrEqual(def.par);
    expect(session.stats.undos).toBe(0);
    expect(session.stats.outOfBounds).toBe(0);
    session.dispose();
  });

  it.each(holes)('$id ends every stroke, and leaves a ball that has stopped where it stopped', (def) => {
    // Strokes in every direction at three strengths: none may go on for ever, and once
    // one is over nothing may pick the ball up again while the player aims.
    for (let n = 0; n < 18; n++) {
      const session = new Session(def);
      stepTicks(session, 5);
      const angle = (n / 18) * Math.PI * 2;
      session.shoot({ x: Math.sin(angle), y: 0, z: Math.cos(angle) }, [0.3, 0.6, 1][n % 3]);
      expect(runUntilSettled(session, 6000)).toBeLessThan(6000);
      if (session.phase === 'aiming') {
        const rest = { ...at(session) };
        stepTicks(session, 150);
        expect(session.phase).toBe('aiming');
        // To within the hair a ball set down by hand sinks onto the ground.
        const p = at(session);
        expect(Math.hypot(p.x - rest.x, p.y - rest.y, p.z - rest.z)).toBeLessThan(1e-3);
        expect(session.ball.body.isEnabled()).toBe(true);
      }
      session.dispose();
    }
  });
});

describe('the data of Chapter 7 (SPEC v7 3.2, 5)', () => {
  const tunnels = holes.flatMap((def) => (def.field?.parts ?? []).filter((part): part is TunnelDef => part.kind === 'tunnel').map((part) => ({ def, part })));
  const trains = holes.flatMap((def) => (def.field?.parts ?? []).filter((part): part is TrainDef => part.kind === 'train').map((part) => ({ def, part })));
  const coasters = holes.flatMap((def) => def.zones.filter((zone) => zone.type === 'coaster').map((zone) => ({ def, zone })));

  it('never leaves a tunnel mouth pointing straight at its partner, whichever way either is turned', () => {
    expect(tunnels.length).toBeGreaterThanOrEqual(4);
    for (const { part } of tunnels) {
      const radius = part.radius ?? 0.45;
      for (const a of part.a.facings) {
        for (const b of part.b.facings) {
          const ends = [
            { at: mouthPoint(part.a, a), facing: a },
            { at: mouthPoint(part.b, b), facing: b },
          ];
          for (const [from, to] of [ends, [ends[1], ends[0]]]) {
            const out = headingVector(from.facing);
            const into = headingVector(to.facing);
            const dx = to.at[0] - from.at[0];
            const dz = to.at[2] - from.at[2];
            const along = dx * out.x + dz * out.z;
            const aside = Math.abs(dx * out.z - dz * out.x);
            expect(along > 0 && aside < radius + 0.5 && out.x * into.x + out.z * into.z < 0).toBe(false);
          }
        }
      }
    }
  });

  it('gives every mouth that turns two to four facings and a lever, on the ground', () => {
    for (const { def, part } of tunnels) {
      const session = new Session(def);
      const ground = session.compiled.ground!;
      for (const mouth of [part.a, part.b]) {
        expect(mouth.facings.length).toBeGreaterThanOrEqual(1);
        expect(mouth.facings.length).toBeLessThanOrEqual(4);
        for (const facing of mouth.facings) {
          const [x, y, z] = mouthPoint(mouth, facing);
          const out = headingVector(facing);
          // In front of the mouth, whichever way it faces, there is ground to roll out onto.
          expect(ground.surfaceAt({ x: x + out.x * 0.4, y, z: z + out.z * 0.4 })).not.toBeNull();
        }
        if (mouth.facings.length > 1) expect(ground.surfaceAt({ x: mouth.lever![0], y: mouth.lever![1], z: mouth.lever![2] })).not.toBeNull();
      }
      session.dispose();
    }
  });

  it('runs every train over open air, from a platform on the ground to a place a ball can be left', () => {
    expect(trains.length).toBeGreaterThanOrEqual(6);
    for (const { def, part } of trains) {
      const session = new Session(def);
      const ground = session.compiled.ground!;
      const on = (p: readonly [number, number, number]) => ground.surfaceAt({ x: p[0], y: p[1], z: p[2] });
      expect(on(part.board)).not.toBeNull();
      for (const line of part.lines) {
        expect(on(line.drop)).not.toBeNull();
        // Nowhere a ball could come to rest (SPEC v7 3.3): no stretch of track lies over the course.
        const points = [part.home, ...(line.via ?? []), line.stop];
        for (let i = 1; i < points.length; i++) {
          const [a, b] = [points[i - 1], points[i]];
          for (let t = 0; t <= 1; t += 0.05) {
            expect(on([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])).toBeNull();
          }
        }
        // And nothing that moves passes over where the ball is set down (SPEC v7 5).
        for (const mover of def.movers ?? []) {
          if (mover.sweep) expect(shapeContains(mover.sweep, { x: line.drop[0], y: line.drop[1] + 0.1, z: line.drop[2] })).toBe(false);
        }
      }
      session.dispose();
    }
  });

  it('starts every coaster on the ground and lets its ball go over ground, off every branch', () => {
    expect(coasters.length).toBeGreaterThanOrEqual(5);
    for (const { def, zone } of coasters) {
      const session = new Session(def);
      const ground = session.compiled.ground!;
      const tracks = coasterTracks(zone);
      const first = tracks.main.points[0];
      expect(ground.surfaceAt(first)).not.toBeNull();
      for (const way of tracks.high ? [tracks.high, tracks.low!] : [tracks.main]) {
        const end = way.points[way.points.length - 1];
        const before = way.points[way.points.length - 2];
        // A track ends on the level, and a step beyond its end there is something to roll on.
        expect(end.y).toBeCloseTo(before.y, 9);
        const length = Math.hypot(end.x - before.x, end.z - before.z);
        const out = { x: end.x + ((end.x - before.x) / length) * 0.3, y: end.y, z: end.z + ((end.z - before.z) / length) * 0.3 };
        expect(ground.surfaceAt(out)).not.toBeNull();
      }
      // A full stroke from a few metres off is more than any of them asks for.
      expect(coasterNeed(zone)).toBeLessThan(11);
      session.dispose();
    }
  });

  it('gives every hole with walls that turn at least as many turns as its reference round uses', () => {
    for (const def of holes) {
      const rotors = (def.field?.parts ?? []).filter((part) => part.kind === 'rotor');
      if (rotors.length === 0) {
        expect(def.field?.turns).toBeUndefined();
        continue;
      }
      const used = REPLAYS[def.id].inputs.filter((input) => input.type === 'rotate').length;
      expect(used).toBeGreaterThan(0);
      expect(def.field!.turns).toBeGreaterThanOrEqual(used);
    }
  });
});

describe('Subway (SPEC v7 3.2)', () => {
  const tunnel = (session: Session) => session.field!.part('line') as Tunnel;
  /** Turns a mouth to its next facing, as a knock on its lever does (tests/city.test.ts does it with a ball). */
  const turnMouth = (session: Session, end: 0 | 1) => {
    const line = tunnel(session);
    line.index[end] = (line.index[end] + 1) % (end === 0 ? line.def.a : line.def.b).facings.length;
  };

  it('subway-1 sends a ball the wrong way until the lever is knocked, and lets it come back', () => {
    const session = new Session(hole('subway-1'));
    stepTicks(session, 3);
    send(session, [0, 5], [0, -5]);
    runUntilSettled(session);
    // West of the wall, where there is nothing.
    expect(at(session).x).toBeLessThan(0);
    expect(at(session).z).toBeLessThan(-2);
    // Back into the mouth it came out of, and it is in the room it started in.
    send(session, [-2.5, -4.5], [5, 0]);
    runUntilSettled(session);
    expect(at(session).z).toBeGreaterThan(2);
    // With the mouth turned, the same stroke comes out east, on the cup's side.
    turnMouth(session, 1);
    expect(tunnel(session).facing(1)).toBe(90);
    send(session, [0, 5], [0, -5]);
    runUntilSettled(session);
    expect(session.outcome?.holed || at(session).x > 0).toBe(true);
    session.dispose();
  });

  it('subway-2 has three ways out, and only the east one reaches the cup', () => {
    const where: string[] = [];
    for (let knocks = 0; knocks < 3; knocks++) {
      const session = new Session(hole('subway-2'));
      stepTicks(session, 3);
      for (let k = 0; k < knocks; k++) turnMouth(session, 1);
      send(session, [0, 8], [0, -5]);
      runUntilSettled(session);
      const p = at(session);
      where.push(p.x < -1.5 ? 'west' : p.x > 1.5 ? 'east' : p.z < -1.5 && p.z > -4.5 ? 'pen' : 'other');
      session.dispose();
    }
    expect(where).toEqual(['west', 'east', 'pen']);
    // The pen is shut off from the cup beside it: the reference round goes east.
    expect(REPLAYS['subway-2'].inputs.filter((input) => input.type === 'shot')).toHaveLength(3);
  });

  it('subway-3 is ridden both ways: out to turn the near mouth, and back through it', () => {
    const session = new Session(hole('subway-3'));
    stepTicks(session, 3);
    // Out, with the far mouth as it stands: into the dead end, east of its wall.
    send(session, [0, 9], [0, -5]);
    runUntilSettled(session);
    expect(at(session).x).toBeGreaterThan(-8.5);
    expect(at(session).x).toBeLessThan(-5);
    session.reset();
    stepTicks(session, 3);
    // The far mouth turned west: out onto the side with the near mouth's lever.
    turnMouth(session, 1);
    send(session, [0, 9], [0, -5]);
    runUntilSettled(session);
    expect(at(session).x).toBeLessThan(-8.5);
    // Turn the near mouth from here, and ride back: it comes out north of the wall, by the cup.
    turnMouth(session, 0);
    send(session, [-11, 3], [5, 0]);
    runUntilSettled(session);
    expect(session.outcome?.holed || (at(session).z < 6 && at(session).x > -3)).toBe(true);
    session.dispose();
  });
});

describe('Railway Town (SPEC v7 3.3)', () => {
  const train = (session: Session, id = 'train') => session.field!.part(id) as Train;
  const throwPoints = (session: Session, id: string) => {
    knock(session, id);
    stepTicks(session, 2);
  };

  it('rail-1 goes west as the points stand, and east to the cup once they are thrown', () => {
    const session = new Session(hole('rail-1'));
    stepTicks(session, 3);
    send(session, [0, 6], [0, -5]);
    runUntilSettled(session);
    expect(at(session).x).toBeCloseTo(-3.8, 5);
    expect(at(session).z).toBeCloseTo(-6.5, 5);
    session.reset();
    stepTicks(session, 3);
    throwPoints(session, 'points');
    expect(train(session).line).toBe(1);
    send(session, [0, 6], [0, -5]);
    runUntilSettled(session);
    expect(at(session).x).toBeCloseTo(3.8, 5);
    expect(at(session).z).toBeCloseTo(-6.5, 5);
    session.dispose();
  });

  it('rail-2 brings a ball home again unless both sets of points are right, all in the one stroke', () => {
    const ride = (first: boolean, second: boolean): { x: number; z: number; strokes: number } => {
      const session = new Session(hole('rail-2'));
      stepTicks(session, 3);
      // The second lever starts thrown.
      if (first) throwPoints(session, 'first');
      if (!second) throwPoints(session, 'second');
      expect((session.field!.part('second') as Valve).open).toBe(second);
      send(session, [0, 7], [0, -5]);
      runUntilSettled(session, 8000);
      const round = (value: number) => Math.round(value * 1e4) / 1e4;
      const end = { x: round(at(session).x), z: round(at(session).z), strokes: session.strokes };
      session.dispose();
      return end;
    };
    const home = { x: 2.2, z: 8.5, strokes: 1 };
    // As it stands: to the depot and home.
    expect(ride(false, true)).toEqual(home);
    expect(ride(false, false)).toEqual(home);
    // The first set thrown, the second as it stands: by both trains to the depot, and home.
    expect(ride(true, true)).toEqual(home);
    // Both right: on to the station with the cup.
    expect(ride(true, false)).toEqual({ x: 0, z: -8.7, strokes: 1 });
  });

  it('rail-3 moves a ball that stops on the crossing clear of the line (SPEC v7 7.4 #4)', () => {
    const def = hole('rail-3');
    const mover = def.movers![0];
    const session = new Session(def);
    // Just after the train has gone through: there is time for a ball to stop there.
    while (session.movers[0].pose.position.x < 8.9) session.step();
    send(session, [0, 4.6], [0, -3.4]);
    runUntilSettled(session);
    const p = at(session);
    expect(shapeContains(mover.sweep!, p)).toBe(false);
    expect(mover.rest!.some((rest) => Math.hypot(rest[0] - p.x, rest[2] - p.z) < 1e-6)).toBe(true);
    session.dispose();
  });

  it('rail-3 counts a ball the passing train runs into, and it costs the third star', () => {
    const session = new Session(hole('rail-3'));
    // Onto the line just as the train comes through.
    while (session.movers[0].pose.position.x < -5) session.step();
    send(session, [0, 3.5], [0, -3]);
    runUntilSettled(session, 6000);
    expect(session.stats.moverHits).toBeGreaterThan(0);
    session.dispose();
    // The reference round gets across untouched.
    const clean = playTo(hole('rail-3'), REPLAYS['rail-3'].inputs);
    expect(clean.stats.moverHits).toBe(0);
    expect(clean.outcome?.challengeMet).toBe(true);
    clean.dispose();
  });
});

describe('Carnival (SPEC v7 3.4)', () => {
  it('fair-1 rolls a soft stroke back out to where it came from, and costs no more than the stroke', () => {
    const session = new Session(hole('fair-1'));
    stepTicks(session, 3);
    session.shoot({ x: 0, y: 0, z: -1 }, 0.4);
    runUntilSettled(session);
    expect(session.zones.find(isCoaster)!.gauge.last).toBeLessThan(coasterNeed(hole('fair-1').zones[1]));
    expect(at(session).z).toBeGreaterThan(4);
    expect(session.strokes).toBe(1);
    expect(session.stats.outOfBounds).toBe(0);
    session.dispose();
  });

  it('fair-2 asks more of the second loop than of the first', () => {
    const [, first, second] = hole('fair-2').zones;
    expect(coasterNeed(second)).toBeGreaterThan(coasterNeed(first) + 0.5);
  });

  it('fair-3 takes a slow ball round by the low road, a fast one up to the cup, and a wild one over the edge', () => {
    const run = (power: number) => {
      const session = new Session(hole('fair-3'));
      stepTicks(session, 3);
      const seen: string[] = [];
      session.on((event) => {
        if (event.type === 'cue') seen.push(event.name);
      });
      session.shoot({ x: 0, y: 0, z: -1 }, power);
      runUntilSettled(session);
      const end = { seen, y: at(session).y, x: at(session).x, out: session.stats.outOfBounds, holed: session.outcome?.holed ?? false };
      session.dispose();
      return end;
    };
    const slow = run(0.5);
    expect(slow.seen).toContain('coasterLow');
    expect(slow.y).toBeLessThan(0.5);
    expect(slow.x).toBeLessThan(-3.5);
    expect(slow.out).toBe(0);
    const fast = run(0.62);
    expect(fast.seen).toContain('coasterHigh');
    expect(fast.holed || fast.y > 1).toBe(true);
    expect(fast.out).toBe(0);
    const wild = run(1);
    expect(wild.seen).toContain('coasterHigh');
    expect(wild.out).toBe(1);
  });
});

describe('Maze Course (SPEC v7 3.5)', () => {
  const rotor = (session: Session, id: string) => session.field!.part(id) as Rotor;
  const turn = (session: Session, id: string) => {
    expect(session.rotate(id)).toBe(true);
    stepTicks(session, ROTOR_TICKS + 1);
  };

  it('maze-1 is shut until its gate is turned', () => {
    const session = new Session(hole('maze-1'));
    stepTicks(session, 3);
    session.shoot({ x: 0, y: 0, z: -1 }, 0.66);
    runUntilSettled(session);
    expect(at(session).z).toBeGreaterThan(0);
    session.reset();
    stepTicks(session, 3);
    turn(session, 'gate');
    session.shoot({ x: 0, y: 0, z: -1 }, 0.66);
    runUntilSettled(session);
    expect(session.outcome?.holed || at(session).z < -3).toBe(true);
    session.dispose();
  });

  it('maze-2 takes one turn of each of its three wall groups, and allows four', () => {
    expect(hole('maze-2').field!.turns).toBe(4);
    expect(REPLAYS['maze-2'].inputs.filter((input) => input.type === 'rotate').map((input) => input.type === 'rotate' && input.part).sort()).toEqual([
      'first', 'second', 'third',
    ]);
    // With any one of the three left as it stands, there is a wall between the tee and the cup.
    const session = new Session(hole('maze-2'));
    const first = rotor(session, 'first');
    // The first room: the tee is in its south-west quarter and the door in its north-east.
    expect(first.headings).toEqual([0, 90]);
    session.dispose();
  });

  it('maze-3 is two turns, and spent on the first room alone they leave none for the second', () => {
    const session = new Session(hole('maze-3'));
    stepTicks(session, 3);
    expect(session.field!.turnsLeft).toBe(2);
    // Turn first, then move, then turn again: through the first room, and stuck in the second.
    turn(session, 'door');
    send(session, [-5, 1.2], [4.6, 0]);
    runUntilSettled(session);
    expect(at(session).x).toBeGreaterThan(-3);
    expect(at(session).x).toBeLessThan(0);
    if (session.turnCheck('door') === 'ok') turn(session, 'door');
    else {
      session.ball.teleport({ x: -0.7, y: 0.1, z: 2.4 });
      stepTicks(session, 2);
      turn(session, 'door');
    }
    expect(session.turnCheck('tee')).toBe('spent');
    // A stroke taken back gives the turn made after it back with it (SPEC v7 3.5).
    expect(session.undo()).toBe(true);
    expect(session.field!.turnsLeft).toBe(1);
    expect(rotor(session, 'door').quarter).toBe(1);
    session.dispose();
  });

  it('maze-3 will not turn a wall with the ball lying under its arms', () => {
    const session = new Session(hole('maze-3'));
    stepTicks(session, 3);
    session.ball.teleport({ x: -3.6, y: 0.1, z: 1 });
    stepTicks(session, 2);
    expect(session.turnCheck('door')).toBe('blocked');
    expect(session.turnCheck('tee')).toBe('ok');
    session.dispose();
  });
});

describe('City Day Out (SPEC v7 3.6, 7.4 #11)', () => {
  const def = chapter.finale.holes[0];

  it('asks for the maze walls to be turned once, and is done that way within par', () => {
    expect(def.challenge).toMatchObject({ type: 'maxRotations', count: 1 });
    const inputs = REPLAYS[def.id].inputs;
    expect(inputs.filter((input) => input.type === 'rotate')).toHaveLength(1);
    const session = playTo(def, inputs);
    expect(session.outcome).toMatchObject({ holed: true, stars: 3, challengeMet: true });
    expect(session.strokes).toBeLessThanOrEqual(def.par);
    expect(session.stats.turns).toBe(1);
    session.dispose();
  });

  it('has one of everything: a mouth that turns, points, a coaster and a revolving door', () => {
    const kinds = def.field!.parts.map((part) => (part.kind === 'valve' ? part.look : part.kind));
    expect(kinds).toEqual(['tunnel', 'points', 'train', 'rotor']);
    expect(def.zones.filter((zone) => zone.type === 'coaster')).toHaveLength(1);
    expect(def.field!.turns).toBeGreaterThan(1);
  });

  it('withholds the third star from a round that turns the walls more than once', () => {
    const inputs = REPLAYS[def.id].inputs;
    const last = inputs[inputs.length - 1];
    expect(last.type).toBe('shot');
    expect(inputs[inputs.length - 2].type).toBe('rotate');
    // Up to where the reference round turned once and holed out. Turn three times
    // instead: the walls stand the same way, and the same stroke goes in.
    const session = playTo(def, inputs.slice(0, -2));
    expect(session.phase).toBe('aiming');
    for (let i = 0; i < 3; i++) {
      expect(session.rotate('door')).toBe(true);
      stepTicks(session, ROTOR_TICKS + 1);
    }
    expect(session.field!.turnsLeft).toBe(0);
    if (last.type === 'shot') session.shoot({ x: last.dir[0], y: last.dir[1], z: last.dir[2] }, last.power);
    runUntilSettled(session);
    expect(session.outcome).toMatchObject({ holed: true, challengeMet: false, stars: 2 });
    expect(session.stats.turns).toBe(3);
    session.dispose();
  });
});
