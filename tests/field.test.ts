import { beforeAll, describe, expect, it } from 'vitest';
import type { Coin, Fire } from '../src/game/field/hoard';
import { Light, MAX_BEAM_SEGMENTS, type Crystal } from '../src/game/field/light';
import type { Slider } from '../src/game/field/slider';
import type { Gate, Plate, Stone } from '../src/game/field/tomb';
import { Session, type SessionEvent } from '../src/game/session';
import type { FieldDef, PartDef } from '../src/level/field';
import type { HoleDef } from '../src/level/schema';
import { runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

/** A walled room ten metres square, the tee near its south wall, with the given works in it. */
function room(parts: PartDef[], extra: Partial<HoleDef> = {}, grid?: FieldDef['grid']): HoleDef {
  return {
    id: 'room',
    par: 4,
    tee: [0, 0, 4],
    goal: { type: 'cup', position: [4.5, 0, 4.5], radius: 0.22, captureSpeed: 3.5 },
    pieces: [
      { type: 'floor', min: [-5, -5], max: [5, 5], surface: 'grass' },
      { type: 'wall', from: [-5, -5], to: [5, -5], surface: 'rail' },
      { type: 'wall', from: [5, -5], to: [5, 5], surface: 'rail' },
      { type: 'wall', from: [5, 5], to: [-5, 5], surface: 'rail' },
      { type: 'wall', from: [-5, 5], to: [-5, -5], surface: 'rail' },
    ],
    zones: [{ type: 'outOfBounds', shape: { kind: 'box', center: [0, -7, 0], halfExtents: [60, 5, 60] } }],
    outOfBounds: 'lastPosition',
    field: { grid, parts },
    ...extra,
  };
}

const NORTH = { x: 0, y: 0, z: -1 };
const WEST = { x: -1, y: 0, z: 0 };
/** Squares centred on whole metres, from (-2, -2) to (2, 2). */
const GRID = { origin: [-2, -2], cols: 5, rows: 5 } as const;
/** The square at a point on that grid. */
const at = (x: number, z: number) => [x + 2, z + 2] as const;

/** Plays a stroke to its end and returns the furthest north the ball got. */
function strike(session: Session, dir = NORTH, power = 0.3): number {
  expect(session.shoot(dir, power)).toBe(true);
  let north = Infinity;
  for (let i = 0; i < 4000 && session.phase === 'rolling'; i++) {
    session.step();
    north = Math.min(north, session.ball.position().z);
  }
  return north;
}

const part = <T>(session: Session, id: string): T => session.field!.part(id) as unknown as T;
const place = (session: Session, x: number, z: number) => session.ball.teleport({ x, y: 0.1, z });

describe('plates and gates (SPEC v4 3.3)', () => {
  const gate = (extra: object = {}): PartDef => ({ kind: 'gate', id: 'gate', from: [-4.9, -2], to: [4.9, -2], when: 'plate', ...extra });

  it('keeps a ball out while the gate is shut', () => {
    const session = new Session(room([{ kind: 'plate', id: 'plate', at: [3, 0, 3], mode: 'latch' }, gate()]));
    expect(strike(session)).toBeGreaterThan(-1.9);
    expect(part<Gate>(session, 'gate').open).toBe(false);
    session.dispose();
  });

  it('opens for good once a ball has rolled over a latch plate, before that ball gets there', () => {
    const session = new Session(room([{ kind: 'plate', id: 'plate', at: [0, 0, -1], mode: 'latch' }, gate()]));
    expect(strike(session, NORTH, 1)).toBeLessThan(-2.5);
    expect(part<Gate>(session, 'gate').open).toBe(true);
    expect(part<Gate>(session, 'gate').on).toBe(true);
    session.dispose();
  });

  it('is open only while something is on a hold plate', () => {
    const session = new Session(room([{ kind: 'plate', id: 'plate', at: [0, 0, 1], mode: 'hold' }, gate()]));
    // A ball rolling over the plate is off it again long before it reaches the gate.
    expect(strike(session)).toBeGreaterThan(-1.9);
    expect(part<Gate>(session, 'gate').open).toBe(false);
    // A ball lying on the plate holds the gate open.
    place(session, 0, 1);
    stepTicks(session, 30);
    expect(part<Plate>(session, 'plate').pressed).toBe(true);
    expect(part<Gate>(session, 'gate').open).toBe(true);
    // Struck off it, the gate is shut again before the ball arrives.
    expect(strike(session)).toBeGreaterThan(-1.9);
    session.dispose();
  });

  it('never shuts on a ball: a trap waits until the doorway is empty', () => {
    // A small plate in the doorway itself, so the signal to shut comes with the ball inside.
    const session = new Session(
      room([{ kind: 'plate', id: 'plate', at: [0, 0, -2], mode: 'latch', radius: 0.2 }, gate({ trap: true, delay: 1 })]),
    );
    const trap = part<Gate>(session, 'gate');
    expect(trap.open).toBe(true);
    session.shoot(NORTH, 0.4);
    let through = false;
    let waited = 0;
    for (let i = 0; i < 4000 && session.phase === 'rolling'; i++) {
      session.step();
      const p = session.ball.position();
      const inDoorway = trap.covers(p.x, p.z, session.ball.props.radius);
      expect(trap.open || !inDoorway).toBe(true);
      if (trap.open && part<Plate>(session, 'plate').on) waited++;
      if (!trap.open && p.z < -2) through = true;
    }
    expect(waited).toBeGreaterThan(2);
    expect(through).toBe(true);
    expect(trap.open).toBe(false);
    expect(trap.on).toBe(true);
    // Shut behind it: the ball stays on the far side.
    expect(session.ball.position().z).toBeLessThan(-2);
    session.dispose();
  });
});

describe('stones (SPEC v4 3.3, 4.4)', () => {
  const stone = (x: number, z: number, id = 'stone'): PartDef => ({ kind: 'stone', id, cell: at(x, z) });

  it('slides one square away from the side that was struck, and lands exactly on it', () => {
    const session = new Session(room([stone(0, 1)], {}, GRID));
    strike(session);
    const block = part<Stone>(session, 'stone');
    expect(block.cell).toEqual(at(0, 0));
    // Exactly, not nearly: as exact as the physics engine's own numbers are.
    expect(block.center).toEqual({ x: 0, y: Math.fround(0.3), z: 0 });
    // From the east it goes west.
    place(session, 3, 0);
    strike(session, WEST);
    expect(block.cell).toEqual(at(-1, 0));
    expect(block.center).toEqual({ x: -1, y: Math.fround(0.3), z: 0 });
    session.dispose();
  });

  it('does not move when the edge of the grid, another stone or a shut gate is in the way', () => {
    const cues: string[] = [];
    const listen = (session: Session) =>
      session.on((event: SessionEvent) => event.type === 'cue' && cues.push(event.name));

    const edge = new Session(room([stone(0, -2)], {}, GRID));
    listen(edge);
    strike(edge, NORTH, 0.5);
    expect(part<Stone>(edge, 'stone').cell).toEqual(at(0, -2));
    expect(cues).toContain('stoneBlocked');
    edge.dispose();

    const pair = new Session(room([stone(0, 1), stone(0, 0, 'other')], {}, GRID));
    strike(pair);
    expect(part<Stone>(pair, 'stone').cell).toEqual(at(0, 1));
    expect(part<Stone>(pair, 'other').cell).toEqual(at(0, 0));
    pair.dispose();

    const gated = new Session(
      room(
        [
          stone(0, 1),
          { kind: 'plate', id: 'plate', at: [3, 0, 3], mode: 'latch' },
          { kind: 'gate', id: 'gate', from: [-0.5, 0], to: [0.5, 0], when: 'plate' },
        ],
        {},
        GRID,
      ),
    );
    strike(gated);
    expect(part<Stone>(gated, 'stone').cell).toEqual(at(0, 1));
    // With the gate open the same stroke moves it into the doorway, and the gate cannot shut on it.
    place(gated, 3, 3);
    stepTicks(gated, 30);
    place(gated, 0, 4);
    strike(gated);
    expect(part<Stone>(gated, 'stone').cell).toEqual(at(0, 0));
    gated.dispose();
  });

  it('holds a plate down, and with it a gate open, for as long as it stands there', () => {
    const session = new Session(
      room(
        [
          stone(0, 1),
          { kind: 'plate', id: 'plate', at: [0, 0, 0], mode: 'hold' },
          { kind: 'gate', id: 'gate', from: [2, -2], to: [4.9, -2], when: 'plate' },
        ],
        {},
        GRID,
      ),
    );
    strike(session);
    expect(part<Plate>(session, 'plate').pressed).toBe(true);
    expect(part<Gate>(session, 'gate').open).toBe(true);
    // The ball is nowhere near the plate: it is the stone that holds it.
    expect(session.ball.position().z).toBeGreaterThan(1);
    session.dispose();
  });
});

describe('light (SPEC v4 3.4, 4.5)', () => {
  const light = (session: Session) => session.field!.system('light', () => new Light(session.field!));

  it('follows a crystal round to a receiver when a ball turns it, and the receiver stays on', () => {
    const session = new Session(
      room([
        { kind: 'emitter', at: [-4, 0, 0], heading: 90 },
        { kind: 'crystal', id: 'crystal', at: [0, 0, 0], facings: [180, 0] },
        { kind: 'receiver', id: 'receiver', at: [0, 0, -4] },
        { kind: 'gate', id: 'gate', from: [2, -2], to: [4.9, -2], when: 'receiver' },
      ]),
    );
    stepTicks(session, 2);
    expect(light(session).beams).toHaveLength(1);
    expect(light(session).beams[0].home).toBe(false);
    expect(part<Crystal>(session, 'crystal').lit).toBe(true);
    expect(session.field!.part('receiver').on).toBe(false);

    strike(session);
    expect(part<Crystal>(session, 'crystal').facing).toBe(0);
    expect(light(session).beams[0].home).toBe(true);
    expect(session.field!.part('receiver').on).toBe(true);
    expect(part<Gate>(session, 'gate').open).toBe(true);

    // Turned away again, the light leaves the receiver, but what it opened stays open.
    strike(session);
    expect(part<Crystal>(session, 'crystal').facing).toBe(180);
    expect(light(session).beams[0].home).toBe(false);
    expect(session.field!.part('receiver').on).toBe(true);
    expect(part<Gate>(session, 'gate').open).toBe(true);
    session.dispose();
  });

  it('turns a crystal once per knock, however the ball rattles against it', () => {
    const session = new Session(room([{ kind: 'crystal', id: 'crystal', at: [0, 0, 0], facings: [0, 90, 180, 270] }]));
    strike(session, NORTH, 1);
    expect(part<Crystal>(session, 'crystal').index).toBe(1);
    session.dispose();
  });

  it('gives up on light that goes round in circles', () => {
    const session = new Session(
      room([
        { kind: 'emitter', at: [-4, 0, 0], heading: 90 },
        // Four crystals passing the light round a square, for ever.
        { kind: 'crystal', at: [0, 0, 0], facings: [0, 90] },
        { kind: 'crystal', at: [0, 0, -3], facings: [90, 0] },
        { kind: 'crystal', at: [3, 0, -3], facings: [180, 0] },
        { kind: 'crystal', at: [3, 0, 0], facings: [270, 0] },
        // And two that send it straight back at each other.
        { kind: 'emitter', at: [-4, 0, 3], heading: 90 },
        { kind: 'crystal', at: [-2, 0, 3], facings: [90, 0] },
        { kind: 'crystal', at: [2, 0, 3], facings: [270, 0] },
      ]),
    );
    stepTicks(session, 2);
    const { beams } = light(session);
    expect(beams).toHaveLength(2);
    for (const beam of beams) {
      expect(beam.home).toBe(false);
      expect(beam.points.length).toBeLessThanOrEqual(MAX_BEAM_SEGMENTS + 1);
    }
    // Round the square once and back to where it came in.
    expect(beams[0].points).toHaveLength(6);
    expect(beams[1].points).toHaveLength(4);
    session.dispose();
  });
});

describe('chains (SPEC v4 3.5)', () => {
  it('runs one part after another, and the stroke is not over until the last has stopped', () => {
    const session = new Session(
      room([
        { kind: 'plate', id: 'plate', at: [0, 0, 3], mode: 'latch' },
        { kind: 'slider', id: 'block', role: 'pusher', size: [1, 1, 1], from: [-4, 0.5, -4], to: [-2, 0.5, -4], ticks: 90, when: 'plate', surface: 'stone' },
        { kind: 'gate', id: 'gate', from: [2, -2], to: [4.9, -2], when: 'block', delay: 20 },
      ]),
    );
    const order: string[] = [];
    session.on((event) => event.type === 'partChanged' && order.push(event.part));
    session.shoot(NORTH, 0.07);
    let waited = 0;
    for (let i = 0; i < 4000 && session.phase === 'rolling'; i++) {
      session.step();
      if (session.waiting) waited++;
      // The gate does not move until the block has arrived.
      if (!part<Slider>(session, 'block').on) expect(part<Gate>(session, 'gate').open).toBe(false);
    }
    expect(order).toEqual(['block', 'gate']);
    expect(part<Slider>(session, 'block').mover.pose.position).toEqual({ x: -2, y: 0.5, z: -4 });
    expect(part<Gate>(session, 'gate').on).toBe(true);
    // The ball had long stopped; the stroke waited for the chain.
    expect(waited).toBeGreaterThan(60);
    expect(session.field!.busy).toBe(false);
    session.dispose();
  });

  it('lets a ball roll across a bridge once it has risen, and not before', () => {
    const bridged = (when: string): HoleDef =>
      room(
        [
          { kind: 'plate', id: 'plate', at: [0, 0, 3], mode: 'latch' },
          { kind: 'plate', id: 'never', at: [4, 0, 4], mode: 'latch' },
          { kind: 'slider', id: 'bridge', role: 'platform', size: [2, 0.4, 2.2], from: [0, -1.6, 0], to: [0, -0.196, 0], ticks: 30, when, surface: 'stone' },
        ],
        {
          // The room, with a pit across the middle of it.
          pieces: [
            { type: 'floor', min: [-5, 1], max: [5, 5], surface: 'grass' },
            { type: 'floor', min: [-5, -5], max: [5, -1], surface: 'grass' },
            { type: 'wall', from: [-5, -5], to: [5, -5], surface: 'rail' },
            { type: 'wall', from: [5, -5], to: [5, 5], surface: 'rail' },
            { type: 'wall', from: [5, 5], to: [-5, 5], surface: 'rail' },
            { type: 'wall', from: [-5, 5], to: [-5, -5], surface: 'rail' },
          ],
        },
      );
    const fallen = new Session(bridged('never'));
    strike(fallen, NORTH, 0.35);
    expect(fallen.stats.outOfBounds).toBe(1);
    fallen.dispose();

    const crossed = new Session(bridged('plate'));
    strike(crossed, NORTH, 0.08);
    expect(part<Slider>(crossed, 'bridge').on).toBe(true);
    place(crossed, 0, 3);
    expect(strike(crossed, NORTH, 0.35)).toBeLessThan(-1.5);
    expect(crossed.stats.outOfBounds).toBe(0);
    crossed.dispose();
  });
});

const HOARD: PartDef[] = [
  { kind: 'coin', id: 'near', at: [0, 0, 3] },
  { kind: 'coin', id: 'far', at: [3, 0, 3] },
  { kind: 'bell', id: 'bones', at: [0, 0, 1], look: 'bones' },
  { kind: 'dragon', id: 'dragon', at: [4, 0, -4], threshold: 1 },
  {
    kind: 'fire',
    id: 'fire',
    shape: { kind: 'box', center: [0, 0.3, -2], halfExtents: [5, 0.5, 0.3] },
    when: 'dragon',
    delay: 5,
    rest: [[0, 0, -1]],
  },
];

describe('gold and the dragon (SPEC v4 3.6)', () => {
  it('picks up the coins a ball rolls through and leaves the others', () => {
    const session = new Session(room(HOARD));
    strike(session, NORTH, 0.07);
    expect(part<Coin>(session, 'near').collected).toBe(true);
    expect(part<Coin>(session, 'far').collected).toBe(false);
    expect(session.field!.alert).toBe(0);
    session.dispose();
  });

  it('wakes the dragon at the threshold, and what the dragon lights burns', () => {
    const session = new Session(room(HOARD));
    const cues: string[] = [];
    session.on((event) => event.type === 'cue' && cues.push(event.name));
    session.shoot(NORTH, 0.45);
    let burned = false;
    session.on((event) => event.type === 'outOfBounds' && (burned = true));
    for (let i = 0; i < 600 && !burned; i++) session.step();
    expect(cues).toEqual(expect.arrayContaining(['coin', 'bell', 'dragonWake', 'fireOn']));
    expect(burned).toBe(true);
    session.dispose();
  });

  it('counts a bell once for a ball that stops against it, and again when the ball comes back', () => {
    const session = new Session(room([{ kind: 'bell', id: 'bell', at: [0, 0, 0] }, { kind: 'dragon', id: 'dragon', at: [4, 0, -4], threshold: 5 }]));
    strike(session, NORTH, 0.3);
    expect(session.field!.alert).toBe(1);
    stepTicks(session, 120);
    expect(session.field!.alert).toBe(1);
    place(session, 0, 4);
    strike(session, NORTH, 0.3);
    expect(session.field!.alert).toBe(2);
    expect(session.field!.part('dragon').on).toBe(false);
    session.dispose();
  });

  it('never leaves a ball where fire can burn', () => {
    const parts: PartDef[] = [
      { kind: 'plate', id: 'plate', at: [0, 0, 3], mode: 'latch' },
      {
        kind: 'fire',
        id: 'fire',
        shape: { kind: 'box', center: [0, 0.3, 0], halfExtents: [5, 0.5, 1.5] },
        when: 'plate',
        // Lit, but its burst comes late in a long cycle: the ball has time to stop in it.
        cycle: { period: 40, burn: 0.05, phase: 0.2 },
        rest: [[2, 0, 2.5]],
      },
    ];
    const session = new Session(room(parts));
    strike(session, NORTH, 0.2);
    expect(part<Fire>(session, 'fire').lit).toBe(true);
    expect(session.stats.outOfBounds).toBe(0);
    const p = session.ball.position();
    expect([p.x, p.z]).toEqual([2, 2.5]);
    session.dispose();
  });
});

describe('the course goes back with the ball (SPEC v4 3.8)', () => {
  const works = (): HoleDef =>
    room(
      [
        ...HOARD,
        { kind: 'stone', id: 'stone', cell: at(-2, 1) },
        { kind: 'plate', id: 'hold', at: [-2, 0, 0], mode: 'hold' },
        { kind: 'plate', id: 'latch', at: [-1, 0, 3], mode: 'latch' },
        { kind: 'gate', id: 'gate', from: [-4.9, 2], to: [-3, 2], when: 'hold' },
        { kind: 'slider', id: 'block', role: 'pusher', size: [1, 1, 1], from: [4, 0.5, 4], to: [4, 0.5, 2], ticks: 20, when: 'latch', surface: 'stone' },
        { kind: 'emitter', at: [-4, 0, -4], heading: 90 },
        { kind: 'crystal', id: 'crystal', at: [-2, 0, -4], facings: [90, 180] },
        { kind: 'receiver', id: 'receiver', at: [4, 0, -4] },
      ],
      {},
      GRID,
    );

  it('puts every part back exactly as it was when a stroke ends out of bounds', () => {
    const session = new Session(works());
    stepTicks(session, 5);
    // First a stroke that stands: over the latch plate and the near coin, into the stone.
    place(session, -2, 4);
    strike(session, NORTH, 0.25);
    expect(part<Stone>(session, 'stone').cell).toEqual(at(-2, 0));
    expect(part<Gate>(session, 'gate').open).toBe(true);
    place(session, 0, 4);
    stepTicks(session, 5);
    const before = JSON.stringify(session.field!.save());
    const strokes = session.strokes;

    // Then one that picks up gold, wakes the dragon and burns.
    strike(session, NORTH, 0.45);
    expect(session.stats.outOfBounds).toBe(1);
    expect(session.strokes).toBe(strokes + 2);
    expect(session.phase).toBe('aiming');
    expect(JSON.stringify(session.field!.save())).toBe(before);
    expect(part<Coin>(session, 'near').collected).toBe(false);
    expect(session.field!.alert).toBe(0);
    expect(session.field!.part('dragon').on).toBe(false);
    expect(part<Fire>(session, 'fire').burning).toBe(false);
    const p = session.ball.position();
    expect([p.x, p.z]).toEqual([0, 4]);
    // The stroke before it still stands.
    expect(part<Stone>(session, 'stone').cell).toEqual(at(-2, 0));
    session.dispose();
  });

  it('takes a stroke back on request, for the price of a stroke, as far back as the tee', () => {
    const session = new Session(works());
    const start = JSON.stringify(session.field!.save());
    expect(session.canUndo).toBe(false);
    place(session, -2, 4);
    strike(session, NORTH, 0.25);
    const afterOne = JSON.stringify(session.field!.save());
    // A second stroke shoves the stone on, off its plate: the gate shuts.
    place(session, -2, 4);
    strike(session, NORTH, 0.25);
    expect(part<Stone>(session, 'stone').cell).toEqual(at(-2, -1));
    expect(part<Gate>(session, 'gate').open).toBe(false);
    expect(session.strokes).toBe(2);

    expect(session.undo()).toBe(true);
    expect(session.strokes).toBe(3);
    expect(JSON.stringify(session.field!.save())).toBe(afterOne);
    expect(part<Stone>(session, 'stone').center).toEqual({ x: -2, y: 0.3, z: 0 });
    expect(part<Gate>(session, 'gate').open).toBe(true);
    expect(session.undo()).toBe(true);
    expect(session.strokes).toBe(4);
    expect(JSON.stringify(session.field!.save())).toBe(start);
    expect(session.canUndo).toBe(false);
    expect(session.undo()).toBe(false);
    session.dispose();
  });

  it('ends the hole when taking a stroke back uses up the last one', () => {
    const session = new Session(works());
    place(session, 3, 0);
    for (let i = 0; i < 7; i++) strike(session, WEST, 0.07);
    expect(session.strokes).toBe(7);
    expect(session.undo()).toBe(true);
    expect(session.phase).toBe('done');
    expect(session.outcome).toMatchObject({ holed: false, strokes: 8, stars: 1 });
    session.dispose();
  });

  it('plays a round with an undo and an out-of-bounds back to exactly the same end', () => {
    const play = (): { inputs: unknown; end: string; at: unknown; strokes: number } => {
      const session = new Session(works());
      stepTicks(session, 10);
      strike(session, { x: -0.5, y: 0, z: -1 }, 0.3);
      stepTicks(session, 20);
      session.undo();
      stepTicks(session, 15);
      strike(session, NORTH, 0.3);
      stepTicks(session, 25);
      strike(session, { x: -0.48, y: 0, z: -1 }, 0.22);
      const result = {
        inputs: session.inputs.map((input) => ({ ...input })),
        end: JSON.stringify(session.field!.save()),
        at: { ...session.ball.position() },
        strokes: session.strokes,
      };
      session.dispose();
      return result;
    };
    const first = play();
    expect(first.strokes).toBe(5);

    const again = new Session(works());
    again.replay(first.inputs as Parameters<Session['replay']>[0]);
    for (let i = 0; i < 20000 && (again.replaying || again.phase === 'rolling'); i++) again.step();
    expect(again.strokes).toBe(first.strokes);
    expect(JSON.stringify(again.field!.save())).toBe(first.end);
    expect({ ...again.ball.position() }).toStrictEqual(first.at);
    expect(again.inputs).toStrictEqual(first.inputs);
    again.dispose();
  });

  it('leaves a hole without works exactly as it was: nothing to take back', () => {
    const session = new Session({ ...room([]), field: undefined });
    strike(session);
    expect(session.canUndo).toBe(false);
    expect(session.undo()).toBe(false);
    session.dispose();
  });
});

describe('what the works leave behind for a challenge', () => {
  it('judges by how the course stands at the end, not by what an undone stroke did', () => {
    const hole = room(
      [
        { kind: 'coin', id: 'coin', at: [0, 0, 3] },
        { kind: 'bell', id: 'bones', at: [2, 0, 4], look: 'bones' },
        { kind: 'dragon', id: 'dragon', at: [4, 0, -4], threshold: 1 },
      ],
      {
        goal: { type: 'cup', position: [0, 0, 0], radius: 0.22, captureSpeed: 3.5 },
        challenge: { type: 'allCoinsPartOff', part: 'dragon', text: { en: 'x', zh: 'x' } },
      },
    );
    // Wake the dragon, take it back, then hole out over the coin: three strokes, par four.
    const session = new Session(hole);
    strike(session, { x: 1, y: 0, z: 0 }, 0.14);
    expect(session.field!.part('dragon').on).toBe(true);
    session.undo();
    expect(session.field!.part('dragon').on).toBe(false);
    session.shoot(NORTH, 0.26);
    runUntilSettled(session);
    expect(session.outcome).toMatchObject({ holed: true, strokes: 3, stars: 3, challengeMet: true });
    session.dispose();

    // The same without taking it back: holed, but the dragon is awake.
    const woken = new Session(hole);
    strike(woken, { x: 1, y: 0, z: 0 }, 0.14);
    place(woken, 0, 4);
    woken.shoot(NORTH, 0.26);
    runUntilSettled(woken);
    expect(woken.outcome).toMatchObject({ holed: true, stars: 2, challengeMet: false });
    woken.dispose();
  });
});
