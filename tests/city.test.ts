import { beforeAll, describe, expect, it } from 'vitest';
import { walledRoom } from '../src/data/worlds/common';
import type { Train, Tunnel } from '../src/game/field/city';
import { mouthPoint } from '../src/game/field/city';
import type { Valve } from '../src/game/field/elements';
import { Session, type SessionEvent } from '../src/game/session';
import type { PartDef, TrainDef, TunnelDef } from '../src/level/field';
import type { HoleDef } from '../src/level/schema';
import type { ZoneDef } from '../src/physics/zones';
import { coaster, coasterNeed, coasterTracks, isCoaster, type CoasterZone } from '../src/physics/zones/coaster';
import { boxHole, runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

/** A walled room, the tee in the middle of it, with these works and zones. */
const room = (half: number, parts: PartDef[], zones: ZoneDef[] = [], overrides: Partial<HoleDef> = {}): HoleDef => {
  const base = boxHole();
  return {
    ...base,
    pieces: walledRoom([-half, -half], [half, half], 'grass', 'rail'),
    ...(parts.length > 0 ? { field: { parts } } : {}),
    zones: [...base.zones, ...zones],
    ...overrides,
  };
};

/** Puts the ball somewhere on the ground and sends it off at a velocity, as a stroke. */
function send(session: Session, from: [number, number], velocity: [number, number]): void {
  session.ball.teleport({ x: from[0], y: 0.1, z: from[1] });
  const speed = Math.hypot(velocity[0], velocity[1]);
  expect(session.shoot({ x: velocity[0], y: 0, z: velocity[1] }, speed / 18)).toBe(true);
}

const cues = (session: Session): string[] => {
  const seen: string[] = [];
  session.on((event: SessionEvent) => {
    if (event.type === 'cue') seen.push(event.name);
  });
  return seen;
};

// --- Tunnels that turn -------------------------------------------------------------

/** A fixed mouth north of the tee, facing it; and one to the east that faces east, or north after a knock. */
const TUNNEL: TunnelDef = {
  kind: 'tunnel',
  id: 'tube',
  a: { at: [0, 0, -4], facings: [180] },
  b: { at: [4, 0, 3], facings: [90, 0], lever: [-3, 0, 0] },
};

const tunnel = (session: Session): Tunnel => session.field!.part('tube') as Tunnel;

/** Sends the ball north into the fixed mouth and reports the way it is heading as it comes out of the other. */
function through(session: Session): { x: number; z: number; from: { x: number; z: number } } {
  send(session, [0, -1], [0, -5]);
  let out: { x: number; z: number; from: { x: number; z: number } } | null = null;
  for (let i = 0; i < 200 && !out; i++) {
    session.step();
    const v = session.ball.velocity();
    const p = session.ball.position();
    if (session.ball.body.isEnabled() && p.x > 2) out = { x: v.x, z: v.z, from: { x: p.x, z: p.z } };
  }
  expect(out).not.toBeNull();
  return out!;
}

/** Knocks the lever of the turning mouth, with a stroke. */
function knock(session: Session): void {
  send(session, [-1.5, 0], [-6, 0]);
  runUntilSettled(session);
}

describe('a tunnel mouth that turns (SPEC v7 3.2, 7.4 #2)', () => {
  it('sends a ball out the way the mouth faces, from in front of the mouth', () => {
    const session = new Session(room(8, [TUNNEL]));
    stepTicks(session, 3);
    const out = through(session);
    expect(out.x).toBeGreaterThan(3);
    expect(Math.abs(out.z)).toBeLessThan(1e-9);
    // Let go just in front of the mouth, on the east side of its kiosk.
    expect(out.from.x).toBeGreaterThan(4.55);
    expect(out.from.z).toBeCloseTo(3, 6);
    session.dispose();
  });

  it('turns to its next facing at a knock on its lever, and round again at the next', () => {
    const session = new Session(room(8, [TUNNEL]));
    stepTicks(session, 3);
    expect(tunnel(session).facing(1)).toBe(90);
    knock(session);
    expect(tunnel(session).facing(1)).toBe(0);
    expect(tunnel(session).on).toBe(true);
    knock(session);
    expect(tunnel(session).facing(1)).toBe(90);
    expect(tunnel(session).on).toBe(false);
    // The mouth that has no lever never moves.
    expect(tunnel(session).facing(0)).toBe(180);
    session.dispose();
  });

  it('sends a ball out the new way once it has turned', () => {
    const session = new Session(room(8, [TUNNEL]));
    stepTicks(session, 3);
    knock(session);
    const out = through(session);
    expect(out.z).toBeLessThan(-3);
    expect(Math.abs(out.x)).toBeLessThan(1e-9);
    // The mouth has gone round the kiosk with its facing: it is on the north side now.
    expect(out.from.z).toBeLessThan(2.45);
    expect(out.from.x).toBeCloseTo(4, 6);
    session.dispose();
  });

  it('takes a ball only from the side the mouth is on, and that side moves with it', () => {
    // Rolling west at the east side of the kiosk: straight into a mouth that faces east.
    const facingEast = new Session(room(8, [TUNNEL]));
    stepTicks(facingEast, 3);
    const eastCues = cues(facingEast);
    send(facingEast, [6.5, 3], [-5, 0]);
    runUntilSettled(facingEast);
    expect(eastCues.filter((name) => name === 'tunnelEnter')).toHaveLength(1);
    // It came out of the fixed mouth, heading south.
    expect(facingEast.ball.position().z).toBeGreaterThan(-3.4);
    expect(Math.abs(facingEast.ball.position().x)).toBeLessThan(0.3);
    facingEast.dispose();

    // The same stroke with the mouth turned north meets the back of the kiosk.
    const facingNorth = new Session(room(8, [TUNNEL]));
    stepTicks(facingNorth, 3);
    knock(facingNorth);
    const northCues = cues(facingNorth);
    send(facingNorth, [6.5, 3], [-5, 0]);
    runUntilSettled(facingNorth);
    expect(northCues).not.toContain('tunnelEnter');
    expect(facingNorth.ball.position().x).toBeGreaterThan(4.5);

    // And rolling south at the north side of it, it is taken.
    send(facingNorth, [4, 0.5], [0, 5]);
    runUntilSettled(facingNorth);
    expect(northCues.filter((name) => name === 'tunnelEnter')).toHaveLength(1);
    facingNorth.dispose();
  });

  it('stands where its data says for every facing', () => {
    expect(mouthPoint(TUNNEL.b, 90)).toEqual([4.55, 0, 3]);
    const north = mouthPoint(TUNNEL.b, 0);
    expect(north[0]).toBeCloseTo(4, 9);
    expect(north[2]).toBeCloseTo(2.45, 9);
  });

  it('goes back with a stroke that is taken back, and with one that ends out of bounds (7.4 #8)', () => {
    const open = room(8, [TUNNEL]);
    const hole = { ...open, pieces: open.pieces.filter((piece) => !(piece.type === 'wall' && piece.from[0] === -8 && piece.to[0] === -8)) };
    const session = new Session(hole);
    stepTicks(session, 3);
    knock(session);
    expect(tunnel(session).facing(1)).toBe(0);
    expect(session.undo()).toBe(true);
    expect(tunnel(session).facing(1)).toBe(90);

    knock(session);
    const before = JSON.stringify(session.field!.save());
    // Past the lever and off the open west side.
    send(session, [-1.5, 1.5], [-16, 0]);
    runUntilSettled(session);
    expect(session.stats.outOfBounds).toBe(1);
    expect(JSON.stringify(session.field!.save())).toBe(before);
    expect(tunnel(session).facing(1)).toBe(0);
    session.dispose();
  });

  it('gives a hole undo, and refuses a mouth that turns without a lever', () => {
    const session = new Session(room(8, [TUNNEL]));
    expect(session.rewindable).toBe(true);
    session.dispose();
    const bad: TunnelDef = { ...TUNNEL, b: { at: [4, 0, 3], facings: [90, 0] } };
    expect(() => new Session(room(8, [bad]))).toThrow(/lever/);
  });

  it('plays the same stroke through it the same way twice', () => {
    const run = (): number[] => {
      const session = new Session(room(8, [TUNNEL]));
      stepTicks(session, 3);
      knock(session);
      send(session, [0, -1], [0.2, -6]);
      runUntilSettled(session);
      const p = session.ball.position();
      const end = [p.x, p.y, p.z, session.world.tick];
      session.dispose();
      return end;
    };
    expect(run()).toStrictEqual(run());
  });
});

// --- Trains ---------------------------------------------------------------------

/** A platform north of the tee; a line east, and one west that a lever sets the points for. */
const TRAIN: TrainDef = {
  kind: 'train',
  id: 'train',
  board: [0, 0, -3],
  home: [0, 0, -4],
  lines: [
    { stop: [5, 0, -4], drop: [5, 0, -3] },
    { stop: [-5, 0, -4], drop: [-5, 0, -3], when: 'points' },
  ],
};
const POINTS: PartDef = { kind: 'valve', id: 'points', at: [3, 0, 2], look: 'points' };

const train = (session: Session): Train => session.field!.part('train') as Train;

describe('a train (SPEC v7 3.3, 7.4 #3)', () => {
  it('takes a ball the moment it rolls onto the platform, however fast', () => {
    for (const speed of [1.5, 6, 14]) {
      const session = new Session(room(8, [POINTS, TRAIN]));
      stepTicks(session, 3);
      send(session, [0, -1.8], [0, -speed]);
      let ticks = 0;
      while (train(session).stage === 'home' && ticks++ < 300) session.step();
      expect(train(session).stage).toBe('boarding');
      expect(session.ball.body.isEnabled()).toBe(false);
      // Taken as it came onto the platform, not after it had rolled across.
      expect(session.ball.position().z).toBeGreaterThan(-3.6);
      session.dispose();
    }
  });

  it('carries it to the station the points are set for and sets it down at rest', () => {
    const session = new Session(room(8, [POINTS, TRAIN]));
    stepTicks(session, 3);
    send(session, [0, 0], [0, -5]);
    runUntilSettled(session);
    const p = session.ball.position();
    expect([p.x, p.z]).toEqual([5, -3]);
    expect(p.y).toBeCloseTo(0.1, 3);
    expect(session.ball.speed()).toBe(0);
    expect(session.strokes).toBe(1);
    session.dispose();
  });

  it('does not end the stroke while the ball is aboard, nor before the train is home', () => {
    const session = new Session(room(8, [POINTS, TRAIN]));
    stepTicks(session, 3);
    send(session, [0, 0], [0, -5]);
    const stages = new Set<string>();
    let setDown = -1;
    let ticks = 0;
    while (session.phase === 'rolling' && ticks++ < 2000) {
      session.step();
      const { stage } = train(session);
      // Whatever the train is doing away from its platform, the stroke is still on.
      if (stage !== 'home') expect(session.phase).toBe('rolling');
      if (stage === 'back' && setDown < 0) setDown = session.world.tick;
      stages.add(stage);
    }
    expect([...stages]).toEqual(['home', 'boarding', 'out', 'alighting', 'back']);
    expect(train(session).stage).toBe('home');
    expect(session.phase).toBe('aiming');
    // The ball was down and still for a while before the player got it back.
    expect(session.world.tick).toBeGreaterThan(setDown + 10);
    session.dispose();
  });

  it('goes the other way once a knock has thrown the points', () => {
    const session = new Session(room(8, [POINTS, TRAIN]));
    stepTicks(session, 3);
    expect(train(session).line).toBe(0);
    send(session, [0.5, 2], [6, 0]);
    runUntilSettled(session);
    expect((session.field!.part('points') as Valve).open).toBe(true);
    expect(train(session).line).toBe(1);
    send(session, [0, 0], [0, -5]);
    runUntilSettled(session);
    const p = session.ball.position();
    expect([p.x, p.z]).toEqual([-5, -3]);
    session.dispose();
  });

  it('puts the points back with a stroke that is taken back (7.4 #8)', () => {
    const session = new Session(room(8, [POINTS, TRAIN]));
    stepTicks(session, 3);
    send(session, [0.5, 2], [6, 0]);
    runUntilSettled(session);
    expect(train(session).line).toBe(1);
    expect(session.undo()).toBe(true);
    expect((session.field!.part('points') as Valve).open).toBe(false);
    expect(train(session).line).toBe(0);
    expect(train(session).stage).toBe('home');
    session.dispose();
  });

  it('hands a ball on to a second train whose platform it is set down on', () => {
    const second: TrainDef = {
      kind: 'train',
      id: 'second',
      board: [5, 0, -3],
      home: [6, 0, -3],
      lines: [{ stop: [6, 0, 5], drop: [5, 0, 5] }],
    };
    const session = new Session(room(8, [POINTS, TRAIN, second]));
    stepTicks(session, 3);
    send(session, [0, 0], [0, -5]);
    runUntilSettled(session);
    const p = session.ball.position();
    expect([p.x, p.z]).toEqual([5, 5]);
    expect(session.strokes).toBe(1);
    session.dispose();
  });

  it('is the same ride every time', () => {
    const run = (): number[] => {
      const session = new Session(room(8, [POINTS, TRAIN]));
      stepTicks(session, 3);
      send(session, [0.3, 0], [-0.2, -7]);
      runUntilSettled(session);
      const p = session.ball.position();
      const end = [p.x, p.y, p.z, session.world.tick];
      session.dispose();
      return end;
    };
    expect(run()).toStrictEqual(run());
  });

  it('refuses a line that sets the ball down on its own platform, and a train with no line for points left alone', () => {
    const onPlatform: TrainDef = { ...TRAIN, lines: [{ stop: [0, 0, -4], drop: [0.2, 0, -3] }] };
    expect(() => new Session(room(8, [onPlatform]))).toThrow(/own platform/);
    const noDefault: TrainDef = { ...TRAIN, lines: [{ ...TRAIN.lines[1] }] };
    expect(() => new Session(room(8, [POINTS, noDefault]))).toThrow(/no lever/);
  });
});

// --- Roller coasters ---------------------------------------------------------------

/** A level run, a loop, and a level run out, heading north from just north of the tee. */
const LOOP = coaster([0, 0, -2], 0, [{ run: 1.5 }, { loop: 0.7 }, { run: 1.5 }]);

const coasterOf = (session: Session): CoasterZone => session.zones.find(isCoaster)!;

/** Rolls the ball into the entry at about `speed` and plays the stroke out. Returns what the ride came to. */
function ride(
  def: ZoneDef,
  speed: number,
  half = 12,
): { session: Session; seen: string[]; entered: number | null; out: { x: number; y: number; z: number } | null } {
  const session = new Session(room(half, [], [def]));
  stepTicks(session, 3);
  const seen = cues(session);
  send(session, [0, -1.2], [0, -speed]);
  let out: { x: number; y: number; z: number } | null = null;
  while (session.phase === 'rolling') {
    session.step();
    // Where the track let it go.
    if (!out && (seen.includes('coasterExit') || seen.includes('coasterBack'))) out = { ...session.ball.position() };
  }
  return { session, seen, entered: coasterOf(session).gauge.last, out };
}

describe('a roller coaster (SPEC v7 3.4, 7.4 #5)', () => {
  it('needs what the loop needs: the speed to be at the top of it and stay on', () => {
    const tracks = coasterTracks(LOOP);
    expect(tracks.loops).toHaveLength(1);
    const [first, last, radius] = tracks.loops[0];
    const top = (first + last) / 2;
    expect(tracks.main.points[top].y).toBeCloseTo(2 * radius, 9);
    // Gravity times the radius at the top, and what the climb and the track take on the way there.
    const g = tracks.gravity;
    const expected = Math.sqrt(g * radius + 2 * g * 2 * radius + 2 * tracks.loss * tracks.main.along[top]);
    expect(coasterNeed(LOOP)).toBeCloseTo(expected, 9);
    // The loop comes back down to the ground it left, moved over to one side.
    expect(tracks.main.points[last].y).toBe(0);
    expect(tracks.main.points[last].x).toBeCloseTo(0.6, 9);
  });

  it('takes a ball that is fast enough round the loop and lets it go at the far end', () => {
    const { session, seen, entered } = ride(LOOP, 9);
    expect(entered).toBeGreaterThan(coasterNeed(LOOP));
    expect(seen.filter((name) => name.startsWith('coaster'))).toEqual(['coasterEnter', 'coasterLoop', 'coasterExit']);
    // It came out north of the end of the track, and never went back.
    expect(session.ball.position().z).toBeLessThan(-5);
    expect(session.strokes).toBe(1);
    session.dispose();
  });

  it('lets it go with what speed it has left, along the track', () => {
    const session = new Session(room(12, [], [LOOP]));
    stepTicks(session, 3);
    const seen = cues(session);
    send(session, [0, -1.2], [0, -9]);
    let out: { x: number; z: number } | null = null;
    while (session.phase === 'rolling' && !out) {
      session.step();
      if (seen.includes('coasterExit')) out = { ...session.ball.velocity() };
    }
    const tracks = coasterTracks(LOOP);
    const entered = coasterOf(session).gauge.last!;
    const length = tracks.main.along[tracks.main.along.length - 1];
    // Back on the level it started from: only the track's own drag has been lost.
    const left = Math.sqrt(entered * entered - 2 * tracks.loss * length);
    expect(out!.z).toBeLessThan(0);
    expect(Math.hypot(out!.x, out!.z)).toBeCloseTo(left, 1);
    expect(Math.abs(out!.x)).toBeLessThan(1e-9);
    session.dispose();
  });

  it('rolls a ball that is too slow back and out of the entry, heading the way it came from', () => {
    const { session, seen, entered } = ride(LOOP, 5);
    expect(entered).toBeLessThan(coasterNeed(LOOP));
    expect(seen.filter((name) => name.startsWith('coaster'))).toEqual(['coasterEnter', 'coasterStall', 'coasterBack']);
    // South of the entry again.
    expect(session.ball.position().z).toBeGreaterThan(-2);
    expect(session.strokes).toBe(1);
    session.dispose();
  });

  it('decides by the speed at the entry and by nothing else: at the mark or over it, through; under it, back', () => {
    const need = coasterNeed(LOOP);
    let through = 0;
    let back = 0;
    for (let speed = need - 1.2; speed <= need + 1.2; speed += 0.1) {
      const { session, seen, entered } = ride(LOOP, speed + 1);
      expect(entered).not.toBeNull();
      const made = seen.includes('coasterExit');
      expect(made).toBe(entered! >= need);
      expect(seen.includes('coasterBack')).toBe(!made);
      if (made) through++;
      else back++;
      session.dispose();
    }
    expect(through).toBeGreaterThan(3);
    expect(back).toBeGreaterThan(3);
  });

  it('gives the same ride for the same speed at the entry, to the last bit, whenever it is taken', () => {
    const run = (wait: number, speed: number): number[] => {
      const session = new Session(room(12, [], [LOOP]));
      stepTicks(session, wait);
      const seen = cues(session);
      send(session, [0, -1.2], [0, -speed]);
      let entered = -1;
      let left = -1;
      let out = [0, 0, 0];
      while (session.phase === 'rolling') {
        session.step();
        if (entered < 0 && seen.includes('coasterEnter')) entered = session.world.tick;
        if (left < 0 && (seen.includes('coasterExit') || seen.includes('coasterBack'))) {
          left = session.world.tick;
          const v = session.ball.velocity();
          out = [v.x, v.y, v.z];
        }
      }
      const p = session.ball.position();
      session.dispose();
      return [coasterOf(session).gauge.last!, left - entered, ...out, p.x, p.y, p.z];
    };
    for (const speed of [5, 9]) {
      const first = run(3, speed);
      expect(run(3, speed)).toStrictEqual(first);
      // Taken at another moment of the hole's clock: the same ride.
      expect(run(41, speed)).toStrictEqual(first);
    }
  });

  it('does not take a ball that is lying at the entry, nor one rolling the wrong way through it', () => {
    const session = new Session(room(12, [], [LOOP]));
    stepTicks(session, 3);
    const seen = cues(session);
    session.ball.teleport({ x: 0, y: 0.1, z: -2 });
    stepTicks(session, 60);
    expect(seen).not.toContain('coasterEnter');
    // From the north, heading south over the entry.
    send(session, [0, -3.2], [0, 4]);
    runUntilSettled(session);
    expect(seen).not.toContain('coasterEnter');
    session.dispose();
  });

  it('leaves a ball it has let go alone for a moment, and brings no undo', () => {
    const { session, seen } = ride(LOOP, 5);
    // One ride, though it was let go right at the entry it had gone in by.
    expect(seen.filter((name) => name === 'coasterEnter')).toHaveLength(1);
    expect(session.rewindable).toBe(false);
    session.dispose();
  });

  it('climbs: a ball short of a crest comes back, and one over it gains the speed again on the way down', () => {
    const hill = coaster([0, 0, -2], 0, [{ run: 1 }, { run: 2, rise: 1.2 }, { run: 2, rise: -1.2 }, { run: 1 }]);
    const need = coasterNeed(hill);
    expect(need).toBeGreaterThan(Math.sqrt(2 * 9.81 * 1.2));
    const slow = ride(hill, need - 0.3);
    expect(slow.entered).toBeLessThan(need);
    expect(slow.seen).toContain('coasterBack');
    slow.session.dispose();
    const fast = ride(hill, need + 1.6);
    expect(fast.entered).toBeGreaterThan(need);
    expect(fast.seen).toContain('coasterExit');
    fast.session.dispose();
  });
});

describe('a track that divides (SPEC v7 3.4, 7.4 #5)', () => {
  /** A run to a fork: fast balls go up and on north, slow ones are turned away east. */
  const FORK = coaster([0, 0, -2], 0, [{ run: 2 }], {
    fork: {
      speed: 6,
      high: [{ run: 2, rise: 0.8 }, { run: 1.5 }],
      low: [{ bend: 90, radius: 1.2 }, { run: 1.5 }],
    },
  });

  it('sends a ball by its speed at the fork: the mark or more, the high branch; less, the low', () => {
    const tracks = coasterTracks(FORK);
    const fork = tracks.main.along[tracks.main.along.length - 1];
    let high = 0;
    let low = 0;
    for (let speed = 5; speed <= 9; speed += 0.2) {
      const { session, seen, entered } = ride(FORK, speed);
      const atFork = Math.sqrt(entered! * entered! - 2 * tracks.loss * fork);
      const tookHigh = seen.includes('coasterHigh');
      expect(seen.includes('coasterLow')).toBe(!tookHigh);
      expect(tookHigh).toBe(atFork * atFork >= 36);
      if (tookHigh) high++;
      else low++;
      session.dispose();
    }
    expect(high).toBeGreaterThan(3);
    expect(low).toBeGreaterThan(3);
  });

  it('lets it go at the end of the branch it took', () => {
    const slow = ride(FORK, 5.5);
    expect(slow.seen).toContain('coasterLow');
    expect(slow.seen).toContain('coasterExit');
    // The low branch turns east: a quarter circle of 1.2 m and a run of 1.5 m.
    expect(slow.out!.x).toBeGreaterThan(2.7);
    expect(slow.out!.z).toBeCloseTo(-5.2, 6);
    expect(slow.out!.y).toBeCloseTo(0.1, 3);
    slow.session.dispose();
    const fast = ride(FORK, 11);
    expect(fast.seen).toContain('coasterHigh');
    expect(fast.seen).toContain('coasterExit');
    // The high branch carries straight on north, and ends 0.8 m up.
    expect(fast.out!.z).toBeLessThan(-7.5);
    expect(Math.abs(fast.out!.x)).toBeLessThan(1e-9);
    expect(fast.out!.y).toBeCloseTo(0.9, 2);
    fast.session.dispose();
  });

  it('shows on its gauge the speed that takes the high branch all the way', () => {
    const need = coasterNeed(FORK);
    const just = ride(FORK, need + 1.4);
    expect(just.entered).toBeGreaterThanOrEqual(need);
    expect(just.seen).toContain('coasterHigh');
    expect(just.seen).toContain('coasterExit');
    just.session.dispose();
  });
});
