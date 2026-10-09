import { beforeAll, describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/chapters';
import { REPLAYS } from '../src/debug/replays';
import { playTo } from '../src/debug/search';
import type { Echo, EchoPlate } from '../src/game/field/strange';
import type { Gate, Plate } from '../src/game/field/tomb';
import { goalCups } from '../src/game/goal';
import { Session, type InputRecord } from '../src/game/session';
import { stagesOf } from '../src/level/chapters';
import type { EchoDef, EchoPlateDef } from '../src/level/field';
import type { HoleDef } from '../src/level/schema';
import { DEFAULT_BALL } from '../src/physics/ball';
import { phantomDue } from '../src/physics/movers';
import { RAPIER } from '../src/physics/rapier';
import { hallOf, WRAP_APRON } from '../src/physics/zones/wrap';
import { framingPoints } from '../src/render/framing';
import { runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const chapter = CHAPTERS[7];
const holes = stagesOf(chapter).flatMap((stage) => stage.holes);
const hole = (id: string): HoleDef => holes.find((h) => h.id === id)!;
const r = DEFAULT_BALL.radius;
const at = (session: Session) => session.ball.position();
const shot = (input: InputRecord) => input as InputRecord & { type: 'shot' };

describe('Chapter 8 holes (SPEC v8 3)', () => {
  it('is Strange Dimensions: four worlds and a finale, open from the Chapter 7 finale', () => {
    expect(chapter.id).toBe('ch8');
    expect(chapter.after).toBe('ch7');
    expect(chapter.worlds.map((world) => world.id)).toEqual(['phantom', 'hall', 'mirror', 'echo']);
    expect(chapter.finale.id).toBe('ch8-finale');
    expect(holes).toHaveLength(13);
  });

  it('has a stroke to take back where a ball can change the course: not on the bridges, not in the hall (SPEC v8 3.1)', () => {
    const undo = holes.filter((def) => {
      const session = new Session(def);
      const yes = session.rewindable;
      session.dispose();
      return yes;
    });
    expect(undo.map((h) => h.id)).toEqual(['mirror-1', 'mirror-2', 'mirror-3', 'echo-1', 'echo-2', 'echo-3', 'ch8-finale']);
  });

  it.each(holes)('$id is solved by its reference round with no penalty and no stroke taken back', (def) => {
    const session = playTo(def, REPLAYS[def.id].inputs);
    expect(session.outcome).toMatchObject({ holed: true, stars: 3 });
    expect(session.strokes).toBeLessThanOrEqual(def.par);
    expect(session.stats.undos).toBe(0);
    expect(session.stats.outOfBounds).toBe(0);
    session.dispose();
  });

  it.each(holes)('$id ends every stroke, and leaves every ball that has stopped where it stopped', (def) => {
    // Strokes in every direction at three strengths, begun at different moments of a
    // bridge's cycle: none may go on for ever, and once one is over nothing may move.
    for (let n = 0; n < 18; n++) {
      const session = new Session(def);
      stepTicks(session, 5 + n * 23);
      const angle = (n / 18) * Math.PI * 2;
      session.shoot({ x: Math.sin(angle), y: 0, z: Math.cos(angle) }, [0.3, 0.6, 1][n % 3]);
      expect(runUntilSettled(session, 6000)).toBeLessThan(6000);
      if (session.phase === 'aiming') {
        const rests = session.balls.live.map((ball) => ({ ...ball.position() }));
        stepTicks(session, 320);
        expect(session.phase).toBe('aiming');
        session.balls.live.forEach((ball, i) => {
          const p = ball.position();
          expect(Math.hypot(p.x - rests[i].x, p.y - rests[i].y, p.z - rests[i].z)).toBeLessThan(1e-3);
        });
      }
      session.dispose();
    }
  });

  it('uses no gravity zone, no splitting and no skill anywhere in the chapter (SPEC v8 5, 6)', () => {
    for (const def of holes) {
      expect(def.zones.some((zone) => zone.type === 'gravity')).toBe(false);
      expect(def.maxBalls ?? 1).toBe(1);
      expect(def.skills).toBeUndefined();
    }
  });
});

describe('Phantom Bridges (SPEC v8 3.2)', () => {
  const world = chapter.worlds[0];
  const bridges = [...world.holes, chapter.finale.holes[0]].flatMap((def) => (def.movers ?? []).filter((m) => m.phantom).map((mover) => ({ def, mover })));

  it('sets a ball down on solid ground from a bridge of the first two holes, and keeps it on one of the third', () => {
    expect(bridges).toHaveLength(1 + 2 + 5 + 2);
    for (const { def, mover } of bridges) {
      if (def.id === 'phantom-3') {
        expect(mover.phantom!.holds).toBe(true);
        expect(mover.rest).toBeUndefined();
        continue;
      }
      expect(mover.phantom!.holds ?? false).toBe(false);
      // A place at each end, on the ground and clear of the bridge.
      expect(mover.rest!.length).toBe(2);
      const session = new Session(def);
      for (const [x, y, z] of mover.rest!) {
        expect(session.compiled.ground!.surfaceAt({ x, y, z })).not.toBeNull();
        expect(Math.abs(x - mover.position[0]) > mover.size[0] / 2 || Math.abs(z - mover.position[2]) > mover.size[2] / 2).toBe(true);
      }
      session.dispose();
    }
  });

  it('gives a second of warning or near it before a bridge goes, and time enough to cross while it is there', () => {
    for (const { mover } of bridges) {
      const { period, shown, warn } = mover.phantom!;
      expect(period * shown).toBeGreaterThanOrEqual(2);
      expect(warn ?? 0.8).toBeGreaterThanOrEqual(0.6);
      expect(period * (1 - shown)).toBeGreaterThanOrEqual(2);
    }
  });

  it('phantom-1: the same stroke crosses while the bridge is there and falls when it is not', () => {
    const def = hole('phantom-1');
    const first = shot(REPLAYS[def.id].inputs[0]);
    const late = playTo(def, [{ ...first, tick: 200 }]);
    expect(late.movers[0].def.phantom).toBeDefined();
    expect(phantomDue(late.movers[0].def.phantom!, 230)).toBe(false);
    expect(late.stats.outOfBounds).toBe(1);
    expect(late.strokes).toBe(2);
    expect(late.outcome).toBeNull();
    late.dispose();
  });

  it('phantom-1: a ball that stops on the bridge is set down on the near bank or the far one', () => {
    const def = hole('phantom-1');
    // Slow rolls, begun while the bridge is away so that it has only just come when they reach it.
    for (const power of [0.26, 0.28]) {
      const session = new Session(def);
      stepTicks(session, 245);
      session.shoot({ x: 0, y: 0, z: -1 }, power);
      let last = { ...at(session) };
      while (session.phase === 'rolling') {
        last = { ...at(session) };
        session.step();
      }
      // It did stop over the gap, with the bridge still under it, and it is not there now.
      expect(last.z).toBeLessThan(3);
      expect(last.z).toBeGreaterThan(-2);
      expect(session.movers[0].present).toBe(true);
      const p = at(session);
      expect([3.8, -2.8]).toContain(Math.round(p.z * 10) / 10);
      expect(session.stats.outOfBounds).toBe(0);
      session.dispose();
    }
  });

  it('phantom-2: the two bridges are never there together, and never both gone', () => {
    const [first, second] = hole('phantom-2').movers!;
    for (let tick = 0; tick < 600; tick++) {
      expect(phantomDue(first.phantom!, tick)).toBe(!phantomDue(second.phantom!, tick));
    }
  });

  it('phantom-2: can be done a bridge at a time, waiting on the island', () => {
    const def = hole('phantom-2');
    // Over the first early in its turn, to stop on the island; over the second in its own.
    const session = playTo(def, [
      { type: 'shot', tick: 20, dir: [0, 0, -1], power: 0.5 },
      { type: 'shot', tick: 470, dir: [0, 0, -1], power: 0.5 },
    ]);
    expect(session.stats.outOfBounds).toBe(0);
    expect(session.strokes).toBe(2);
    expect(at(session).z).toBeLessThan(-5);
    session.dispose();
  });

  it('phantom-3: a ball that stops on a bridge goes down with it, and one that stops on the island does not', () => {
    const def = hole('phantom-3');
    const short = playTo(def, [{ type: 'shot', tick: 40, dir: [0, 0, -1], power: 0.4 }], 4000);
    expect(short.stats.outOfBounds).toBe(1);
    expect(at(short).z).toBeCloseTo(11, 2);
    short.dispose();

    const island = playTo(def, [REPLAYS[def.id].inputs[0]]);
    expect(island.stats.outOfBounds).toBe(0);
    expect(island.phase).toBe('aiming');
    const p = at(island);
    expect(p.z).toBeLessThan(0);
    expect(p.z).toBeGreaterThan(-3);
    // The dust stopped it; and it stays, whatever the bridges do.
    stepTicks(island, 600);
    expect(at(island).z).toBeCloseTo(p.z, 3);
    island.dispose();
  });
});

describe('Endless Hall (SPEC v8 3.3, 5)', () => {
  const halls = holes.flatMap((def) => def.zones.filter((zone) => zone.type === 'wrap').map((zone) => ({ def, hall: hallOf(zone) })));

  it('has a hall on each hole of the world and in the finale, big enough to plan in and small enough to see', () => {
    expect(halls.map(({ def }) => def.id)).toEqual(['hall-1', 'hall-2', 'hall-3', 'ch8-finale']);
    for (const { hall } of halls) {
      expect(hall.x || hall.z).toBe(true);
      for (const span of [hall.max[0] - hall.min[0], hall.max[1] - hall.min[1]]) {
        expect(span).toBeGreaterThanOrEqual(6);
        expect(span).toBeLessThanOrEqual(12);
      }
    }
  });

  it('puts the cup in the hall, or beyond an edge that is not joined', () => {
    for (const { def, hall } of halls) {
      for (const cup of goalCups(def.goal)) {
        const [x, , z] = cup.position;
        const beyondJoinedX = hall.x && (x < hall.min[0] || x > hall.max[0]) && z > hall.min[1] && z < hall.max[1];
        const beyondJoinedZ = hall.z && (z < hall.min[1] || z > hall.max[1]) && x > hall.min[0] && x < hall.max[0];
        expect(beyondJoinedX || beyondJoinedZ).toBe(false);
      }
    }
  });

  it('is built alike on both sides of every joined line: wherever a ball can be just past one, it can be where it is taken to (SPEC v8 5)', () => {
    const shape = new RAPIER.Ball(r - 0.004);
    const still = { x: 0, y: 0, z: 0, w: 1 };
    for (const { def, hall } of halls) {
      const session = new Session(def);
      stepTicks(session, 2);
      const ground = session.compiled.ground!;
      const fits = (x: number, z: number): boolean => {
        let free = true;
        session.world.raw.intersectionsWithShape({ x, y: hall.y + r, z }, still, shape, (collider) => {
          if (session.balls.owner(collider.handle)) return true;
          free = false;
          return false;
        });
        return free;
      };
      let tried = 0;
      const check = (x: number, z: number, dx: number, dz: number): void => {
        // Ground to cross on, this side of the line and that.
        expect(ground.surfaceAt({ x, y: hall.y, z })).not.toBeNull();
        expect(ground.surfaceAt({ x: x + dx, y: hall.y, z: z + dz })).not.toBeNull();
        if (!fits(x, z)) return;
        tried++;
        expect(fits(x + dx, z + dz), `${def.id}: a ball at (${x.toFixed(2)}, ${z.toFixed(2)}) is taken into something`).toBe(true);
      };
      const width = hall.max[0] - hall.min[0];
      const depth = hall.max[1] - hall.min[1];
      for (const past of [0.02, 0.12, 0.22, 0.32]) {
        if (hall.x) {
          for (let z = hall.min[1] + 0.05; z < hall.max[1]; z += 0.1) {
            check(hall.max[0] + past, z, -width, 0);
            check(hall.min[0] - past, z, width, 0);
          }
        }
        if (hall.z) {
          for (let x = hall.min[0] + 0.05; x < hall.max[0]; x += 0.1) {
            check(x, hall.max[1] + past, 0, -depth);
            check(x, hall.min[1] - past, 0, depth);
          }
        }
      }
      expect(tried).toBeGreaterThan(200);
      expect(WRAP_APRON).toBeGreaterThan(0.32 + r);
      session.dispose();
    }
  });

  it('keeps a ball in play however it is struck: no stroke from any tee ends out of bounds or in a wall', () => {
    for (const id of ['hall-1', 'hall-2', 'hall-3']) {
      for (let n = 0; n < 36; n++) {
        const session = new Session(hole(id));
        stepTicks(session, 5);
        const angle = (n / 36) * Math.PI * 2 + 0.03;
        session.shoot({ x: Math.sin(angle), y: 0, z: Math.cos(angle) }, [1, 0.7, 0.45][n % 3]);
        let lowest = Infinity;
        while (session.phase === 'rolling') {
          session.step();
          lowest = Math.min(lowest, at(session).y);
        }
        expect(lowest).toBeGreaterThan(r - 0.002);
        expect(session.stats.outOfBounds).toBe(0);
        session.dispose();
      }
    }
  });

  it('hall-1: the cup cannot be reached the straight way, and is reached by going out the other side', () => {
    const def = hole('hall-1');
    const straight = playTo(def, [{ type: 'shot', tick: 10, dir: [6, 0, -3], power: 0.4 }]);
    expect(straight.outcome).toBeNull();
    expect(straight.stats.cues.wrap ?? 0).toBe(0);
    expect(at(straight).x).toBeLessThan(0);
    straight.dispose();
    const round = playTo(def, REPLAYS[def.id].inputs);
    expect(round.stats.cues.wrap).toBe(1);
    expect(round.strokes).toBe(1);
    round.dispose();
  });

  it('hall-2: one stroke through the corner crosses both pairs of edges', () => {
    const round = playTo(hole('hall-2'), REPLAYS['hall-2'].inputs);
    expect(round.strokes).toBe(1);
    expect(round.stats.cues.wrap).toBeGreaterThanOrEqual(1);
    round.dispose();
    // And a room at a time: out by the left edge into the room below the cup's, then out by the near edge.
    const session = new Session(hole('hall-2'));
    stepTicks(session, 5);
    session.shoot({ x: -1, y: 0, z: 0 }, 0.3);
    runUntilSettled(session);
    expect(at(session).x).toBeGreaterThan(0);
    expect(at(session).z).toBeGreaterThan(0);
    session.dispose();
  });

  it('hall-3: no round reaches the cup with fewer than two crossings, and the reference round makes two', () => {
    const def = hole('hall-3');
    const round = playTo(def, REPLAYS[def.id].inputs);
    expect(round.stats.cues.wrap).toBeGreaterThanOrEqual(2);
    round.dispose();
    // Every stroke from the tee that crosses no edge, or one, leaves the ball outside the pen.
    for (let n = 0; n < 72; n++) {
      const angle = (n / 72) * Math.PI * 2;
      for (const power of [0.2, 0.35, 0.5]) {
        const session = playTo(def, [{ type: 'shot', tick: 10, dir: [Math.sin(angle), 0, Math.cos(angle)], power }]);
        const p = at(session);
        const inPen = p.x > 0.2 && p.z < -0.2 && p.z > -3.3;
        if (inPen || session.outcome) expect(session.stats.cues.wrap ?? 0).toBeGreaterThanOrEqual(2);
        session.dispose();
      }
    }
  });

  it('keeps the whole hall in the picture while the ball is in it, so a crossing does not move the camera', () => {
    for (const { def, hall } of halls) {
      const inside = { x: (hall.min[0] + hall.max[0]) / 2, y: hall.y, z: (hall.min[1] + hall.max[1]) / 2 };
      const points = framingPoints(def, inside);
      expect(points.length).toBeGreaterThanOrEqual(4);
      for (const corner of [hall.min, hall.max]) {
        expect(points.some((p) => p.x === corner[0] && p.z === corner[1])).toBe(true);
      }
      // Far outside it, the hall is not held in view.
      expect(framingPoints(def, { x: 60, y: 0, z: 60 }).length).toBe(def.camera?.keep?.length ?? 0);
    }
  });
});

describe('Mirror Maze (SPEC v8 3.4)', () => {
  const mirrored = holes.filter((def) => def.mirror);

  it('has a mirror on each hole of the world and in the finale, standing on a wall', () => {
    expect(mirrored.map((def) => def.id)).toEqual(['mirror-1', 'mirror-2', 'mirror-3', 'ch8-finale']);
    for (const def of mirrored) {
      const { axis, at: line, span } = def.mirror!;
      expect(axis).toBe('x');
      // A wall of glass along the whole of it: neither ball can change sides.
      const glass = def.pieces.filter((piece) => piece.type === 'wall' && piece.surface === 'glass' && piece.from[0] === line && piece.to[0] === line);
      expect(glass).toHaveLength(1);
      const wall = glass[0] as { from: readonly [number, number]; to: readonly [number, number] };
      expect(Math.min(wall.from[1], wall.to[1])).toBeLessThanOrEqual(Math.min(...span));
      expect(Math.max(wall.from[1], wall.to[1])).toBeGreaterThanOrEqual(Math.max(...span));
    }
  });

  it.each(mirrored)('$id: neither ball ever gets to the other side of the glass, and the shadow is never holed', (def) => {
    const line = def.mirror!.at;
    // The finale's shadow only stirs for a stroke played in front of the mirror: start there.
    const start = def.id === 'ch8-finale' ? { x: 2, y: r, z: 1 } : null;
    for (let n = 0; n < 24; n++) {
      const session = new Session(def);
      stepTicks(session, 5);
      if (start) session.ball.teleport(start);
      const rolling = (): boolean => session.phase === 'rolling';
      for (let stroke = 0; stroke < 3 && !rolling() && session.playing; stroke++) {
        const angle = ((n * 7 + stroke * 5) / 24) * Math.PI * 2;
        session.shoot({ x: Math.sin(angle), y: 0, z: Math.cos(angle) }, [0.45, 0.8, 1][(n + stroke) % 3]);
        while (rolling()) {
          session.step();
          if (session.balls.live.includes(session.ball) && session.ball.body.isEnabled()) expect(at(session).x).toBeLessThan(line);
          expect(session.shadow!.position().x).toBeGreaterThan(line);
        }
      }
      expect(session.balls.sunk).not.toContain(session.shadow);
      session.dispose();
    }
  });

  it('mirror-1: a stroke up the room rolls the shadow over the plate, and the gate is open for good', () => {
    const def = hole('mirror-1');
    const session = playTo(def, [{ type: 'shot', tick: 10, dir: [0, 0, -1], power: 0.45 }]);
    expect((session.field!.part('plate') as Plate).on).toBe(true);
    expect((session.field!.part('gate') as Gate).open).toBe(true);
    // The ball itself went nowhere near the plate.
    expect(at(session).x).toBeLessThan(0);
    session.dispose();
  });

  it('mirror-2: the same strokes take the two balls different ways, because the rooms are not alike', () => {
    const def = hole('mirror-2');
    // Straight up the room: the shadow meets its wall long before the ball meets its own.
    const session = playTo(def, [{ type: 'shot', tick: 10, dir: [0, 0, -1], power: 0.5 }]);
    const mine = at(session);
    const theirs = session.shadow!.position();
    // Reflections of each other they are not, any more.
    expect(Math.hypot(mine.x + theirs.x, mine.z - theirs.z)).toBeGreaterThan(1);
    expect(theirs.z).toBeGreaterThan(1);
    expect(mine.z).toBeLessThan(1);
    session.dispose();
    // The reference round steers the shadow round that wall and onto the plate in two strokes.
    const steered = playTo(def, REPLAYS[def.id].inputs.slice(0, 2));
    expect((steered.field!.part('plate') as Plate).on).toBe(true);
    steered.dispose();
    // The straight way to the plate is walled off on the shadow's side.
    const straight = playTo(def, [{ type: 'shot', tick: 10, dir: [-1.5, 0, -6.5], power: 0.5 }]);
    expect((straight.field!.part('plate') as Plate).on).toBe(false);
    straight.dispose();
  });

  it('mirror-3: with the shadow in its nook, a stroke up the room keeps the gate open and a stroke down it does not', () => {
    const def = hole('mirror-3');
    const parked = REPLAYS[def.id].inputs.slice(0, 3);
    const base = playTo(def, parked);
    const tick = base.world.tick + 30;
    const plate = (s: Session) => s.field!.part('plate') as Plate;
    expect(plate(base).pressed).toBe(true);
    expect((base.field!.part('gate') as Gate).open).toBe(true);
    base.dispose();

    for (const [x, z] of [[0, -1], [0.5, -1], [-0.5, -1], [0.9, -1]] as const) {
      const up = new Session(def);
      up.replay([...parked, { type: 'shot', tick, dir: [x, 0, z], power: 0.5 }]);
      let let_go = false;
      while (up.replaying || up.phase === 'rolling') {
        up.step();
        if (up.world.tick > tick && !plate(up).pressed) let_go = true;
      }
      expect(let_go).toBe(false);
      expect((up.field!.part('gate') as Gate).open).toBe(true);
      up.dispose();
    }
    const down = playTo(def, [...parked, { type: 'shot', tick, dir: [0, 0, 1], power: 0.3 }]);
    expect(plate(down).pressed).toBe(false);
    expect((down.field!.part('gate') as Gate).open).toBe(false);
    down.dispose();
  });

  it('mirror-3: takes a stroke back with the plate, the gate and the shadow all as they were (SPEC v8 7.4 #8)', () => {
    const def = hole('mirror-3');
    const inputs = REPLAYS[def.id].inputs;
    const before = playTo(def, inputs.slice(0, 2));
    const field = before.field!.save();
    const mine = { ...at(before) };
    const theirs = { ...before.shadow!.position() };
    const tick = before.world.tick;
    before.dispose();

    const session = playTo(def, [...inputs.slice(0, 3), { type: 'undo', tick: shot(inputs[3]).tick }]);
    expect(session.stats.undos).toBe(1);
    expect(session.strokes).toBe(4);
    expect(session.field!.save()).toStrictEqual(field);
    expect({ ...at(session) }).toStrictEqual(mine);
    expect({ ...session.shadow!.position() }).toStrictEqual(theirs);
    expect(session.world.tick).toBeGreaterThan(tick);
    expect((session.field!.part('plate') as Plate).pressed).toBe(false);
    session.dispose();
  });
});

describe('Echo (SPEC v8 3.5)', () => {
  const withEchoes = holes.filter((def) => def.field?.parts.some((part) => part.kind === 'echo'));

  it('lists the echo zones of a hole before its silver plates, and lays every silver plate in a zone', () => {
    expect(withEchoes.map((def) => def.id)).toEqual(['echo-1', 'echo-2', 'echo-3', 'ch8-finale']);
    for (const def of withEchoes) {
      const parts = def.field!.parts;
      const zones = parts.filter((part): part is EchoDef => part.kind === 'echo');
      const plates = parts.filter((part): part is EchoPlateDef => part.kind === 'echoPlate');
      expect(plates.length).toBeGreaterThanOrEqual(1);
      const lastZone = Math.max(...zones.map((zone) => parts.indexOf(zone)));
      for (const plate of plates) {
        expect(parts.indexOf(plate)).toBeGreaterThan(lastZone);
        const [x, , z] = plate.at;
        const reach = plate.radius ?? 0.45;
        expect(zones.some((zone) => x - reach >= zone.min[0] && x + reach <= zone.max[0] && z - reach >= zone.min[1] && z + reach <= zone.max[1])).toBe(true);
      }
      // A gate here listens to silver plates, or, in the finale, to the shadow's plate as well.
      expect(parts.some((part) => part.kind === 'gate')).toBe(true);
    }
  });

  it('echo-1: rolling onto the silver plate does nothing; the next stroke sends the echo there, and the gate stays open', () => {
    const def = hole('echo-1');
    const [first, second] = REPLAYS[def.id].inputs;
    const one = playTo(def, [first]);
    const silver = (s: Session) => s.field!.part('silver') as EchoPlate;
    expect(Math.hypot(at(one).x, at(one).z - 5.2)).toBeLessThan(0.6);
    stepTicks(one, 200);
    expect(silver(one).on).toBe(false);
    expect((one.field!.part('gate') as Gate).open).toBe(false);
    one.dispose();

    // A stroke too hard gets to the gate before the echo is on the plate, and comes back off it.
    const hard = playTo(def, [first, { ...shot(second), power: 1 }]);
    expect(hard.outcome).toBeNull();
    expect(at(hard).z).toBeGreaterThan(-2);
    // The gate is open all the same, for good, and the next stroke goes through.
    expect(silver(hard).on).toBe(true);
    expect((hard.field!.part('gate') as Gate).open).toBe(true);
    hard.dispose();
  });

  it('echo-2: too hard a second stroke beats the echo to the gate, and the gate shuts again on the stroke after', () => {
    const def = hole('echo-2');
    const [first, second] = REPLAYS[def.id].inputs;
    const early = playTo(def, [first, { ...shot(second), power: 0.9 }]);
    expect(early.outcome).toBeNull();
    expect(early.stats.wallHits).toBeGreaterThan(0);
    expect(at(early).x).toBeLessThan(4);
    // By now the echo is standing on the plate and the gate is open, for as long as nothing is played.
    const gate = early.field!.part('gate') as Gate;
    stepTicks(early, 240);
    expect(gate.open).toBe(true);
    // The next stroke replaces that echo with one that began off the plate.
    early.shoot({ x: 1, y: 0, z: 0 }, 0.2);
    stepTicks(early, 40);
    expect((early.field!.part('silver') as EchoPlate).pressed).toBe(false);
    expect(gate.open).toBe(false);
    early.dispose();
  });

  it('echo-2: can be done the patient way too: a stroke that barely leaves the plate has an echo that never does', () => {
    const def = hole('echo-2');
    const first = REPLAYS[def.id].inputs[0];
    const session = playTo(def, [
      first,
      { type: 'shot', tick: 182, dir: [1, 0, 0], power: 0.062 },
      { type: 'shot', tick: 260, dir: [0.9998476951563913, 0, 0.017452406437283376], power: 0.62 },
    ]);
    expect(session.outcome).toMatchObject({ holed: true, strokes: 3 });
    session.dispose();
  });

  it('echo-3: one stroke lays both stretches of echo, and the gate wants both', () => {
    const def = hole('echo-3');
    const [first, second] = REPLAYS[def.id].inputs;
    const one = playTo(def, [first]);
    const heard = (s: Session, id: string) => (s.field!.part(id) as Echo).heard!;
    expect(heard(one, 'near').at.length).toBeGreaterThan(5);
    expect(heard(one, 'far').at.length).toBeGreaterThan(5);
    // The far stretch was crossed later than the near one: the echoes will run in that order too.
    expect(heard(one, 'far').at[0]).toBeGreaterThan(heard(one, 'near').at.at(-1)!);
    expect((one.field!.part('gate') as Gate).open).toBe(false);
    one.dispose();

    const session = new Session(def);
    session.replay([first, second]);
    const pressed: string[] = [];
    let opened = -1;
    while (session.playing && session.world.tick < 3000) {
      session.step();
      for (const id of ['first', 'second']) {
        if ((session.field!.part(id) as EchoPlate).on && !pressed.includes(id)) pressed.push(id);
      }
      if (opened < 0 && (session.field!.part('gate') as Gate).open) opened = pressed.length;
    }
    expect(pressed).toEqual(['first', 'second']);
    // Not on the first plate alone.
    expect(opened).toBe(2);
    expect(session.outcome).toMatchObject({ holed: true, strokes: 2 });
    session.dispose();
  });

  it('echo-3: a stroke over one plate only opens nothing, however often it is echoed', () => {
    const def = hole('echo-3');
    const session = new Session(def);
    stepTicks(session, 5);
    // Straight at the near plate and no further.
    session.shoot({ x: 1.5, y: 0, z: -3 }, 0.2);
    runUntilSettled(session);
    session.shoot({ x: 0, y: 0, z: 1 }, 0.1);
    runUntilSettled(session);
    stepTicks(session, 300);
    expect((session.field!.part('first') as EchoPlate).on).toBe(true);
    expect((session.field!.part('second') as EchoPlate).on).toBe(false);
    expect((session.field!.part('gate') as Gate).open).toBe(false);
    session.dispose();
  });
});

describe('the Chapter 8 finale: Strange Gate (SPEC v8 3.6)', () => {
  const def = chapter.finale.holes[0];
  const inputs = REPLAYS[def.id].inputs;

  it('asks for a round with no ball out of bounds, and has a stroke to take back', () => {
    expect(def.challenge?.type).toBe('noOutOfBounds');
    const session = new Session(def);
    expect(session.rewindable).toBe(true);
    session.dispose();
  });

  it('meets the four rules in order: the bridge, the hall, the shadow, the echo', () => {
    const session = new Session(def);
    session.replay(inputs);
    const order: string[] = [];
    const note = (name: string) => {
      if (!order.includes(name)) order.push(name);
    };
    const first = session.field!.part('first') as Gate;
    const last = session.field!.part('last') as Gate;
    session.on((event) => {
      if (event.type !== 'cue') return;
      if (event.name === 'wrap') note('hall');
      if (event.name === 'mirrorShot') note('shadow');
      if (event.name === 'echoPlateDown') note('echo');
    });
    while (session.playing && session.world.tick < 6000) {
      session.step();
      const p = at(session);
      if (p.z < 16.5 && p.z > 13.5 && p.y > 0) note('bridge');
      if (first.open) note('first gate');
      if (last.open) note('last gate');
    }
    expect(order).toEqual(['bridge', 'hall', 'shadow', 'first gate', 'echo', 'last gate']);
    expect(session.outcome).toMatchObject({ holed: true, stars: 3, challengeMet: true });
    session.dispose();
  });

  it('keeps the shadow still until the ball is in front of the mirror, and still again once it has left', () => {
    const session = new Session(def);
    const start = { ...session.shadow!.position() };
    session.replay(inputs);
    const moved: number[] = [];
    session.on((event) => {
      // The cue comes as the stroke is played, before it is counted.
      if (event.type === 'cue' && event.name === 'mirrorShot') moved.push(session.strokes + 1);
    });
    let stillAtFirst = true;
    while (session.playing && session.world.tick < 6000) {
      session.step();
      const q = session.shadow!.position();
      if (session.strokes <= 2 && Math.hypot(q.x - start.x, q.z - start.z) > 1e-3) stillAtFirst = false;
    }
    expect(stillAtFirst).toBe(true);
    // The strokes played from in front of the mirror, and no others: none of the first two, and neither of
    // the last two, which are played among the echoes.
    expect(moved.length).toBeGreaterThanOrEqual(1);
    expect(Math.min(...moved)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...moved)).toBeLessThanOrEqual(session.strokes - 2);
    session.dispose();
  });

  it('cannot be shortened: with either gate shut the cup is out of reach', () => {
    // Full strokes straight up the course from in front of each gate.
    for (const [from, gate] of [[{ x: 3.6, y: r, z: 1 }, 'first'], [{ x: 3.6, y: r, z: -15 }, 'last']] as const) {
      const session = new Session(def);
      stepTicks(session, 5);
      session.ball.teleport(from);
      session.shoot({ x: 0, y: 0, z: -1 }, 1);
      runUntilSettled(session);
      expect((session.field!.part(gate) as Gate).open).toBe(false);
      expect(session.outcome).toBeNull();
      expect(at(session).z).toBeGreaterThan(gate === 'first' ? -3 : -18);
      session.dispose();
    }
  });

  it('takes a stroke back with the plate, the gates, the shadow and the echoes all as they were (SPEC v8 7.4 #8)', () => {
    for (const strokes of [3, 6]) {
      const before = playTo(def, inputs.slice(0, strokes - 1));
      const field = before.field!.save();
      const mine = { ...at(before) };
      const theirs = { ...before.shadow!.position() };
      before.dispose();

      const session = playTo(def, [...inputs.slice(0, strokes), { type: 'undo', tick: shot(inputs[strokes]).tick }]);
      expect(session.stats.undos).toBe(1);
      expect(session.field!.save()).toStrictEqual(field);
      expect({ ...at(session) }).toStrictEqual(mine);
      expect({ ...session.shadow!.position() }).toStrictEqual(theirs);
      session.dispose();
    }
  });

  it('falls at the first bridge if the first stroke is played while it is gone, which costs the third star', () => {
    const first = shot(inputs[0]);
    const session = playTo(def, [{ ...first, tick: 200 }]);
    expect(session.stats.outOfBounds).toBe(1);
    expect(at(session).z).toBeCloseTo(19.5, 2);
    session.dispose();
  });
});
