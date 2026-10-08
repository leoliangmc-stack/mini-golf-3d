import { beforeAll, describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/chapters';
import { TEST_WORLD } from '../src/data/worlds/test';
import { verifyDeterminism } from '../src/game/replay';
import { cupTrack } from '../src/game/cup';
import { goalCups, goalPins } from '../src/game/goal';
import { Session } from '../src/game/session';
import { stagesOf } from '../src/level/chapters';
import { headingVector, tunnelEnds, tunnelRadius } from '../src/physics/zones/tunnel';
import { getTheme } from '../src/render/theme';
import { runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const stages = CHAPTERS.flatMap(stagesOf);
const holes = [...stages, TEST_WORLD].flatMap((world) => world.holes.map((hole) => ({ world, hole })));

describe('world data', () => {
  it('has three holes per world, one per finale, unique ids and registered themes', () => {
    const ids = holes.map((h) => h.hole.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const chapter of CHAPTERS) {
      for (const world of chapter.worlds) expect(world.holes).toHaveLength(3);
      expect(chapter.finale.holes).toHaveLength(1);
      for (const stage of stagesOf(chapter)) expect(() => getTheme(stage.theme)).not.toThrow();
    }
  });

  it('is the game the SPECs describe: 18 + 1 holes, then 12 + 1 four times over, 71 in all', () => {
    expect(CHAPTERS.map((chapter) => chapter.worlds.map((world) => world.id))).toEqual([
      ['ice', 'desert', 'sky', 'pirate', 'magnet', 'gravity'],
      ['forest', 'city', 'moving', 'bomb'],
      ['grow', 'freeze', 'clone', 'bowl'],
      ['tomb', 'cavern', 'jungle', 'hoard'],
      ['reef', 'polar', 'dam', 'canyon'],
    ]);
    const counts = CHAPTERS.map((chapter) => stagesOf(chapter).flatMap((stage) => stage.holes).length);
    expect(counts).toEqual([19, 13, 13, 13, 13]);
    expect(holes.length - TEST_WORLD.holes.length).toBe(71);
  });

  it.each(holes)('$hole.id is well formed', ({ hole }) => {
    const session = new Session(hole);
    const { ground } = session.compiled;
    // Every hole can be finished: it has a cup or pins.
    const cups = goalCups(hole.goal);
    const pins = goalPins(hole.goal);
    expect(cups.length + pins.length).toBeGreaterThan(0);
    // A cup is on the ground, and stays on it wherever its track takes it.
    for (const cup of cups) {
      for (const point of cupTrack(cup)) {
        expect(point.y).toBe(cup.position[1]);
        expect(ground!.surfaceAt(point)).not.toBeNull();
      }
    }
    // Pins stand on the ground too, and there are never more than 15 (SPEC v3 2.5).
    expect(pins.length).toBeLessThanOrEqual(15);
    for (const pin of pins) expect(ground!.surfaceAt({ x: pin.at[0], y: pin.at[1], z: pin.at[2] })).not.toBeNull();
    expect(hole.zones.some((zone) => zone.type === 'outOfBounds')).toBe(true);

    // A tunnel mouth must not point straight at its partner (SPEC v2 2.3): a ball coming
    // out of one would roll right back into the other.
    for (const zone of hole.zones.filter((z) => z.type === 'tunnelPair')) {
      const ends = tunnelEnds(zone);
      for (const [from, to] of [ends, [ends[1], ends[0]]]) {
        const out = headingVector(from.facing);
        const into = headingVector(to.facing);
        const dx = to.at[0] - from.at[0];
        const dz = to.at[2] - from.at[2];
        const along = dx * out.x + dz * out.z;
        const aside = Math.abs(dx * out.z - dz * out.x);
        const aimedAt = along > 0 && aside < tunnelRadius(zone) + 0.5 && out.x * into.x + out.z * into.z < 0;
        expect(aimedAt).toBe(false);
      }
    }

    // The ball rests on the tee: it is on ground and does not drift or fall.
    const start = { ...session.ball.position() };
    stepTicks(session, 120);
    const p = session.ball.position();
    expect(Math.hypot(p.x - start.x, p.y - start.y, p.z - start.z)).toBeLessThan(0.01);
    expect(ground!.surfaceAt({ x: p.x, y: p.y - session.ball.props.radius, z: p.z })).not.toBeNull();
    expect(session.strokes).toBe(0);
    session.dispose();
  });
});

describe('replay', () => {
  it('reproduces a recorded round exactly, through the same API the dev panel uses', () => {
    const hole = CHAPTERS[0].worlds[0].holes[1];
    const session = new Session(hole);
    stepTicks(session, 20);
    session.shoot({ x: 0.05, y: 0, z: -1 }, 0.62);
    runUntilSettled(session);
    stepTicks(session, 45);
    session.shoot({ x: 1, y: 0, z: -0.2 }, 0.3);
    runUntilSettled(session);
    const p = session.ball.position();

    const { identical, outcome } = verifyDeterminism(hole, session.shots, 10);
    expect(identical).toBe(true);
    expect(outcome.strokes).toBe(session.strokes);
    expect(outcome.phase).toBe(session.phase);
    expect(outcome.position).toStrictEqual([p.x, p.y, p.z]);
    session.dispose();
  });
});
