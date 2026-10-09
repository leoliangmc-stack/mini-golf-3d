import { beforeAll, describe, expect, it } from 'vitest';
import { challengeMet, emptyStats } from '../src/game/challenges';
import type { Valve } from '../src/game/field/elements';
import { Boss, chaseStep, Door, Key, Monster, Realm, STEP_TICKS, TURN_TICKS } from '../src/game/field/quest';
import { Session, type SessionEvent } from '../src/game/session';
import type { Cell, PartDef } from '../src/level/field';
import type { HoleDef, PieceDef } from '../src/level/schema';
import { DEFAULT_BALL } from '../src/physics/ball';
import { RULES } from '../src/game/rules';
import { boxHole, runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const r = DEFAULT_BALL.radius;
const speed = (metresPerSecond: number) => metresPerSecond / RULES.maxShotSpeed;
const at = (session: Session) => session.ball.position();
/** Knocks a lever, as a ball running into it does. */
const knock = (session: Session, id: string): void => {
  (session.field!.part(id) as Valve).hit(session.ball, 1);
};
/** A walled room eight metres square, with an eight by eight grid of cells a metre across inside it. */
function room(parts: PartDef[], overrides: Partial<HoleDef> = {}, extraPieces: PieceDef[] = [], half = 4): HoleDef {
  const cells = half * 2;
  return {
    ...boxHole({ tee: [-3.5, 0, 3.5], par: 6 }),
    zones: [{ type: 'outOfBounds', shape: { kind: 'box', center: [0, -7, 0], halfExtents: [60, 5, 60] } }],
    pieces: [
      { type: 'floor', min: [-half, -half], max: [half, half], surface: 'grass' },
      { type: 'wall', from: [-half, -half], to: [half, -half], surface: 'rail' },
      { type: 'wall', from: [half, -half], to: [half, half], surface: 'rail' },
      { type: 'wall', from: [half, half], to: [-half, half], surface: 'rail' },
      { type: 'wall', from: [-half, half], to: [-half, -half], surface: 'rail' },
      ...extraPieces,
    ],
    field: { grid: { origin: [-half + 0.5, -half + 0.5], cols: cells, rows: cells }, parts },
    ...overrides,
  };
}
const cellOf = (session: Session): Cell | null => session.field!.grid!.cellAt(at(session).x, at(session).z);
const events = (session: Session): string[] => {
  const seen: string[] = [];
  session.on((event: SessionEvent) => seen.push(event.type === 'cue' ? event.name : event.type));
  return seen;
};
/** Plays a stroke and waits for it, and for whatever moves after it, to be over. */
function stroke(session: Session, dir: [number, number], metresPerSecond: number): void {
  expect(session.shoot({ x: dir[0], y: 0, z: dir[1] }, speed(metresPerSecond))).toBe(true);
  expect(runUntilSettled(session, 6000)).toBeLessThan(6000);
}

// --- The haunted house (SPEC v9 3.3) --------------------------------------------------

/** A corridor with a wall across it in the real world, a bridge over a pit in the ghost one, and a lever by the tee. */
function hauntedHole(): HoleDef {
  return {
    ...boxHole({ tee: [0, 0, 7], par: 4 }),
    pieces: [
      { type: 'floor', min: [-2, 1], max: [2, 9], surface: 'grass' },
      { type: 'floor', min: [-2, -9], max: [2, -1], surface: 'grass' },
      { type: 'wall', from: [-2, 9], to: [2, 9], surface: 'rail' },
      { type: 'wall', from: [-2, -9], to: [2, -9], surface: 'rail' },
      { type: 'wall', from: [-2, 9], to: [-2, -9], surface: 'rail' },
      { type: 'wall', from: [2, 9], to: [2, -9], surface: 'rail' },
    ],
    field: {
      parts: [
        { kind: 'valve', id: 'lever', at: [1.6, 0, 8], look: 'lever' },
        {
          kind: 'realm',
          id: 'realm',
          levers: ['lever'],
          real: { walls: [{ from: [-2, 4], to: [2, 4] }] },
          ghost: { floors: [{ min: [-1, -1.1], max: [1, 1.1] }], walls: [{ from: [-2, -4], to: [2, -4] }] },
        },
      ],
    },
  };
}

describe('the haunted house (SPEC v9 3.3)', () => {
  it('starts with the real world solid: its wall stops the ball and the ghost bridge is not there', () => {
    const session = new Session(hauntedHole());
    const realm = session.field!.part('realm') as Realm;
    expect(realm.solid).toBe('real');
    expect(realm.walls.map((wall) => [wall.layer, wall.solid])).toEqual([['real', true], ['ghost', false]]);
    expect(realm.floors[0].solid).toBe(false);
    stepTicks(session, 5);
    stroke(session, [0, -1], 7);
    // Stopped against the real wall at z = 4, never over the pit.
    expect(at(session).z).toBeGreaterThan(4);
    expect(session.stats.outOfBounds).toBe(0);
    expect(session.rewindable).toBe(true);
    session.dispose();
  });

  it('swaps the worlds at a knock on the lever, and back at the next: the wall goes, the bridge comes', () => {
    const session = new Session(hauntedHole());
    const realm = session.field!.part('realm') as Realm;
    const seen = events(session);
    stepTicks(session, 5);
    knock(session, 'lever');
    stepTicks(session, 2);
    expect(realm.solid).toBe('ghost');
    expect(realm.on).toBe(true);
    expect(realm.walls.map((wall) => wall.solid)).toEqual([false, true]);
    expect(realm.floors[0].solid).toBe(true);
    expect(seen).toContain('realmGhost');
    // Across the ghost bridge and up to the ghost wall at z = -4.
    stroke(session, [0, -1], 9);
    expect(at(session).z).toBeLessThan(-1);
    expect(at(session).z).toBeGreaterThan(-4);
    expect(session.stats.outOfBounds).toBe(0);
    knock(session, 'lever');
    stepTicks(session, 2);
    expect(realm.solid).toBe('real');
    expect(seen).toContain('realmReal');
    session.dispose();
  });

  it('drops a ball off a bridge that stops being solid, and finds no ground where the ghost floor was', () => {
    const def = hauntedHole();
    const session = new Session(def);
    stepTicks(session, 5);
    knock(session, 'lever');
    stepTicks(session, 2);
    // Stop on the bridge.
    session.ball.teleport({ x: 0, y: r + 0.004, z: 0 });
    stepTicks(session, 30);
    expect(at(session).y).toBeGreaterThan(r - 0.01);
    knock(session, 'lever');
    let fell = false;
    for (let i = 0; i < 60 && !fell; i++) {
      session.step();
      fell = at(session).y < -0.5;
    }
    expect(fell).toBe(true);
    // Into the pit and out of bounds: back to the tee, at the usual price.
    stepTicks(session, 120);
    expect(session.stats.outOfBounds).toBe(1);
    session.dispose();
  });

  it('keeps a wall away while a ball is in its place, and brings it back once the ball has gone', () => {
    const session = new Session(hauntedHole());
    const realm = session.field!.part('realm') as Realm;
    stepTicks(session, 5);
    knock(session, 'lever');
    stepTicks(session, 2);
    // A ball lying right where the real wall stands.
    session.ball.teleport({ x: 0, y: r, z: 4 });
    stepTicks(session, 30);
    knock(session, 'lever');
    stepTicks(session, 5);
    expect(realm.solid).toBe('real');
    expect(realm.walls[0].solid).toBe(false);
    expect(realm.walls[1].solid).toBe(false);
    session.ball.teleport({ x: 0, y: r, z: 6 });
    stepTicks(session, 2);
    expect(realm.walls[0].solid).toBe(true);
    session.dispose();
  });

  it('takes a stroke back with the worlds as they were', () => {
    const session = new Session(hauntedHole());
    const realm = session.field!.part('realm') as Realm;
    stepTicks(session, 5);
    // A stroke at the lever: the ball knocks it and the worlds swap.
    session.ball.teleport({ x: 1.6, y: r, z: 6.5 });
    stroke(session, [0, 1], 4);
    expect(realm.solid).toBe('ghost');
    expect(session.undo()).toBe(true);
    expect(realm.solid).toBe('real');
    expect(realm.walls.map((wall) => wall.solid)).toEqual([true, false]);
    expect(realm.floors[0].solid).toBe(false);
    session.dispose();
  });

  it('counts the ghost world solid while an odd number of its levers are on', () => {
    const def = hauntedHole();
    const parts = def.field!.parts;
    const two: HoleDef = {
      ...def,
      field: {
        parts: [
          parts[0],
          { kind: 'valve', id: 'other', at: [-1.6, 0, 8], look: 'lever' },
          { ...(parts[1] as Extract<PartDef, { kind: 'realm' }>), levers: ['lever', 'other'] },
        ],
      },
    };
    const session = new Session(two);
    const realm = session.field!.part('realm') as Realm;
    stepTicks(session, 2);
    knock(session, 'lever');
    stepTicks(session, 2);
    expect(realm.solid).toBe('ghost');
    knock(session, 'other');
    stepTicks(session, 2);
    expect(realm.solid).toBe('real');
    session.dispose();
  });
});

// --- Monsters (SPEC v9 3.4) --------------------------------------------------------------

describe('monsters (SPEC v9 3.4)', () => {
  it('chases along the axis it is further off on, across if equal, the other axis if blocked, and nowhere if both are', () => {
    const open = () => true;
    expect(chaseStep(3, 1, open)).toEqual([1, 0]);
    expect(chaseStep(-3, 1, open)).toEqual([-1, 0]);
    expect(chaseStep(1, -3, open)).toEqual([0, -1]);
    expect(chaseStep(2, 2, open)).toEqual([1, 0]);
    expect(chaseStep(-2, -2, open)).toEqual([-1, 0]);
    expect(chaseStep(0, 2, open)).toEqual([0, 1]);
    expect(chaseStep(0, 0, open)).toBeNull();
    const noX = (step: Cell) => step[0] === 0;
    expect(chaseStep(3, 1, noX)).toEqual([0, 1]);
    expect(chaseStep(3, 0, noX)).toBeNull();
    expect(chaseStep(3, 1, () => false)).toBeNull();
  });

  it('stands still while the ball rolls, then takes one step when it has stopped, and the stroke waits for it', () => {
    const def = room([{ kind: 'monster', id: 'guard', mode: 'patrol', path: [[1, 0], [2, 0], [3, 0], [4, 0]] }]);
    const session = new Session(def);
    const guard = session.field!.part('guard') as Monster;
    stepTicks(session, 5);
    expect(guard.cell).toEqual([1, 0]);
    expect(session.shoot({ x: 1, y: 0, z: 0 }, speed(3))).toBe(true);
    let movedWhileRolling = false;
    let stoppedAt = -1;
    while (session.phase === 'rolling') {
      session.step();
      if (stoppedAt < 0 && session.ball.speed() < 0.01) stoppedAt = session.world.tick;
      if (stoppedAt < 0 && guard.busy) movedWhileRolling = true;
    }
    expect(movedWhileRolling).toBe(false);
    expect(guard.cell).toEqual([2, 0]);
    expect(guard.busy).toBe(false);
    // The stroke ended only once the monster had arrived.
    expect(session.world.tick - stoppedAt).toBeGreaterThanOrEqual(STEP_TICKS);
    session.dispose();
  });

  it('patrols its path and back again', () => {
    const def = room([{ kind: 'monster', id: 'guard', mode: 'patrol', path: [[1, 0], [2, 0], [3, 0]] }]);
    const session = new Session(def);
    const guard = session.field!.part('guard') as Monster;
    const seen: Cell[] = [];
    for (let i = 0; i < 6; i++) {
      stepTicks(session, 5);
      stroke(session, [i % 2 ? -1 : 1, 0], 1.5);
      seen.push([...guard.cell] as unknown as Cell);
    }
    expect(seen).toEqual([[2, 0], [3, 0], [2, 0], [1, 0], [2, 0], [3, 0]]);
    session.dispose();
  });

  it('chases the ball, and shows where it would go if the ball stopped now', () => {
    const def = room([{ kind: 'monster', id: 'hunter', mode: 'chase', cell: [7, 7] }]);
    const session = new Session(def);
    const hunter = session.field!.part('hunter') as Monster;
    stepTicks(session, 5);
    // The ball is on cell (0, 7): further off across than along.
    expect(cellOf(session)).toEqual([0, 7]);
    expect(hunter.preview()).toEqual([6, 7]);
    stroke(session, [1, 0], 2);
    expect(hunter.cell).toEqual([6, 7]);
    session.dispose();
  });

  it('catches a ball by stepping onto its cell: the stroke is taken back and costs one, counted apart from going out', () => {
    const def = room([{ kind: 'monster', id: 'hunter', mode: 'chase', cell: [4, 7] }]);
    const session = new Session(def);
    const hunter = session.field!.part('hunter') as Monster;
    const seen = events(session);
    stepTicks(session, 5);
    session.ball.teleport({ x: -1.5, y: r, z: 3.5 });
    stepTicks(session, 5);
    const from = { ...at(session) };
    // A short roll to the cell beside the monster.
    stroke(session, [1, 0], 1.2);
    expect(hunter.cell).toEqual([4, 7]);
    expect(seen).toContain('caught');
    expect(session.stats.caught).toBe(1);
    expect(session.stats.outOfBounds).toBe(0);
    expect(session.strokes).toBe(2);
    expect(session.phase).toBe('aiming');
    // The ball and the monster are as they were before the stroke.
    expect(at(session).x).toBeCloseTo(from.x, 5);
    expect(at(session).z).toBeCloseTo(from.z, 5);
    expect(hunter.cell).toEqual([4, 7]);
    expect(challengeMet({ type: 'noCaught', text: { en: '', zh: '' } }, session.stats)).toBe(false);
    expect(challengeMet({ type: 'noOutOfBounds', text: { en: '', zh: '' } }, session.stats)).toBe(true);
    session.dispose();
  });

  it('is a wall to a rolling ball', () => {
    const def = room([{ kind: 'monster', id: 'guard', mode: 'patrol', path: [[3, 7], [3, 6]] }]);
    const session = new Session(def);
    stepTicks(session, 5);
    session.shoot({ x: 1, y: 0, z: 0 }, speed(8));
    let bounced = false;
    session.on((event) => {
      if (event.type === 'bounce' && event.kind === 'prop') bounced = true;
    });
    runUntilSettled(session);
    expect(bounced).toBe(true);
    expect(at(session).x).toBeLessThan(-0.5);
    session.dispose();
  });

  it('never steps onto a cup, another monster, or a cell that is walled', () => {
    const def = room(
      [
        { kind: 'monster', id: 'first', mode: 'chase', cell: [2, 7] },
        { kind: 'monster', id: 'second', mode: 'chase', cell: [3, 7] },
        { kind: 'monster', id: 'third', mode: 'chase', cell: [6, 1] },
      ],
      { goal: { type: 'cup', position: [0.5, 0, 3.5], radius: 0.22, captureSpeed: 3.5 } },
    );
    // The cup is on cell (4, 7), which the second monster would otherwise step onto; cell (6, 2) is walled.
    const walled: HoleDef = { ...def, field: { ...def.field!, grid: { ...def.field!.grid!, blocked: [[6, 2]] } } };
    const session = new Session(walled);
    const first = session.field!.part('first') as Monster;
    const second = session.field!.part('second') as Monster;
    const third = session.field!.part('third') as Monster;
    stepTicks(session, 5);
    // The ball comes to rest on (6, 7), in the top row with the monsters.
    session.ball.teleport({ x: 3.5, y: r, z: 3.5 });
    stepTicks(session, 5);
    stroke(session, [-1, 0], 1.2);
    expect(cellOf(session)).toEqual([6, 7]);
    // Second would step to (4, 7), the cup: blocked across, and it is not off along at all: it stays.
    expect(second.cell).toEqual([3, 7]);
    // First is blocked across by second and has no way along either: it stays too.
    expect(first.cell).toEqual([2, 7]);
    // Third would go straight up its column to the ball, but the cell above it is walled: it stays.
    expect(third.cell).toEqual([6, 1]);
    session.dispose();
  });

  it('takes a stroke back with the monsters where they were', () => {
    const def = room([{ kind: 'monster', id: 'guard', mode: 'patrol', path: [[1, 0], [2, 0], [3, 0]] }]);
    const session = new Session(def);
    const guard = session.field!.part('guard') as Monster;
    stepTicks(session, 5);
    stroke(session, [1, 0], 2);
    stroke(session, [1, 0], 2);
    expect(guard.cell).toEqual([3, 0]);
    expect(session.undo()).toBe(true);
    expect(guard.cell).toEqual([2, 0]);
    // And it walks on from there, back the way it came.
    stroke(session, [1, 0], 2);
    expect(guard.cell).toEqual([3, 0]);
    stroke(session, [1, 0], 2);
    expect(guard.cell).toEqual([2, 0]);
    session.dispose();
  });
});

// --- Keys and doors (SPEC v9 3.5) ------------------------------------------------------------

function dungeonHole(): HoleDef {
  return room(
    [
      { kind: 'key', id: 'red', at: [-1.5, 0, 3.5], color: 'red' },
      { kind: 'key', id: 'blue', at: [-1.5, 0, 1.5], color: 'blue' },
      { kind: 'door', id: 'door', from: [0, 3], to: [0, 4], color: 'red' },
      { kind: 'door', id: 'other', from: [0, 1], to: [0, 2], color: 'red' },
    ],
    {},
    [{ type: 'wall', from: [0, -4], to: [0, 1], surface: 'rail' }, { type: 'wall', from: [0, 2], to: [0, 3], surface: 'rail' }],
  );
}

describe('keys and doors (SPEC v9 3.5)', () => {
  it('is taken by a ball rolling over it, and opens a door of its colour as the ball arrives, once', () => {
    const session = new Session(dungeonHole());
    const red = session.field!.part('red') as Key;
    const door = session.field!.part('door') as Door;
    const other = session.field!.part('other') as Door;
    const seen = events(session);
    stepTicks(session, 5);
    stroke(session, [1, 0], 7);
    expect(seen).toContain('keyTake');
    expect(seen).toContain('doorOpen');
    expect(red.held).toBe(true);
    expect(red.used).toBe(true);
    expect(red.carried).toBe(false);
    expect(door.open).toBe(true);
    expect(other.open).toBe(false);
    // Through the door without a bounce off it: it was open to the ball.
    expect(at(session).x).toBeGreaterThan(0.5);
    expect(session.stats.wallHits).toBeLessThanOrEqual(1);
    session.dispose();
  });

  it('is a wall to a ball without the key, or with one of another colour', () => {
    const session = new Session(dungeonHole());
    const blue = session.field!.part('blue') as Key;
    const door = session.field!.part('door') as Door;
    stepTicks(session, 5);
    // Straight at the blue key, then at the red door with it.
    session.ball.teleport({ x: -3.5, y: r, z: 1.5 });
    stroke(session, [1, 0], 4);
    expect(blue.carried).toBe(true);
    // Past the red key, straight at the red door.
    session.ball.teleport({ x: -0.9, y: r, z: 3.5 });
    stroke(session, [1, 0], 3);
    expect(door.open).toBe(false);
    expect(at(session).x).toBeLessThan(0);
    expect(blue.carried).toBe(true);
    session.dispose();
  });

  it('puts the key back on the ground and shuts the door again when the stroke is taken back', () => {
    const session = new Session(dungeonHole());
    const red = session.field!.part('red') as Key;
    const door = session.field!.part('door') as Door;
    stepTicks(session, 5);
    stroke(session, [1, 0], 7);
    expect(door.open).toBe(true);
    expect(session.undo()).toBe(true);
    expect(red.held).toBe(false);
    expect(red.used).toBe(false);
    expect(door.open).toBe(false);
    // And it is a wall again.
    stroke(session, [1, 0], 2);
    stroke(session, [1, 0], 7);
    expect(door.open).toBe(true);
    session.dispose();
  });

  it('keeps a monster out of a doorway that is shut', () => {
    const def = dungeonHole();
    const withGuard: HoleDef = { ...def, field: { ...def.field!, parts: [...def.field!.parts, { kind: 'monster', id: 'guard', mode: 'patrol', path: [[4, 7], [3, 7], [2, 7]] }] } };
    const session = new Session(withGuard);
    const guard = session.field!.part('guard') as Monster;
    stepTicks(session, 5);
    session.ball.teleport({ x: -3.5, y: r, z: -3.5 });
    stroke(session, [0, 1], 1.5);
    // Cell (3, 7) is under the shut red door: it waits.
    expect(guard.cell).toEqual([4, 7]);
    session.dispose();
  });
});

// --- The boss (SPEC v9 3.6) -------------------------------------------------------------

function bossHole(hp: number, extra: Partial<Extract<PartDef, { kind: 'boss' }>> = {}, parts: PartDef[] = []): HoleDef {
  return room([{ kind: 'boss', id: 'boss', cell: [3, 3], hp, ...extra }, ...parts], {
    goal: { type: 'boss', part: 'boss' },
    tee: [0, 0, 3.5],
    par: 8,
  });
}
const bossOf = (session: Session) => session.field!.part('boss') as Boss;
/** The boss at cell (3, 3) in the room stands on (0, 0); facing 180 its weak spot is at z = -1.02. */
const BACK = { x: 0, z: -1.02 };

describe('the boss (SPEC v9 3.6)', () => {
  it('stands on four cells facing the tee, with its weak spot behind, and the hole ends only when it is beaten', () => {
    const session = new Session(bossHole(1));
    const boss = bossOf(session);
    expect(boss.cells).toEqual([[3, 3], [4, 3], [3, 4], [4, 4]]);
    expect(boss.facing).toBe(180);
    expect(boss.weakSpot.x).toBeCloseTo(BACK.x, 5);
    expect(boss.weakSpot.z).toBeCloseTo(BACK.z, 5);
    expect(session.goal.restFirst).toBe(true);
    expect(session.goal.met).toBe(false);
    expect(session.rewindable).toBe(true);
    session.dispose();
  });

  it('is not hurt from the front, and turns to face the ball when it stops', () => {
    const session = new Session(bossHole(1));
    const boss = bossOf(session);
    const seen = events(session);
    stepTicks(session, 5);
    stroke(session, [0, -1], 6);
    expect(boss.hp).toBe(1);
    expect(seen).not.toContain('bossHit');
    // The ball bounced back down the room and lies in front of it still.
    expect(boss.facing).toBe(180);
    // Now from the side.
    session.ball.teleport({ x: 3.5, y: r, z: 0.2 });
    stroke(session, [0, -1], 1.5);
    expect(boss.facing).toBe(90);
    expect(seen).toContain('bossTurn');
    session.ball.teleport({ x: -3.5, y: r, z: 0.2 });
    stroke(session, [0, -1], 1.5);
    expect(boss.facing).toBe(270);
    session.ball.teleport({ x: 0.2, y: r, z: -3.5 });
    stroke(session, [0, 1], 1.5);
    expect(boss.facing).toBe(0);
    session.dispose();
  });

  it('loses one health to a hard enough strike on the weak spot, once a stroke, and the hole ends once the ball has stopped', () => {
    const session = new Session(bossHole(2));
    const boss = bossOf(session);
    const seen = events(session);
    stepTicks(session, 5);
    // Too gentle: nothing, though it turns round to face the ball, so its weak spot is now at +Z.
    session.ball.teleport({ x: BACK.x, y: r, z: -2.5 });
    stroke(session, [0, 1], 1.2);
    expect(boss.hp).toBe(2);
    expect(boss.facing).toBe(0);
    expect(boss.weakSpot.z).toBeCloseTo(-BACK.z, 5);
    // Hard, from behind again: one off, and it has turned round once more.
    session.ball.teleport({ x: 0, y: r, z: 3 });
    session.shoot({ x: 0, y: 0, z: -1 }, speed(6));
    let hits = 0;
    session.on((event) => {
      if (event.type === 'cue' && event.name === 'bossHit') hits++;
    });
    runUntilSettled(session, 6000);
    expect(boss.hp).toBe(1);
    expect(hits).toBe(1);
    expect(boss.phase).toBe(2);
    expect(boss.facing).toBe(180);
    expect(session.outcome).toBeNull();
    // The weak spot is at z = -1.02 again. Strike it again, and the hole is won at rest.
    session.ball.teleport({ x: 0, y: r, z: -3.4 });
    session.shoot({ x: 0, y: 0, z: 1 }, speed(6));
    let wonWhileRolling = false;
    while (session.phase === 'rolling') {
      session.step();
      if (session.goal.met && session.ball.speed() > 0.5 && session.outcome) wonWhileRolling = true;
    }
    expect(wonWhileRolling).toBe(false);
    expect(seen).toContain('bossDown');
    expect(boss.hp).toBe(0);
    expect(session.outcome).toMatchObject({ holed: true, strokes: 3 });
    session.dispose();
  });

  it('steps toward the ball before turning from its second phase on, catches a ball on its way, and only turns in the turn it was struck', () => {
    const session = new Session(bossHole(3));
    const boss = bossOf(session);
    const seen = events(session);
    stepTicks(session, 5);
    // First strike, from behind: it does not step this turn, for all that it is in phase 2 now.
    session.ball.teleport({ x: BACK.x, y: r, z: -3 });
    stroke(session, [0, 1], 6);
    expect(boss.phase).toBe(2);
    expect(boss.cell).toEqual([3, 3]);
    expect(seen).not.toContain('bossStep');
    // A stroke that strikes nothing: now it steps, toward the ball, then turns.
    session.ball.teleport({ x: 3.4, y: r, z: -3.4 });
    stroke(session, [-1, 0], 1.5);
    expect(seen).toContain('bossStep');
    expect(boss.cell).toEqual([3, 2]);
    expect(boss.facing).toBe(90);
    expect(session.stats.caught).toBe(0);
    // A ball that stops on the cell it steps onto is caught, and everything goes back.
    const before = session.field!.save();
    session.ball.teleport({ x: -1.5, y: r, z: -2 });
    const from = { ...at(session) };
    stroke(session, [1, 0], 1.5);
    expect(seen).toContain('caught');
    expect(session.stats.caught).toBe(1);
    expect(session.field!.save()).toStrictEqual(before);
    expect(at(session).x).toBeCloseTo(from.x, 5);
    expect(at(session).z).toBeCloseTo(from.z, 5);
    session.dispose();
  });

  it('raises a shield over its weak spot in its third phase, which a ball with the key opens', () => {
    // A bigger room, so that a ball that has bounced off the shield lies out of its reach.
    const session = new Session(
      room([{ kind: 'boss', id: 'boss', cell: [5, 5], hp: 3, shield: 'gold' }, { kind: 'key', id: 'key', at: [3, 0, 3], color: 'gold' }], { goal: { type: 'boss', part: 'boss' }, tee: [0, 0, 5.5], par: 8 }, [], 6),
    );
    const boss = bossOf(session);
    const seen = events(session);
    stepTicks(session, 5);
    // Two strikes from behind; after the second the shield is up.
    session.ball.teleport({ x: BACK.x, y: r, z: -3 });
    stroke(session, [0, 1], 6);
    expect(boss.phase).toBe(2);
    // It is facing 0 now, so the weak spot is at z = +1.02; it will step toward the ball before it turns, so strike it where it is.
    session.ball.teleport({ x: 0, y: r, z: 3.4 });
    stroke(session, [0, -1], 6);
    expect(boss.phase).toBe(3);
    expect(boss.shielded).toBe(true);
    expect(boss.hp).toBe(1);
    // Without the key, a strike on the shield does nothing.
    const facing = boss.facing;
    const spot = boss.weakSpot;
    const back = facing === 0 ? 1 : facing === 180 ? -1 : 0;
    session.ball.teleport({ x: spot.x, y: r, z: spot.z + back * 1.6 });
    stroke(session, [0, -back], 6);
    expect(boss.hp).toBe(1);
    expect(boss.shielded).toBe(true);
    expect(seen).toContain('shieldHit');
    expect(seen).not.toContain('shieldOpen');
    // Take the key, then strike the shield: it opens and the key is spent. The weak spot is bare for the next stroke.
    session.ball.teleport({ x: 3, y: r, z: 3.4 });
    stroke(session, [0, -1], 1.5);
    expect((session.field!.part('key') as Key).carried).toBe(true);
    const spot2 = boss.weakSpot;
    const back2 = boss.facing === 0 ? 1 : boss.facing === 180 ? -1 : 0;
    const side2 = boss.facing === 90 ? -1 : boss.facing === 270 ? 1 : 0;
    session.ball.teleport({ x: spot2.x + side2 * 1.6, y: r, z: spot2.z + back2 * 1.6 });
    stroke(session, [-side2, -back2], 6);
    expect(seen).toContain('shieldOpen');
    expect(boss.shielded).toBe(false);
    expect((session.field!.part('key') as Key).used).toBe(true);
    expect(boss.hp).toBe(1);
    session.dispose();
  });

  it('turns through its quarter in a fixed number of ticks and is the same every time', () => {
    const play = () => {
      const session = new Session(bossHole(2));
      stepTicks(session, 5);
      session.ball.teleport({ x: 3.5, y: r, z: 0.2 });
      session.shoot({ x: 0, y: 0, z: -1 }, speed(1.5));
      let turned = 0;
      while (session.phase === 'rolling') {
        session.step();
        if (bossOf(session).busy) turned++;
      }
      const p = at(session);
      const result = [p.x, p.y, p.z, turned, bossOf(session).yaw, session.world.tick];
      session.dispose();
      return result;
    };
    const a = play();
    expect(a[3]).toBe(TURN_TICKS);
    expect(a).toStrictEqual(play());
  });

  it('takes a stroke back with its health, its place and its facing as they were', () => {
    const session = new Session(bossHole(3));
    const boss = bossOf(session);
    stepTicks(session, 5);
    session.ball.teleport({ x: BACK.x, y: r, z: -3 });
    stroke(session, [0, 1], 6);
    expect(boss.hp).toBe(2);
    expect(boss.facing).toBe(0);
    expect(session.undo()).toBe(true);
    expect(boss.hp).toBe(3);
    expect(boss.facing).toBe(180);
    expect(boss.cell).toEqual([3, 3]);
    expect(boss.weakSpot.z).toBeCloseTo(BACK.z, 5);
    session.dispose();
  });

  it('counts the round met by the challenge only if no monster ever caught the ball', () => {
    const stats = emptyStats();
    expect(challengeMet({ type: 'noCaught', text: { en: '', zh: '' } }, stats)).toBe(true);
    stats.caught = 1;
    expect(challengeMet({ type: 'noCaught', text: { en: '', zh: '' } }, stats)).toBe(false);
  });
});
