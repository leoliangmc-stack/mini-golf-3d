import { beforeAll, describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/chapters';
import { BEAT } from '../src/data/worlds/music';
import { REPLAYS } from '../src/debug/replays';
import { playTo } from '../src/debug/search';
import type { Valve } from '../src/game/field/elements';
import type { Belt, Dial, TimeZone } from '../src/game/field/machines';
import { Session } from '../src/game/session';
import { stagesOf } from '../src/level/chapters';
import type { HoleDef } from '../src/level/schema';
import { DEFAULT_BALL } from '../src/physics/ball';
import { cycleValue } from '../src/physics/movers';
import { numberParam, vectorsParam } from '../src/physics/zones';
import { isArm } from '../src/physics/zones/arm';
import { runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const chapter = CHAPTERS[5];
const holes = stagesOf(chapter).flatMap((stage) => stage.holes);
const hole = (id: string): HoleDef => holes.find((h) => h.id === id)!;
const r = DEFAULT_BALL.radius;
const knock = (session: Session, id: string) =>
  (session.field!.part(id) as unknown as { hit(ball: unknown, speed: number): void }).hit(session.ball, 1);

describe('Chapter 6 holes (SPEC v6 3)', () => {
  it('is Machine Works: four worlds and a finale, open from the Chapter 5 finale', () => {
    expect(chapter.id).toBe('ch6');
    expect(chapter.after).toBe('ch5');
    expect(chapter.worlds.map((world) => world.id)).toEqual(['toy', 'assembly', 'music', 'clock']);
    expect(chapter.finale.id).toBe('ch6-finale');
    expect(holes).toHaveLength(13);
  });

  it('has a stroke to take back where a ball can change a machine, and nowhere else (SPEC v6 3.1)', () => {
    const undo = holes.filter((def) => {
      const session = new Session(def);
      const yes = session.rewindable;
      session.dispose();
      return yes;
    });
    expect(undo.map((h) => h.id)).toEqual(['toy-1', 'toy-2', 'toy-3', 'clock-1', 'clock-2', 'clock-3', 'ch6-finale']);
    // On the assembly line and in the music factory everything keeps time, works or no works.
    for (const id of ['assembly-3', 'music-1', 'music-3']) {
      const session = new Session(hole(id));
      expect(session.field).not.toBeNull();
      session.shoot({ x: 0.3, y: 0, z: 1 }, 0.1);
      runUntilSettled(session);
      expect(session.canUndo).toBe(false);
      expect(session.undo()).toBe(false);
      session.dispose();
    }
  });

  it.each(holes)('$id is solved by its reference round with no penalty and no stroke taken back', (def) => {
    const session = playTo(def, REPLAYS[def.id].inputs);
    expect(session.outcome).toMatchObject({ holed: true, stars: 3 });
    expect(session.strokes).toBeLessThanOrEqual(def.par);
    expect(session.stats.undos).toBe(0);
    expect(session.stats.outOfBounds).toBe(0);
    session.dispose();
  });

  it.each(holes.filter((h) => h.field?.parts.some((part) => part.kind === 'belt')))(
    '$id brings every stroke to an end, wherever a belt takes it',
    (def) => {
      for (const degrees of [-60, -25, 0, 25, 60, 180]) {
        for (const power of [0.12, 0.35, 0.7]) {
          const session = new Session(def);
          const angle = (degrees * Math.PI) / 180;
          session.shoot({ x: Math.sin(angle), y: 0, z: -Math.cos(angle) }, power);
          let ticks = 0;
          while (session.phase === 'rolling' && ticks++ < 4000) session.step();
          expect(session.phase).not.toBe('rolling');
          // And it stays ended: no belt moves the ball on while the player aims.
          const at = { ...session.ball.position() };
          for (let i = 0; i < 300 && session.phase === 'aiming'; i++) session.step();
          if (session.phase === 'aiming') {
            const p = session.ball.position();
            expect(Math.hypot(p.x - at.x, p.y - at.y, p.z - at.z)).toBeLessThan(0.05);
          }
          session.dispose();
        }
      }
    },
  );
});

describe('the belts of the Toy Factory (SPEC v6 3.2)', () => {
  it('toy-1: nothing gets up the belt until the lever is thrown', () => {
    const session = new Session(hole('toy-1'));
    session.shoot({ x: 0, y: 0, z: -1 }, 1);
    runUntilSettled(session);
    // Full power, straight at the cup, and it is back on the near side of the belt.
    expect(session.ball.position().z).toBeGreaterThan(3);
    expect(session.outcome).toBeNull();
    session.dispose();
  });

  it('toy-2: with the second belt left as it is, the line ends in the bin, and the stroke is put back', () => {
    const session = new Session(hole('toy-2'));
    knock(session, 'up');
    stepTicks(session, 80);
    const from = { ...session.ball.position() };
    session.shoot({ x: 0, y: 0, z: -1 }, 0.4);
    let ticks = 0;
    while (session.stats.outOfBounds === 0 && ticks++ < 4000) session.step();
    expect(session.stats.outOfBounds).toBe(1);
    expect(session.strokes).toBe(2);
    expect({ ...session.ball.position() }).toEqual(from);
    // The lever was thrown before the stroke that was lost, so it is still thrown.
    expect((session.field!.part('up') as unknown as Valve).open).toBe(true);
    expect((session.field!.part('first') as unknown as Belt).flow).toBe(-1);
    session.dispose();
  });

  it('toy-3: the main belt runs to the cup only with the far lever thrown and the left one not', () => {
    const session = new Session(hole('toy-3'));
    const main = session.field!.part('main') as unknown as Belt;
    const side = session.field!.part('side') as unknown as Belt;
    const state = () => {
      stepTicks(session, 100);
      return { main: main.flow, side: side.flow };
    };
    // Running out of its lane is 1 for both; -1 is toward the cup, and into the side lane.
    expect(state()).toEqual({ main: 1, side: 1 });
    knock(session, 'left');
    expect(state()).toEqual({ main: 1, side: -1 });
    knock(session, 'far');
    expect(state()).toEqual({ main: 1, side: 1 });
    knock(session, 'left');
    expect(state()).toEqual({ main: -1, side: 1 });
    session.dispose();
  });
});

describe('the arms of the Assembly Line (SPEC v6 3.3, 5)', () => {
  const withArms = holes.filter((h) => h.zones.some((zone) => zone.type === 'arm'));

  it.each(withArms)('$id sets a ball down only where a ball can be: on the ground, clear of walls and machines', (def) => {
    for (const zone of def.zones.filter((z) => z.type === 'arm')) {
      for (const drop of vectorsParam(zone, 'drops')) {
        const session = new Session(def);
        expect(session.compiled.ground!.surfaceAt({ x: drop[0], y: drop[1], z: drop[2] })).not.toBeNull();
        const at = { x: drop[0], y: drop[1] + r, z: drop[2] };
        expect(session.movers.some((mover) => mover.forbidsRest(at))).toBe(false);
        expect(session.zones.some((other) => other.forbidsRest?.(at))).toBe(false);
        session.ball.teleport(at);
        session.step();
        // Nothing throws it out: it is not in a wall, and not in the air.
        const p = session.ball.position();
        expect(Math.hypot(p.x - at.x, p.y - at.y, p.z - at.z)).toBeLessThan(0.02);
        expect(session.stats.outOfBounds).toBe(0);
        session.dispose();
      }
      // A trip is a whole number of seconds here, so the lamp's round is easy to learn.
      expect(Number.isInteger(numberParam(zone, 'period'))).toBe(true);
    }
  });

  it('assembly-1: the same stroke lands by the cup or across the way, as the lamp said when it was played', () => {
    const def = hole('assembly-1');
    const play = (wait: number) => {
      const session = new Session(def);
      stepTicks(session, wait);
      const { next, left } = session.zones.find(isArm)!.pose;
      session.shoot({ x: 0, y: 0, z: -1 }, 0.3);
      runUntilSettled(session);
      const x = session.ball.position().x;
      session.dispose();
      return { lamp: next, left, x };
    };
    // Played with time in hand, the ball goes where the lamp pointed: 1 is the cup's side.
    const lamps = new Set<number>();
    for (const wait of [70, 200, 310, 440, 560]) {
      const { lamp, left, x } = play(wait);
      expect(left).toBeGreaterThan(0.2);
      expect(x).toBeCloseTo(lamp === 1 ? -3 : 3, 3);
      lamps.add(lamp);
    }
    expect([...lamps].sort()).toEqual([0, 1]);
    // Played as the countdown runs out, it is too late for that trip and goes on the next.
    const late = play(20);
    expect(late.lamp).toBe(0);
    expect(late.left).toBeLessThan(0.2);
    expect(late.x).toBeCloseTo(-3, 3);
  });

  it('assembly-3: the belt takes the ball from the first arm to the second arm\'s platform by itself', () => {
    const def = hole('assembly-3');
    const [first] = REPLAYS[def.id].inputs;
    const session = playTo(def, [first]);
    const p = session.ball.position();
    expect(session.strokes).toBe(1);
    expect(p.z).toBeLessThan(0);
    expect(p.z).toBeGreaterThan(-6);
    session.dispose();
  });
});

describe('the beat of the Music Factory (SPEC v6 3.4, 7.4 #4)', () => {
  const musical = [...chapter.worlds[2].holes];

  it('gives every hole of the world a beat of whole ticks, and the finale too', () => {
    for (const def of [...musical, chapter.finale.holes[0]]) {
      expect(def.beat?.ticks).toBe(BEAT);
      expect(Number.isInteger(def.beat!.ticks)).toBe(true);
    }
    // And no other hole of the chapter keeps one.
    for (const def of holes) {
      if (!musical.includes(def) && def !== chapter.finale.holes[0]) expect(def.beat).toBeUndefined();
    }
  });

  it.each(musical)('$id: every machine repeats in a whole number of beats', (def) => {
    for (const mover of def.movers ?? []) {
      const ticks = mover.motion.period * 60;
      expect(ticks / BEAT).toBeCloseTo(Math.round(ticks / BEAT), 9);
      // Where it is in its travel depends on the beat alone: the same eight beats on.
      if (mover.motion.type !== 'spin') {
        for (const tick of [0, 13, 77, 150]) expect(cycleValue(tick + ticks, mover.motion)).toBe(cycleValue(tick, mover.motion));
      }
    }
    for (const zone of def.zones.filter((z) => z.type === 'drum')) {
      expect(numberParam(zone, 'ticks') % BEAT).toBe(0);
      expect(numberParam(zone, 'offset', 0) % BEAT).toBe(0);
    }
    for (const part of def.field?.parts ?? []) {
      // A gate that keeps the beat answers it on the very tick, not a few ticks down a wire.
      if (part.kind === 'gate') expect(part.delay).toBe(1);
    }
  });

  it('music-2: a key carries a ball that rolls on as it is about to rise, and stops one that comes late', () => {
    const def = hole('music-2');
    const [first] = REPLAYS[def.id].inputs;
    const onTime = playTo(def, [first]);
    expect(onTime.ball.position().y).toBeGreaterThan(0.6);
    onTime.dispose();

    const late = new Session(def);
    stepTicks(late, 130);
    late.shoot({ x: 0, y: 0, z: -1 }, 0.5);
    runUntilSettled(late);
    // The key was up when it got there: it met a wall, and is still on the bottom floor.
    expect(late.ball.position().y).toBeCloseTo(r, 2);
    expect(late.ball.position().z).toBeGreaterThan(3);
    expect(late.stats.moverHits).toBeGreaterThan(0);
    expect(late.stats.outOfBounds).toBe(0);
    late.dispose();
  });

  it('music-3: the drum throws the ball up to the next floor, onto something soft', () => {
    const def = hole('music-3');
    const [first] = REPLAYS[def.id].inputs;
    const session = new Session(def);
    const cues: string[] = [];
    session.on((event) => event.type === 'cue' && cues.push(event.name));
    session.replay([first]);
    let highest = 0;
    for (let i = 0; i < 3000 && (session.replaying || session.phase === 'rolling'); i++) {
      session.step();
      highest = Math.max(highest, session.ball.position().y);
    }
    expect(cues).toContain('drumThrow');
    expect(highest).toBeGreaterThan(2);
    expect(session.ball.position().y).toBeCloseTo(1 + r, 2);
    expect(session.stats.wallHits).toBe(0);
    session.dispose();
  });
});

describe('the clocks of Clockwork (SPEC v6 3.5, 7.4 #7)', () => {
  it('clock-1: the piston runs at double speed until the switch is knocked, then at half', () => {
    const session = new Session(hole('clock-1'));
    const zone = session.field!.part('zone') as unknown as TimeZone;
    const dial = session.field!.part('dial') as unknown as Dial;
    stepTicks(session, 20);
    expect(dial.rate).toBe(2);
    expect(zone.rate).toBe(2);
    knock(session, 'dial');
    stepTicks(session, 20);
    expect(dial.rate).toBe(0.5);
    expect(zone.rate).toBe(0.5);
    session.dispose();
  });

  it('clock-2: the two bridges are never both in place while their clocks agree, and are once they do not', () => {
    const def = hole('clock-2');
    const [near, far] = def.movers!;
    const inPlace = (session: Session) => {
      const zones = ['near', 'far'].map((id) => session.field!.part(id) as unknown as TimeZone);
      return cycleValue(zones[0].now, near.motion as never) === 0 && cycleValue(zones[1].now, far.motion as never) === 0;
    };
    const together = (session: Session, ticks: number) => {
      let count = 0;
      for (let i = 0; i < ticks; i++) {
        session.step();
        if (inPlace(session)) count++;
      }
      return count;
    };
    const agreed = new Session(def);
    expect(together(agreed, 1440)).toBe(0);
    agreed.dispose();

    const apart = new Session(def);
    knock(apart, 'nearDial');
    // Long enough at a time to cross both: a second and more, again and again.
    expect(together(apart, 1440)).toBeGreaterThan(200);
    apart.dispose();
  });

  it('clock-3: the windmills go slow while the ball is among them and fast again once it is through (7.4 #7)', () => {
    const def = hole('clock-3');
    const session = new Session(def);
    session.replay(REPLAYS[def.id].inputs);
    // After `replay`: it starts the round afresh, with new works.
    const zone = session.field!.part('mills') as unknown as TimeZone;
    const seen: { rate: number; inside: boolean }[] = [];
    let clock = 0;
    for (let i = 0; i < 20000 && session.playing; i++) {
      const before = zone.now;
      session.step();
      seen.push({ rate: zone.rate, inside: zone.holds(session.ball) });
      // The clock only ever goes forward, by exactly its rate.
      expect(zone.now - before).toBe(zone.rate);
      clock = zone.now;
    }
    expect(session.outcome).toMatchObject({ holed: true, stars: 3 });
    expect(seen[0]).toEqual({ rate: 2, inside: false });
    // Slow for as long as the ball was inside, give or take the dozen ticks it takes to
    // change each time the ball comes in: it does so twice in this round.
    const inside = seen.filter((tick) => tick.inside);
    expect(inside.length).toBeGreaterThan(60);
    expect(inside.filter((tick) => tick.rate === 0.5).length).toBeGreaterThan(inside.length - 30);
    // And fast for the rest of the round, once it had left.
    const left = seen.map((tick) => tick.inside).lastIndexOf(true);
    expect(seen.slice(left + 20).every((tick) => tick.rate === 2)).toBe(true);
    expect(clock).toBeGreaterThan(session.world.tick);
    session.dispose();
  });
});

describe('the Chapter 6 finale (SPEC v6 3.6, 7.4 #10)', () => {
  const def = chapter.finale.holes[0];

  it('is finished within par without touching a moving machine, which is its third star', () => {
    expect(def.challenge?.type).toBe('noMoverHits');
    const session = playTo(def, REPLAYS[def.id].inputs);
    expect(session.outcome).toMatchObject({ holed: true, stars: 3, challengeMet: true });
    expect(session.strokes).toBeLessThanOrEqual(def.par);
    expect(session.stats.moverHits).toBe(0);
    session.dispose();
  });

  it('goes through all four machines, in the order the line runs', () => {
    const session = new Session(def);
    const cues: string[] = [];
    session.on((event) => event.type === 'cue' && cues.push(event.name));
    session.replay(REPLAYS[def.id].inputs);
    for (let i = 0; i < 20000 && session.playing; i++) session.step();
    const first = (name: string) => cues.indexOf(name);
    const order = ['leverOn', 'beltTurn', 'armCatch', 'armRelease', 'drumThrow', 'dialTurn', 'timeSlow'];
    for (const name of order) expect(first(name), name).toBeGreaterThanOrEqual(0);
    expect(order.map(first)).toEqual([...order.map(first)].sort((a, b) => a - b));
    expect(session.outcome?.holed).toBe(true);
    session.dispose();
  });

  it('cannot be started without the lever: the belt out of the first room runs the wrong way', () => {
    const session = new Session(def);
    session.shoot({ x: 0, y: 0, z: -1 }, 1);
    runUntilSettled(session);
    expect(session.ball.position().z).toBeGreaterThan(14);
    session.dispose();
  });
});
