import { beforeAll, describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/chapters';
import { REPLAYS } from '../src/debug/replays';
import { playTo } from '../src/debug/search';
import type { Gate, Stone } from '../src/game/field/tomb';
import { Session, type InputRecord } from '../src/game/session';
import { stagesOf } from '../src/level/chapters';
import type { HoleDef } from '../src/level/schema';
import { setupEngine } from './helpers';

beforeAll(setupEngine);

const chapter = CHAPTERS[3];
const holes = stagesOf(chapter).flatMap((stage) => stage.holes);
const hole = (id: string): HoleDef => holes.find((h) => h.id === id)!;

/**
 * Rounds in which the thing that shuts the short way has happened, played on to the cup
 * (SPEC v4 7.3 #7): the boulder is down, or the dragon is awake. Found with
 * src/debug/search.ts, like the reference solutions.
 */
const AFTER: Record<string, { part: string; inputs: InputRecord[] }> = {
  'jungle-2': {
    part: 'boulder',
    inputs: [
      { type: 'shot', tick: 30, dir: [0.007924264693822524, 0, -0.9999686025216303], power: 0.36 },
      { type: 'shot', tick: 279, dir: [0.08398422907506223, 0, 0.9964670838851967], power: 0.3 },
      { type: 'shot', tick: 515, dir: [0.9997472098405635, 0, -0.022483692223660187], power: 0.31333333333333335 },
      { type: 'shot', tick: 729, dir: [-0.0036484986499100277, 0, -0.999993344206651], power: 0.8333333333333333 },
      { type: 'shot', tick: 1016, dir: [-0.9859929347530881, 0, -0.16678708768064898], power: 0.24 },
    ],
  },
  'jungle-3': {
    part: 'boulder',
    inputs: [
      { type: 'shot', tick: 30, dir: [1.2246467991473532e-16, 0, -1], power: 0.32 },
      { type: 'shot', tick: 270, dir: [0.05233595624294367, 0, 0.9986295347545738], power: 0.5399999999999999 },
      { type: 'shot', tick: 521, dir: [0.9964397599292127, 0, -0.08430779816964071], power: 0.26 },
      { type: 'shot', tick: 730, dir: [0.10830066060561068, 0, -0.9941181855857926], power: 0.5066666666666666 },
      { type: 'shot', tick: 977, dir: [-0.3631271537227162, 0, -0.9317395935717441], power: 0.29999999999999993 },
      { type: 'shot', tick: 1210, dir: [0.025877947399049216, 0, -0.9996651098434975], power: 0.3933333333333333 },
      { type: 'shot', tick: 1437, dir: [-0.9842330337660584, 0, -0.17687661022210086], power: 0.24 },
    ],
  },
  'hoard-1': {
    part: 'dragon',
    inputs: [
      { type: 'shot', tick: 30, dir: [0.46766973926491906, 0, -0.8839032837227626], power: 0.44999999999999996 },
      { type: 'shot', tick: 289, dir: [-0.9909866305480808, 0, -0.13396080798114648], power: 0.24166666666666664 },
      { type: 'shot', tick: 509, dir: [0.00844383723400701, 0, -0.9999643501709277], power: 0.31666666666666665 },
      { type: 'shot', tick: 749, dir: [0.9980594413016245, 0, -0.06226838386122689], power: 0.625 },
    ],
  },
  'hoard-2': {
    part: 'dragon',
    inputs: [
      { type: 'shot', tick: 30, dir: [0.4162378794934145, 0, -0.9092557548208456], power: 0.30666666666666664 },
      { type: 'shot', tick: 267, dir: [-0.6282426099236897, 0, -0.7780174953535881], power: 0.22 },
      { type: 'shot', tick: 480, dir: [-0.6105190587474827, 0, -0.7920015649644184], power: 0.78 },
      { type: 'shot', tick: 758, dir: [0.9931842548002197, 0, -0.11655486269106184], power: 0.41500000000000004 },
    ],
  },
  'hoard-3': {
    part: 'dragon',
    inputs: [
      { type: 'shot', tick: 30, dir: [-0.10893960679705449, 0, -0.9940483700861358], power: 0.6833333333333333 },
      { type: 'shot', tick: 305, dir: [-0.9999210822697038, 0, 0.01256301049049707], power: 0.36 },
      { type: 'shot', tick: 531, dir: [0.008525157929998348, 0, -0.999963660180843], power: 0.41428571428571426 },
      { type: 'shot', tick: 766, dir: [0.9944757811394698, 0, -0.10496628376312718], power: 0.41000000000000003 },
    ],
  },
  'ch4-finale': {
    part: 'dragon',
    inputs: [
      { type: 'shot', tick: 30, dir: [1.2246467991473532e-16, 0, -1], power: 0.39499999999999996 },
      { type: 'shot', tick: 215, dir: [0.3196920672391911, 0, -0.9475214942914659], power: 0.44999999999999996 },
      { type: 'shot', tick: 462, dir: [-0.650084742379831, 0, -0.7598617161858786], power: 0.55 },
      { type: 'shot', tick: 734, dir: [-0.10282952289975908, 0, -0.9946989942792784], power: 0.38 },
      { type: 'shot', tick: 975, dir: [0.020221367992221403, 0, -0.9997955272337055], power: 0.25 },
    ],
  },
};

/**
 * The dragon holes offer a choice (SPEC v4 3.6): these rounds go straight for the cup
 * and leave the gold where it lies. They finish under par, with two stars.
 */
const PLAIN: Record<string, InputRecord[]> = {
  'hoard-1': [
    { type: 'shot', tick: 30, dir: [0.013962181161198304, 0, -0.9999025239978254], power: 0.69 },
  ],
  'hoard-3': [
    { type: 'shot', tick: 30, dir: [0.013962177050933607, 0, -0.9999025240552193], power: 0.69 },
  ],
};

describe('Chapter 4 holes (SPEC v4 3)', () => {
  it('is Ancient Ruins: four worlds of works and a finale, open from the Chapter 2 finale', () => {
    expect(chapter.id).toBe('ch4');
    expect(chapter.after).toBe('ch2');
    expect(holes).toHaveLength(13);
  });

  it.each(holes)('$id has works that are wired up and start at rest', (def) => {
    expect(def.field).toBeDefined();
    // The course goes back with the ball, to where the stroke was played from.
    expect(def.outOfBounds).toBe('lastPosition');
    // Building the session wires every part: an unknown name or kind throws here.
    const session = new Session(def);
    const field = session.field!;
    expect(field.busy).toBe(false);
    for (let i = 0; i < 180; i++) session.step();
    expect(field.busy).toBe(false);
    expect(session.strokes).toBe(0);
    expect(field.alert).toBe(0);
    // Nothing has happened yet: no part that waits for a signal has had one.
    for (const gate of field.all<Gate>('gate')) expect(gate.open).toBe(gate.def.trap ?? false);
    for (const part of field.parts) {
      if (part.kind === 'slider' || part.kind === 'fire' || part.kind === 'receiver' || part.kind === 'coin') {
        expect(part.on).toBe(false);
      }
    }
    // Stones stand on ground, clear of every wall.
    const ground = session.compiled.ground!;
    for (const stone of field.all<Stone>('stone')) {
      const { x, z } = stone.center;
      for (const [dx, dz] of [[0, 0], [0.44, 0.44], [-0.44, 0.44], [0.44, -0.44], [-0.44, -0.44]]) {
        expect(ground.surfaceAt({ x: x + dx, y: stone.anchor.y, z: z + dz })).not.toBeNull();
      }
    }
    // Every part a challenge names exists.
    if (def.challenge?.part) expect(() => field.part(def.challenge!.part!)).not.toThrow();
    session.dispose();
  });

  it.each(holes)('$id is solved by its reference round with the dragon asleep and no stroke taken back', (def) => {
    const session = playTo(def, REPLAYS[def.id].inputs);
    expect(session.outcome).toMatchObject({ holed: true, stars: 3 });
    expect(session.stats.undos).toBe(0);
    expect(session.stats.outOfBounds).toBe(0);
    expect(session.field!.all('dragon').some((dragon) => dragon.on)).toBe(false);
    session.dispose();
  });

  it.each(Object.keys(PLAIN))('%s gives up its third star, and nothing else, to a round that leaves the gold', (id) => {
    const def = hole(id);
    const plain = playTo(def, PLAIN[id]);
    expect(plain.outcome).toMatchObject({ holed: true, stars: 2, challengeMet: false });
    expect(plain.field!.all('coin').every((coin) => !coin.on)).toBe(true);
    // Going for the gold takes more strokes than not: that is the price of it.
    const greedy = playTo(def, REPLAYS[id].inputs);
    expect(greedy.outcome).toMatchObject({ holed: true, stars: 3 });
    expect(greedy.strokes).toBeGreaterThan(plain.strokes);
    plain.dispose();
    greedy.dispose();
  });

  it.each(Object.keys(AFTER))('%s can still be finished once the short way is shut', (id) => {
    const def = hole(id);
    const { part, inputs } = AFTER[id];
    // The first strokes set the trap off, or wake the dragon...
    const session = new Session(def);
    session.replay(inputs);
    let shut = false;
    for (let i = 0; i < 20000 && (session.replaying || session.phase === 'rolling'); i++) {
      session.step();
      shut ||= session.field!.part(part).on;
    }
    expect(shut).toBe(true);
    // ...and the hole is finished all the same, inside its stroke limit, without a penalty.
    expect(session.outcome?.holed).toBe(true);
    expect(session.field!.part(part).on).toBe(true);
    expect(session.strokes).toBe(inputs.length);
    expect(session.strokes).toBeLessThanOrEqual(session.strokeLimit);
    expect(session.stats.outOfBounds).toBe(0);
    session.dispose();
  });
});
