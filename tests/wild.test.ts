import { beforeAll, describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/chapters';
import { REPLAYS } from '../src/debug/replays';
import { playTo } from '../src/debug/search';
import type { Crumble, Water } from '../src/game/field/elements';
import { Session, type InputRecord } from '../src/game/session';
import { stagesOf } from '../src/level/chapters';
import type { HoleDef } from '../src/level/schema';
import { runUntilSettled, setupEngine } from './helpers';

beforeAll(setupEngine);

const chapter = CHAPTERS[4];
const holes = stagesOf(chapter).flatMap((stage) => stage.holes);
const hole = (id: string): HoleDef => holes.find((h) => h.id === id)!;
const withWorks = holes.filter((h) => h.field);
const forcesOnly = holes.filter((h) => !h.field);

/** The other way through dam-2: drain the pool and take the walk along the bottom. Found with src/debug/search.ts. */
const DAM_2_LOW: InputRecord[] = [
  { type: 'shot', tick: 30, dir: [-0.6840957771016855, 0, -0.7293921906297332], power: 0.5 },
  { type: 'shot', tick: 251, dir: [-0.07381580767444787, 0, -0.9972718919820055], power: 0.7166666666666667 },
];

describe('Chapter 5 holes (SPEC v5 3)', () => {
  it('is Wild Elements: four worlds and a finale, open from the Chapter 4 finale', () => {
    expect(chapter.id).toBe('ch5');
    expect(chapter.after).toBe('ch4');
    expect(chapter.worlds.map((world) => world.id)).toEqual(['reef', 'polar', 'dam', 'canyon']);
    expect(holes).toHaveLength(13);
  });

  it('has works, and with them a stroke to take back, on the dam, the canyon and the finale only (SPEC v5 3.7)', () => {
    expect(forcesOnly.map((h) => h.id)).toEqual(['reef-1', 'reef-2', 'reef-3', 'polar-1', 'polar-2', 'polar-3']);
    expect(withWorks.map((h) => h.id)).toEqual(['dam-1', 'dam-2', 'dam-3', 'canyon-1', 'canyon-2', 'canyon-3', 'ch5-finale']);
    const reef = new Session(hole('reef-1'));
    reef.shoot({ x: 1, y: 0, z: 0 }, 0.1);
    runUntilSettled(reef);
    expect(reef.field).toBeNull();
    expect(reef.canUndo).toBe(false);
    expect(reef.undo()).toBe(false);
    reef.dispose();
  });

  it.each(withWorks)('$id has works that are wired up and start at rest', (def) => {
    expect(def.outOfBounds).toBe('lastPosition');
    const session = new Session(def);
    const field = session.field!;
    for (let i = 0; i < 400; i++) {
      session.step();
      // A lock that fills and empties by itself never holds a stroke open.
      expect(field.busy).toBe(false);
    }
    expect(session.strokes).toBe(0);
    expect(session.stats.outOfBounds).toBe(0);
    for (const slab of field.all<Crumble>('crumble')) expect(slab.on).toBe(false);
    for (const water of field.all<Water>('water')) if (!water.tidal) expect(water.level).toBe(water.def.level);
    session.dispose();
  });

  it.each(holes)('$id is solved by its reference round with no penalty and no stroke taken back', (def) => {
    const session = playTo(def, REPLAYS[def.id].inputs);
    expect(session.outcome).toMatchObject({ holed: true, stars: 3 });
    expect(session.strokes).toBeLessThanOrEqual(def.par);
    expect(session.stats.undos).toBe(0);
    expect(session.stats.outOfBounds).toBe(0);
    session.dispose();
  });

  // SPEC v5 5: where a current ends and where a column sets a ball down must be places
  // a ball can stop. A stroke that never ended would be the sign that one is not.
  it.each(holes.filter((h) => h.zones.some((zone) => zone.type === 'current' || zone.type === 'bubbleLift')))(
    '$id brings every stroke to an end, wherever the water takes it',
    (def) => {
      for (const degrees of [-60, -30, -10, 0, 10, 30, 60, 180]) {
        for (const power of [0.12, 0.35, 0.7]) {
          const session = new Session(def);
          const angle = (degrees * Math.PI) / 180;
          session.shoot({ x: Math.sin(angle), y: 0, z: -Math.cos(angle) }, power);
          let ticks = 0;
          while (session.phase === 'rolling' && ticks++ < 4000) session.step();
          expect(session.phase).not.toBe('rolling');
          // And it stays ended: nothing picks the ball up again while the player aims.
          const at = { ...session.ball.position() };
          for (let i = 0; i < 400 && session.phase === 'aiming'; i++) session.step();
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

describe('dam-2: two ways across (SPEC v5 3.4)', () => {
  it('can be finished over the raft at high water, as its reference round does', () => {
    const session = playTo(hole('dam-2'), REPLAYS['dam-2'].inputs);
    expect(session.field!.part('fill').on).toBe(true);
    expect(session.field!.part('drain').on).toBe(false);
    expect(session.outcome?.holed).toBe(true);
    session.dispose();
  });

  it('can be finished along the bottom at low water too', () => {
    const session = new Session(hole('dam-2'));
    session.replay(DAM_2_LOW);
    let lowest = 0;
    for (let i = 0; i < 20000 && (session.replaying || session.phase === 'rolling'); i++) {
      session.step();
      lowest = Math.min(lowest, session.ball.position().y);
    }
    expect(session.field!.part('drain').on).toBe(true);
    expect(session.field!.part('fill').on).toBe(false);
    // It went down to the walk, a metre and a half under the banks, and came up again.
    expect(lowest).toBeLessThan(-1.2);
    expect(session.outcome).toMatchObject({ holed: true, stars: 3 });
    expect(session.stats.outOfBounds).toBe(0);
    session.dispose();
  });

  it('is back at half way with both valves open, and a ball on the bottom drowns', () => {
    const session = new Session(hole('dam-2'));
    const water = session.field!.part('pool') as unknown as Water;
    const turn = (id: string) => (session.field!.part(id) as unknown as { hit(ball: unknown, speed: number): void }).hit(session.ball, 1);
    turn('drain');
    for (let i = 0; i < 200; i++) session.step();
    expect(water.level).toBe(-2.1);
    session.ball.teleport({ x: -3.5, y: -1.4, z: 0 });
    for (let i = 0; i < 60; i++) session.step();
    expect(session.stats.outOfBounds).toBe(0);
    turn('fill');
    for (let i = 0; i < 200; i++) session.step();
    expect(water.level).toBe(-1.1);
    expect(session.stats.outOfBounds).toBe(1);
    session.dispose();
  });
});

describe('canyon-2: the order matters, and a wrong one can be taken back (SPEC v5 3.5, 4.4)', () => {
  it('strands a ball that takes the bridge straight ahead, until the stroke is taken back', () => {
    const def = hole('canyon-2');
    const session = new Session(def);
    const settle = () => {
      let ticks = 0;
      while (session.phase === 'rolling' && ticks++ < 4000) session.step();
    };
    // Straight ahead, over the middle bridge to the far mesa.
    session.shoot({ x: 0, y: 0, z: -1 }, 0.5);
    settle();
    expect(session.stats.outOfBounds).toBe(0);
    expect(session.ball.position().z).toBeLessThan(0.5);
    // The bridge is gone behind it, the gate is shut, and the plate is two bridges away.
    const slabs = session.field!.all<Crumble>('crumble');
    expect(slabs.filter((slab) => slab.on)).toHaveLength(3);
    expect(session.field!.part('gate').on).toBe(false);

    expect(session.undo()).toBe(true);
    expect(slabs.filter((slab) => slab.on)).toHaveLength(0);
    expect(session.strokes).toBe(2);
    // From here the reference round, stroke for stroke: east to the plate, across, in.
    for (const input of REPLAYS[def.id].inputs) {
      if (input.type !== 'shot') continue;
      for (let i = 0; i < 30; i++) session.step();
      expect(session.shoot({ x: input.dir[0], y: 0, z: input.dir[2] }, input.power)).toBe(true);
      settle();
    }
    expect(session.outcome).toMatchObject({ holed: true, strokes: 5, stars: 1 });
    expect(session.stats.undos).toBe(1);
    // The round with the undo in it is a round like any other: it plays back to the same end.
    const again = playTo(def, session.inputs);
    expect(again.outcome).toStrictEqual(session.outcome);
    expect({ ...again.ball.position() }).toStrictEqual({ ...session.ball.position() });
    again.dispose();
    session.dispose();
  });
});

describe('the Chapter 5 finale (SPEC v5 3.6, 7.4 #12)', () => {
  it('is finished within par by a round that takes no stroke back, which is its third star', () => {
    const def = hole('ch5-finale');
    expect(def.challenge?.type).toBe('noUndo');
    const session = playTo(def, REPLAYS[def.id].inputs);
    expect(session.outcome).toMatchObject({ holed: true, stars: 3, challengeMet: true });
    expect(session.strokes).toBeLessThanOrEqual(def.par);
    expect(session.stats.undos).toBe(0);
    session.dispose();
  });
});
