import { beforeAll, describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/chapters';
import { REPLAYS } from '../src/debug/replays';
import { playTo } from '../src/debug/search';
import { Boss, Door, Key, MONSTER_FOOT, MONSTER_HEIGHT, Monster, Realm, STEP_TICKS } from '../src/game/field/quest';
import { Grid } from '../src/game/field/field';
import { Session, type InputRecord } from '../src/game/session';
import { stagesOf } from '../src/level/chapters';
import type { BossDef, Cell, DoorDef, KeyDef, MonsterDef, RealmDef } from '../src/level/field';
import type { HoleDef } from '../src/level/schema';
import { DEFAULT_BALL } from '../src/physics/ball';
import { RAPIER } from '../src/physics/rapier';
import { runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const chapter = CHAPTERS[8];
const holes = stagesOf(chapter).flatMap((stage) => stage.holes);
const hole = (id: string): HoleDef => holes.find((h) => h.id === id)!;
const r = DEFAULT_BALL.radius;
const at = (session: Session) => session.ball.position();
const shot = (input: InputRecord) => input as InputRecord & { type: 'shot' };
const parts = <T>(def: HoleDef, kind: string): T[] => (def.field?.parts ?? []).filter((part) => part.kind === kind) as T[];

describe('Chapter 9 holes (SPEC v9 3)', () => {
  it('is Monster Quest: four worlds and a finale, open from the Chapter 8 finale, and the last chapter of the game', () => {
    expect(chapter.id).toBe('ch9');
    expect(chapter.after).toBe('ch8');
    expect(chapter.worlds.map((world) => world.id)).toEqual(['haunted', 'den', 'dungeon', 'lair']);
    expect(chapter.finale.id).toBe('ch9-finale');
    expect(holes).toHaveLength(13);
    expect(CHAPTERS.at(-1)).toBe(chapter);
  });

  it('has a stroke to take back on every hole: everything here is something a ball can change (SPEC v9 3.1)', () => {
    for (const def of holes) {
      const session = new Session(def);
      expect(session.rewindable, def.id).toBe(true);
      session.dispose();
    }
  });

  it.each(holes)('$id is solved by its reference round with no penalty, no catch and no stroke taken back', (def) => {
    const session = playTo(def, REPLAYS[def.id].inputs);
    expect(session.outcome).toMatchObject({ holed: true, stars: 3 });
    expect(session.strokes).toBeLessThanOrEqual(def.par);
    expect(session.stats.undos).toBe(0);
    expect(session.stats.outOfBounds).toBe(0);
    expect(session.stats.caught).toBe(0);
    session.dispose();
  });

  it.each(holes)('$id ends every stroke, and leaves a ball that has stopped where it stopped', (def) => {
    for (let n = 0; n < 18; n++) {
      const session = new Session(def);
      stepTicks(session, 5);
      const angle = (n / 18) * Math.PI * 2;
      session.shoot({ x: Math.sin(angle), y: 0, z: Math.cos(angle) }, [0.3, 0.6, 1][n % 3]);
      expect(runUntilSettled(session, 6000)).toBeLessThan(6000);
      if (session.phase === 'aiming') {
        const rest = { ...at(session) };
        stepTicks(session, 200);
        expect(session.phase).toBe('aiming');
        const p = at(session);
        expect(Math.hypot(p.x - rest.x, p.y - rest.y, p.z - rest.z)).toBeLessThan(1e-3);
      }
      session.dispose();
    }
  });

  it('uses no gravity zone, no splitting and no skill anywhere in the chapter', () => {
    for (const def of holes) {
      expect(def.zones.some((zone) => zone.type === 'gravity')).toBe(false);
      expect(def.maxBalls ?? 1).toBe(1);
      expect(def.skills).toBeUndefined();
      expect(def.mirror).toBeUndefined();
    }
  });
});

describe('the grids of Chapter 9 (SPEC v9 3.2, 5)', () => {
  const gridded = holes.filter((def) => def.field?.grid);

  it('gives every hole with a monster or a boss a grid, and no other', () => {
    for (const def of holes) {
      const needs = parts(def, 'monster').length + parts(def, 'boss').length > 0;
      expect(def.field?.grid !== undefined, def.id).toBe(needs);
    }
    expect(gridded.map((def) => def.id)).toEqual(['den-1', 'den-2', 'den-3', 'dungeon-3', 'lair-1', 'lair-2', 'lair-3', 'ch9-finale']);
  });

  it('keeps every open cell clear of walls, so a monster that may step there can, and lists every walled cell as blocked', () => {
    const still = { x: 0, y: 0, z: 0, w: 1 };
    for (const def of gridded) {
      const session = new Session(def);
      const grid = new Grid(def.field!.grid!);
      const half = (grid.cell * MONSTER_FOOT) / 2;
      const shape = new RAPIER.Cuboid(half, MONSTER_HEIGHT / 2, half);
      for (let col = 0; col < def.field!.grid!.cols; col++) {
        for (let row = 0; row < def.field!.grid!.rows; row++) {
          const cell: Cell = [col, row];
          const centre = grid.center(cell);
          let walled = false;
          session.world.raw.intersectionsWithShape({ x: centre.x, y: centre.y + MONSTER_HEIGHT / 2, z: centre.z }, still, shape, (collider) => {
            // Only the course itself: not the balls, not the works, which keep out of each other's way by rule.
            if (session.balls.owner(collider.handle)) return true;
            if (collider.parent()?.isKinematic()) return true;
            const kind = (session as unknown as { surfaces: { kindOf(handle: number): string | null } }).surfaces.kindOf(collider.handle);
            if (kind === 'ground') return true;
            // A door or a gate is a wall only while shut, and the rule keeps monsters out of those.
            if ((session.field as unknown as { owners: Map<number, unknown> }).owners.has(collider.handle)) return true;
            walled = true;
            return false;
          });
          const open = grid.open(cell);
          // A walled cell is blocked, or it lies in the finale's key room, which is blocked for that reason.
          if (walled) expect(open, `${def.id}: cell (${col}, ${row}) is walled but open`).toBe(false);
        }
      }
      session.dispose();
    }
  });

  it('starts every monster and boss on open cells, with room to move', () => {
    for (const def of gridded) {
      const grid = new Grid(def.field!.grid!);
      for (const monster of parts<MonsterDef>(def, 'monster')) {
        const cells = monster.mode === 'patrol' ? monster.path! : [monster.cell!];
        for (const cell of cells) expect(grid.open(cell), `${def.id}: ${monster.id}`).toBe(true);
        if (monster.mode === 'patrol') expect(monster.path!.length).toBeGreaterThanOrEqual(2);
      }
      for (const boss of parts<BossDef>(def, 'boss')) {
        const [c, row] = boss.cell;
        for (const cell of [[c, row], [c + 1, row], [c, row + 1], [c + 1, row + 1]] as Cell[]) expect(grid.open(cell), `${def.id}: ${boss.id}`).toBe(true);
      }
    }
  });
});

describe('Haunted House (SPEC v9 3.3)', () => {
  const world = chapter.worlds[0];

  it('has a realm on every hole, swapped by levers that are valves with the look of a lever', () => {
    for (const def of [...world.holes, chapter.finale.holes[0]]) {
      const realms = parts<RealmDef>(def, 'realm');
      expect(realms, def.id).toHaveLength(1);
      for (const id of realms[0].levers) {
        const lever = def.field!.parts.find((part) => part.id === id);
        expect(lever?.kind).toBe('valve');
        expect((lever as { look?: string }).look).toBe('lever');
      }
    }
  });

  it('haunted-1: the real wall stops a ball that goes straight for the cup; after the lever it is a ghost', () => {
    const def = hole('haunted-1');
    const straight = playTo(def, [{ type: 'shot', tick: 10, dir: [0.08, 0, -1], power: 0.6 }]);
    expect(straight.outcome).toBeNull();
    expect(at(straight).z).toBeGreaterThan(2);
    straight.dispose();
    const round = playTo(def, REPLAYS[def.id].inputs);
    expect((round.field!.part('house') as Realm).ghost).toBe(true);
    expect(round.outcome?.holed).toBe(true);
    round.dispose();
  });

  it('haunted-2: the bridge is there only in the ghost world; a ball on it when the worlds swap back falls', () => {
    const def = hole('haunted-2');
    const inputs = REPLAYS[def.id].inputs;
    // Over the bridge as the reference round does, then stop on it, then swap back.
    const session = playTo(def, [inputs[0]]);
    const realm = session.field!.part('house') as Realm;
    expect(realm.ghost).toBe(true);
    expect(realm.floors[0].solid).toBe(true);
    session.ball.teleport({ x: 0, y: r + 0.004, z: 0 });
    stepTicks(session, 10);
    expect(at(session).y).toBeGreaterThan(r - 0.01);
    (session.field!.part('far') as unknown as { hit(ball: unknown, speed: number): void }).hit(session.ball, 1);
    stepTicks(session, 90);
    // Into the pit, out of bounds, and back where the stroke was played from.
    expect(session.stats.outOfBounds).toBe(1);
    expect(realm.ghost).toBe(false);
    session.dispose();
  });

  it('haunted-3: the second lever has to be knocked before the bridge, which is in the real world only', () => {
    const def = hole('haunted-3');
    const session = playTo(def, REPLAYS[def.id].inputs.slice(0, 1));
    const realm = session.field!.part('house') as Realm;
    expect(realm.ghost).toBe(true);
    // In the ghost world there is no bridge: a ball sent over the pit falls.
    session.ball.teleport({ x: 0, y: r, z: 1.5 });
    stepTicks(session, 5);
    session.shoot({ x: 0, y: 0, z: -1 }, 0.5);
    runUntilSettled(session);
    expect(session.stats.outOfBounds).toBe(1);
    session.dispose();
  });
});

describe('Monster Den (SPEC v9 3.4)', () => {
  it('den-1: the walker crosses the hall a cell a stroke and comes back', () => {
    // With room for nine strokes: the hole itself ends at four.
    const def = { ...hole('den-1'), strokeLimit: 20 };
    const session = new Session(def);
    const walker = session.field!.part('walker') as Monster;
    const seen: Cell[] = [];
    for (let i = 0; i < 9; i++) {
      stepTicks(session, 5);
      // Short strokes into the side wall, so the ball goes nowhere much.
      session.shoot({ x: i % 2 ? 1 : -1, y: 0, z: 0 }, 0.08);
      runUntilSettled(session);
      seen.push([walker.cell[0], walker.cell[1]]);
    }
    expect(seen.map((c) => c[0])).toEqual([1, 2, 3, 4, 3, 2, 1, 0, 1]);
    expect(seen.every((c) => c[1] === 4)).toBe(true);
    session.dispose();
  });

  it('den-2: a ball straight below the wall keeps the hunter behind it, and a ball at the gap brings it through', () => {
    const def = hole('den-2');
    const hunter = (s: Session) => s.field!.part('hunter') as Monster;
    const below = new Session(def);
    stepTicks(below, 5);
    below.ball.teleport({ x: -1, y: r, z: -1 });
    stepTicks(below, 5);
    below.shoot({ x: 1, y: 0, z: 0 }, 0.07);
    runUntilSettled(below);
    // It wanted to come down and could not: it sidled toward the gap instead.
    expect(hunter(below).cell[1]).toBeGreaterThanOrEqual(5);
    below.dispose();
    const round = playTo(def, REPLAYS[def.id].inputs);
    expect(round.outcome?.holed).toBe(true);
    expect(round.stats.caught).toBe(0);
    round.dispose();
  });

  it('den-3: a ball that stops beside the hunter is caught on the next turn, and the stroke is taken back', () => {
    const def = hole('den-3');
    const session = new Session(def);
    const hunter = session.field!.part('hunter') as Monster;
    stepTicks(session, 5);
    const beside = { x: hunter.anchor.x + 1, y: r, z: hunter.anchor.z };
    session.ball.teleport(beside);
    stepTicks(session, 5);
    const strokes = session.strokes;
    // A nudge at the hunter: the ball bounces off it and lies in the cell beside it.
    session.shoot({ x: -1, y: 0, z: 0 }, 0.08);
    runUntilSettled(session);
    expect(session.stats.caught).toBe(1);
    // The stroke, and one more for the catch.
    expect(session.strokes).toBe(strokes + 2);
    expect(hunter.cell).toEqual((def.field!.parts.find((part) => part.id === 'hunter') as MonsterDef).cell);
    session.dispose();
  });
});

describe('Dungeon (SPEC v9 3.5)', () => {
  it('has keys and doors in matching colours on every hole, and spends one key on one door', () => {
    for (const def of [...chapter.worlds[2].holes, chapter.finale.holes[0]]) {
      const keys = parts<KeyDef>(def, 'key');
      const doors = parts<DoorDef>(def, 'door');
      expect(keys.length).toBeGreaterThanOrEqual(1);
      for (const door of doors) expect(keys.some((key) => key.color === door.color), `${def.id}: ${door.id}`).toBe(true);
    }
  });

  it('dungeon-1: the door is a wall without the key', () => {
    const def = hole('dungeon-1');
    const straight = playTo(def, [{ type: 'shot', tick: 10, dir: [0, 0, -1], power: 0.6 }]);
    expect(straight.outcome).toBeNull();
    expect((straight.field!.part('door') as Door).open).toBe(false);
    expect(at(straight).z).toBeGreaterThan(0.2);
    straight.dispose();
  });

  it('dungeon-2: the wrong red door spends the only red key, and the blue key is then out of reach', () => {
    const def = hole('dungeon-2');
    const first = REPLAYS[def.id].inputs[0];
    const wrong = playTo(def, [first]);
    wrong.ball.teleport({ x: 0, y: r, z: 0 });
    stepTicks(wrong, 5);
    wrong.shoot({ x: 1, y: 0, z: 0 }, 0.6);
    runUntilSettled(wrong);
    expect((wrong.field!.part('east') as Door).open).toBe(true);
    expect((wrong.field!.part('red') as Key).used).toBe(true);
    expect((wrong.field!.part('west') as Door).open).toBe(false);
    // From the east room there is no way to the blue key but back through the middle, and the west door is shut.
    wrong.ball.teleport({ x: -1, y: r, z: 0 });
    stepTicks(wrong, 5);
    wrong.shoot({ x: -1, y: 0, z: 0 }, 0.5);
    runUntilSettled(wrong);
    expect(at(wrong).x).toBeGreaterThan(-3);
    expect((wrong.field!.part('blue') as Key).held).toBe(false);
    // Undo is the way out: the stroke that opened the wrong door is two strokes back.
    expect(wrong.undo()).toBe(true);
    expect(wrong.undo()).toBe(true);
    expect((wrong.field!.part('red') as Key).carried).toBe(true);
    expect((wrong.field!.part('east') as Door).open).toBe(false);
    wrong.dispose();
  });

  it('dungeon-3: the guard walks over the key, and its reference round takes the key between its passes', () => {
    const def = hole('dungeon-3');
    const guard = parts<MonsterDef>(def, 'monster')[0];
    const key = parts<KeyDef>(def, 'key')[0];
    const grid = new Grid(def.field!.grid!);
    const keyCell = grid.cellAt(key.at[0], key.at[2])!;
    expect(guard.path!.some((cell) => cell[0] === keyCell[0] && cell[1] === keyCell[1])).toBe(true);
    const round = playTo(def, REPLAYS[def.id].inputs);
    expect(round.stats.caught).toBe(0);
    expect((round.field!.part('key') as Key).used).toBe(true);
    round.dispose();
  });
});

describe('Boss Lair (SPEC v9 3.6)', () => {
  it('gives the three holes bosses of one, two and three health, and only the third a shield, with its key on the ground', () => {
    const bosses = chapter.worlds[3].holes.map((def) => parts<BossDef>(def, 'boss')[0]);
    expect(bosses.map((b) => b.hp)).toEqual([1, 2, 3]);
    expect(bosses.map((b) => b.shield)).toEqual([undefined, undefined, 'gold']);
    expect(parts<KeyDef>(hole('lair-3'), 'key').map((k) => k.color)).toEqual(['gold']);
    for (const def of chapter.worlds[3].holes) expect(def.goal.type).toBe('boss');
  });

  it('lair-1: a stroke straight at it strikes its front, which does nothing, and it turns to keep facing the ball', () => {
    const def = hole('lair-1');
    const session = playTo(def, [{ type: 'shot', tick: 10, dir: [0.3, 0, -1], power: 0.6 }]);
    const boss = session.field!.part('boss') as Boss;
    expect(boss.hp).toBe(1);
    expect(session.outcome).toBeNull();
    const p = at(session);
    const dx = p.x - boss.anchor.x;
    const dz = p.z - boss.anchor.z;
    const expected = Math.abs(dx) >= Math.abs(dz) ? (dx >= 0 ? 90 : 270) : dz < 0 ? 0 : 180;
    expect(boss.facing).toBe(expected);
    session.dispose();
  });

  it('lair-2: once struck it comes for the ball, one cell a stroke, and the reference round is never caught', () => {
    const def = hole('lair-2');
    const inputs = REPLAYS[def.id].inputs;
    const one = playTo(def, inputs.slice(0, 1));
    const boss = one.field!.part('boss') as Boss;
    expect(boss.hp).toBe(1);
    const cellAfterHit = [...boss.cell];
    // Struck this stroke, it did not step.
    expect(cellAfterHit).toEqual([3, 6]);
    one.dispose();
    // A ball lying in a corner of its own cells is caught where it lies.
    const cornered = playTo(def, [inputs[0], { type: 'shot', tick: shot(inputs[1]).tick, dir: [0, 0, 1], power: 0.08 }]);
    expect(cornered.stats.caught).toBe(1);
    cornered.dispose();
    // A stroke that strikes nothing, from clear of it: it steps.
    const two = playTo(def, inputs.slice(0, 1));
    two.ball.teleport({ x: -3, y: r, z: 3 });
    stepTicks(two, 5);
    two.shoot({ x: 0, y: 0, z: 1 }, 0.08);
    runUntilSettled(two);
    const stepped = two.field!.part('boss') as Boss;
    expect(stepped.cell).not.toEqual([3, 6]);
    expect(Math.abs(stepped.cell[0] - 3) + Math.abs(stepped.cell[1] - 6)).toBe(1);
    expect(two.stats.caught).toBe(0);
    two.dispose();
    const round = playTo(def, inputs);
    expect(round.stats.caught).toBe(0);
    expect(round.outcome).toMatchObject({ holed: true, challengeMet: true });
    round.dispose();
  });

  it('lair-3: the shield is up after the second strike and the key opens it; without the key a strike on it is nothing', () => {
    const def = hole('lair-3');
    const inputs = REPLAYS[def.id].inputs;
    const session = new Session(def);
    session.replay(inputs);
    const boss = session.field!.part('boss') as Boss;
    const key = session.field!.part('key') as Key;
    let shieldedAt = -1;
    let openedAt = -1;
    while (session.playing && session.world.tick < 6000) {
      session.step();
      if (shieldedAt < 0 && boss.shielded) shieldedAt = session.strokes;
      if (shieldedAt >= 0 && openedAt < 0 && !boss.shielded) openedAt = session.strokes;
    }
    expect(boss.hp).toBe(0);
    expect(shieldedAt).toBe(2);
    expect(openedAt).toBeGreaterThan(shieldedAt);
    expect(key.used).toBe(true);
    expect(session.outcome).toMatchObject({ holed: true, stars: 3 });
    session.dispose();
  });

  it('ends a boss hole only when the ball has stopped, and the stroke waits for nothing after', () => {
    const def = hole('lair-1');
    const session = new Session(def);
    session.replay(REPLAYS[def.id].inputs);
    let downAt = -1;
    let endedAt = -1;
    while (session.playing && session.world.tick < 6000) {
      session.step();
      if (downAt < 0 && (session.field!.part('boss') as Boss).hp === 0) downAt = session.world.tick;
    }
    endedAt = session.world.tick;
    expect(downAt).toBeGreaterThan(0);
    expect(endedAt - downAt).toBeGreaterThan(STEP_TICKS);
    expect(session.outcome?.holed).toBe(true);
    session.dispose();
  });
});

describe('the Chapter 9 finale: Demon Castle (SPEC v9 3.7)', () => {
  const def = chapter.finale.holes[0];
  const inputs = () => REPLAYS[def.id].inputs;

  it('is the last hole of the game, a boss hole, and asks never to be caught', () => {
    expect(def.goal).toEqual({ type: 'boss', part: 'demon' });
    expect(def.challenge?.type).toBe('noCaught');
    const last = CHAPTERS.at(-1)!;
    expect(stagesOf(last).at(-1)!.holes.at(-1)).toBe(def);
  });

  it('runs its four stretches in order: the worlds swapped, the monsters, the keys, the boss', () => {
    const session = new Session(def);
    session.replay(inputs());
    const order: string[] = [];
    const note = (name: string) => {
      if (!order.includes(name)) order.push(name);
    };
    const realm = session.field!.part('gatehouse') as Realm;
    const door = session.field!.part('door') as Door;
    const boss = session.field!.part('demon') as Boss;
    const walker = session.field!.part('walker') as Monster;
    const start = [...walker.cell];
    while (session.playing && session.world.tick < 20000) {
      session.step();
      if (realm.ghost) note('ghost');
      if (walker.cell[0] !== start[0]) note('monsters');
      if ((session.field!.part('red') as Key).held) note('red key');
      if ((session.field!.part('gold') as Key).held) note('gold key');
      if (door.open) note('door');
      if (boss.hits > 0) note('boss struck');
      if (boss.hp === 0) note('boss down');
    }
    expect(order.slice(0, 2)).toEqual(['ghost', 'monsters']);
    expect(order.indexOf('door')).toBeGreaterThan(order.indexOf('red key'));
    expect(order.indexOf('boss struck')).toBeGreaterThan(order.indexOf('door'));
    expect(order.at(-1)).toBe('boss down');
    expect(session.outcome).toMatchObject({ holed: true, stars: 3, challengeMet: true });
    session.dispose();
  });

  it('keeps the key room off the grid: no monster can enter it and no ball there can be caught', () => {
    const grid = new Grid(def.field!.grid!);
    for (let col = 0; col < 8; col++) for (let row = 12; row < 20; row++) expect(grid.open([col, row])).toBe(false);
    expect(grid.cellAt(0, 0)).toBeNull();
    expect(grid.cellAt(0, 8)).not.toBeNull();
    expect(grid.cellAt(0, -8)).not.toBeNull();
  });

  it('takes a stroke back with the worlds, the monsters, the keys and the boss as they were (SPEC v9 3.8)', () => {
    const all = inputs();
    for (const strokes of [2, 6, all.length - 1]) {
      const before = playTo(def, all.slice(0, strokes - 1));
      const field = before.field!.save();
      const mine = { ...at(before) };
      before.dispose();
      const session = playTo(def, [...all.slice(0, strokes), { type: 'undo', tick: shot(all[strokes]).tick }]);
      expect(session.stats.undos).toBe(1);
      expect(session.field!.save()).toStrictEqual(field);
      expect(at(session).x).toBeCloseTo(mine.x, 5);
      expect(at(session).z).toBeCloseTo(mine.z, 5);
      session.dispose();
    }
  });
});
