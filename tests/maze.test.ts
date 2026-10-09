import { beforeAll, describe, expect, it } from 'vitest';
import { challengeMet, emptyStats } from '../src/game/challenges';
import type { Rotor } from '../src/game/field/maze';
import { ROTOR_TICKS } from '../src/game/field/maze';
import { playReplay } from '../src/game/replay';
import { Session, type InputRecord } from '../src/game/session';
import { walledRoom } from '../src/data/worlds/common';
import { classifyPress, TAP } from '../src/input/slingshot';
import type { PartDef } from '../src/level/field';
import type { HoleDef } from '../src/level/schema';
import { boxHole, runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

/** A walled room ten metres square, the tee in the middle, with wall groups in it and so many turns to spend. */
const maze = (parts: PartDef[], turns: number, overrides: Partial<HoleDef> = {}): HoleDef =>
  boxHole({ pieces: walledRoom([-5, -5], [5, 5], 'grass', 'rail'), field: { turns, parts }, ...overrides });

/** A bar across the lane north of the tee: it stands east-west, and a quarter turn stands it north-south. */
const BAR: PartDef = { kind: 'rotor', id: 'bar', at: [0, 0, -1.5], arms: [90, 270], length: 1.2 };

const rotor = (session: Session, id = 'bar'): Rotor => session.field!.part(id) as Rotor;

/** Plays a stroke north and says how far the ball got. */
function strokeNorth(session: Session, power = 0.25): number {
  expect(session.shoot({ x: 0, y: 0, z: -1 }, power)).toBe(true);
  runUntilSettled(session);
  return session.ball.position().z;
}

describe('telling a tap from a drag (SPEC v7 3.5, 7.4 #6)', () => {
  it('calls a quick press on the spot a tap', () => {
    expect(classifyPress(0, 80)).toBe('tap');
    expect(classifyPress(TAP.slopPx, TAP.maxMs)).toBe('tap');
  });

  it('never calls a press that moved a tap, however quick it was and wherever it ended', () => {
    expect(classifyPress(TAP.slopPx + 0.5, 20)).toBe('drag');
    expect(classifyPress(240, 900)).toBe('drag');
  });

  it('calls a press held on the spot neither: no stroke, and no tap', () => {
    expect(classifyPress(0, TAP.maxMs + 1)).toBe('hold');
    expect(classifyPress(4, 2000)).toBe('hold');
  });

  it('is one rule for every screen: it asks only how far and how long', () => {
    // No pointer type, no screen size: a mouse, a finger and a pen are read alike.
    expect(classifyPress.length).toBe(2);
    for (let far = 0; far <= 30; far++) {
      for (const held of [0, 100, 349, 351, 1000]) {
        const press = classifyPress(far, held);
        expect(press === 'drag').toBe(far > TAP.slopPx);
        expect(press === 'tap').toBe(far <= TAP.slopPx && held <= TAP.maxMs);
      }
    }
  });
});

describe('wall groups (SPEC v7 3.5)', () => {
  it('is a wall to the ball, and out of the way once it is turned', () => {
    const session = new Session(maze([BAR], 2));
    stepTicks(session, 5);
    // The bar is across the lane: the ball comes back off it.
    expect(strokeNorth(session)).toBeGreaterThan(-1.3);
    session.reset();
    stepTicks(session, 5);
    expect(session.rotate('bar')).toBe(true);
    stepTicks(session, ROTOR_TICKS + 1);
    // Standing north-south it is edge on: a ball a little to one side of it rolls past.
    session.ball.teleport({ x: 0.6, y: 0.1, z: 0 });
    expect(strokeNorth(session)).toBeLessThan(-2.2);
    session.dispose();
  });

  it('turns a quarter clockwise at a time and comes round again after four', () => {
    const session = new Session(maze([{ ...BAR, arms: [0, 90] }], 9));
    stepTicks(session, 2);
    const seen: number[][] = [rotor(session).headings];
    for (let i = 0; i < 4; i++) {
      expect(session.rotate('bar')).toBe(true);
      stepTicks(session, ROTOR_TICKS + 1);
      seen.push(rotor(session).headings);
    }
    expect(seen).toEqual([[0, 90], [90, 180], [180, 270], [270, 0], [0, 90]]);
    expect(rotor(session).on).toBe(false);
    session.dispose();
  });

  it('costs a turn and no stroke, and stops when the turns are used up', () => {
    const session = new Session(maze([BAR], 2));
    stepTicks(session, 2);
    expect(session.field!.turnsLeft).toBe(2);
    expect(session.rotate('bar')).toBe(true);
    stepTicks(session, ROTOR_TICKS + 1);
    expect(session.rotate('bar')).toBe(true);
    stepTicks(session, ROTOR_TICKS + 1);
    expect(session.strokes).toBe(0);
    expect(session.field!.turnsLeft).toBe(0);
    expect(session.turnCheck('bar')).toBe('spent');
    expect(session.rotate('bar')).toBe(false);
    expect(rotor(session).quarter).toBe(2);
    session.dispose();
  });

  it('cannot be turned while the ball lies where its arms would sweep', () => {
    const session = new Session(maze([BAR], 3));
    stepTicks(session, 2);
    // Just inside the reach of an arm, on the side it is not standing on.
    session.ball.teleport({ x: 0, y: 0.1, z: -0.5 });
    stepTicks(session, 2);
    expect(session.turnCheck('bar')).toBe('blocked');
    expect(session.rotate('bar')).toBe(false);
    expect(session.field!.turnsLeft).toBe(3);
    // A step back and it is clear.
    session.ball.teleport({ x: 0, y: 0.1, z: 0 });
    stepTicks(session, 2);
    expect(session.turnCheck('bar')).toBe('ok');
    session.dispose();
  });

  it('is turned only between strokes, never under a rolling ball', () => {
    const session = new Session(maze([BAR], 3));
    stepTicks(session, 2);
    session.shoot({ x: 1, y: 0, z: 0 }, 0.3);
    stepTicks(session, 3);
    expect(session.phase).toBe('rolling');
    expect(session.turnCheck('bar')).toBe('none');
    expect(session.rotate('bar')).toBe(false);
    runUntilSettled(session);
    expect(session.rotate('bar')).toBe(true);
    session.dispose();
  });

  it('lets no stroke be played, and no second turn made, until it has stopped swinging', () => {
    const session = new Session(maze([BAR, { ...BAR, id: 'other', at: [3, 0, 3] }], 3));
    stepTicks(session, 2);
    expect(session.rotate('bar')).toBe(true);
    expect(session.shoot({ x: 0, y: 0, z: 1 }, 0.3)).toBe(false);
    expect(session.turnCheck('other')).toBe('turning');
    stepTicks(session, ROTOR_TICKS - 1);
    expect(session.shoot({ x: 0, y: 0, z: 1 }, 0.3)).toBe(false);
    stepTicks(session, 1);
    expect(session.shoot({ x: 0, y: 0, z: 1 }, 0.3)).toBe(true);
    session.dispose();
  });

  it('gives a hole undo, since the player can change it', () => {
    const session = new Session(maze([BAR], 1));
    expect(session.rewindable).toBe(true);
    session.dispose();
  });

  it('is not a thing a ball can turn', () => {
    const session = new Session(maze([BAR], 1));
    stepTicks(session, 5);
    strokeNorth(session, 0.6);
    expect(rotor(session).quarter).toBe(0);
    expect(session.field!.turnsLeft).toBe(1);
    session.dispose();
  });
});

describe('a turn as an input of the round (SPEC v7 7.4 #7)', () => {
  // One arm across the lane to the cup. A quarter turn swings it clear.
  const ARM: PartDef = { kind: 'rotor', id: 'bar', at: [1.2, 0, -1.5], arms: [270], length: 1.6 };
  const hole = maze([ARM], 2, { goal: { type: 'cup', position: [0, 0, -4], radius: 0.22, captureSpeed: 3.5 } });

  it('is recorded with its tick and its wall group', () => {
    const session = new Session(hole);
    stepTicks(session, 7);
    session.rotate('bar');
    expect(session.inputs).toEqual([{ type: 'rotate', tick: 7, part: 'bar' }]);
    session.dispose();
  });

  it('plays back to the same end, to the last bit', () => {
    const session = new Session(hole);
    stepTicks(session, 7);
    session.rotate('bar');
    stepTicks(session, 30);
    session.shoot({ x: 0.3, y: 0, z: -1 }, 0.3);
    runUntilSettled(session);
    const inputs = [...session.inputs];
    const end = { ...session.ball.position() };
    const tick = session.world.tick;
    const quarter = rotor(session).quarter;
    session.dispose();

    const again = new Session(hole);
    again.replay(inputs);
    while (again.replaying || again.phase === 'rolling') again.step();
    expect(again.world.tick).toBe(tick);
    expect(again.ball.position()).toEqual(end);
    expect(rotor(again).quarter).toBe(quarter);
    expect(again.field!.turnsLeft).toBe(1);
    again.dispose();
  });

  it('matters: the same stroke without the turn ends somewhere else', () => {
    const inputs: InputRecord[] = [
      { type: 'rotate', tick: 5, part: 'bar' },
      { type: 'shot', tick: 40, dir: [0, 0, -1], power: 0.3 },
    ];
    const withTurn = playReplay(hole, inputs);
    const without = playReplay(hole, inputs.slice(1));
    expect(withTurn?.holed).toBe(true);
    expect(without).toBeNull();
  });
});

describe('wall groups in the snapshot (SPEC v7 3.7, 7.4 #8)', () => {
  it('puts a turn made after a stroke back with that stroke, and gives the turn back', () => {
    const session = new Session(maze([BAR], 3));
    stepTicks(session, 2);
    // A turn before the stroke is part of how the course stood when it was played.
    session.rotate('bar');
    stepTicks(session, ROTOR_TICKS + 1);
    session.shoot({ x: 1, y: 0, z: 0.4 }, 0.3);
    runUntilSettled(session);
    session.rotate('bar');
    stepTicks(session, ROTOR_TICKS + 1);
    expect(rotor(session).quarter).toBe(2);
    expect(session.field!.turnsLeft).toBe(1);

    expect(session.undo()).toBe(true);
    expect(rotor(session).quarter).toBe(1);
    expect(session.field!.turnsLeft).toBe(2);
    expect(session.strokes).toBe(2);
    session.dispose();
  });

  it('puts the walls back as they were when a ball goes out of bounds', () => {
    const open = maze([BAR], 3);
    const east = (piece: HoleDef['pieces'][number]) => piece.type === 'wall' && piece.from[0] === 5 && piece.to[0] === 5;
    const hole = { ...open, pieces: open.pieces.filter((piece) => !east(piece)) };
    const session = new Session(hole);
    stepTicks(session, 2);
    session.rotate('bar');
    stepTicks(session, ROTOR_TICKS + 1);
    const before = JSON.stringify(session.field!.save());
    session.shoot({ x: 1, y: 0, z: 0 }, 0.9);
    runUntilSettled(session);
    expect(session.stats.outOfBounds).toBe(1);
    expect(JSON.stringify(session.field!.save())).toBe(before);
    expect(rotor(session).quarter).toBe(1);
    session.dispose();
  });

  it('stands the wall itself back where the snapshot has it, not only its number', () => {
    const session = new Session(maze([BAR], 3));
    stepTicks(session, 5);
    session.shoot({ x: 1, y: 0, z: 0.4 }, 0.2);
    runUntilSettled(session);
    session.rotate('bar');
    stepTicks(session, ROTOR_TICKS + 1);
    session.undo();
    stepTicks(session, 3);
    // Across the lane again: the ball comes back off it.
    expect(strokeNorth(session)).toBeGreaterThan(-1.3);
    session.dispose();
  });
});

describe('the maxRotations challenge (SPEC v7 3.6, 7.4 #9)', () => {
  const def = { type: 'maxRotations', count: 2, text: { en: 'x', zh: 'x' } };

  it('is met at the count and under it, and not over it', () => {
    expect(challengeMet(def, { ...emptyStats(), turns: 0 })).toBe(true);
    expect(challengeMet(def, { ...emptyStats(), turns: 2 })).toBe(true);
    expect(challengeMet(def, { ...emptyStats(), turns: 3 })).toBe(false);
  });

  it('needs a count', () => {
    expect(() => challengeMet({ ...def, count: undefined }, emptyStats())).toThrow();
  });

  it('counts the turns that stand at the end, not one that was taken back with its stroke', () => {
    const cup = { type: 'cup', position: [3, 0, 3], radius: 0.22, captureSpeed: 3.5 } as const;
    const hole = maze([{ ...BAR, at: [-3, 0, -3] }], 5, { par: 6, goal: cup, challenge: { ...def, count: 1 } });
    const session = new Session(hole);
    stepTicks(session, 2);
    session.rotate('bar');
    stepTicks(session, ROTOR_TICKS + 1);
    session.shoot({ x: -1, y: 0, z: 0 }, 0.2);
    runUntilSettled(session);
    session.rotate('bar');
    stepTicks(session, ROTOR_TICKS + 1);
    session.rotate('bar');
    stepTicks(session, ROTOR_TICKS + 1);
    // Three turns stand. Taking the stroke back takes the two made after it back too.
    expect(session.field!.turnsUsed).toBe(3);
    session.undo();
    expect(session.field!.turnsUsed).toBe(1);
    session.shoot({ x: 3, y: 0, z: 3 }, 0.3);
    runUntilSettled(session);
    expect(session.outcome?.holed).toBe(true);
    expect(session.stats.turns).toBe(1);
    expect(session.outcome?.challengeMet).toBe(true);
    session.dispose();
  });
});
