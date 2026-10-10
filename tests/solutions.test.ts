import { beforeAll, describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/chapters';
import { checkAllReplays, REPLAYS } from '../src/debug/replays';
import { checkReplay, playReplay } from '../src/game/replay';
import { allHoles } from '../src/level/chapters';
import { setupEngine } from './helpers';

beforeAll(setupEngine);

/**
 * One reference solution per hole, in replays/<holeId>.json (SPEC v3 2.9): the inputs of
 * a round that finishes the hole and how that round ended. `npm run replay` plays them
 * all back and prints a report; this is the same check, as tests.
 *
 * A round is only reproducible while the physics numbers stay as they are. After
 * retuning a surface, the shot speed or a hole, some of these will stop working: play
 * the hole in the dev build and press SAVE REPLAY in the dev panel, or, if the same
 * inputs still finish it, run `npm run replay -- --update <holeId>`.
 */
const holes = allHoles(CHAPTERS);

describe('reference solutions (SPEC v3 2.9)', () => {
  // Plays every hole in one go: a second here, five on the CI runner's two cores.
  it('has exactly one for every hole of the game', () => {
    const report = checkAllReplays();
    expect(report.missing).toEqual([]);
    expect(report.orphans).toEqual([]);
    expect(Object.keys(REPLAYS).sort()).toEqual(holes.map((hole) => hole.id).sort());
  }, 60_000);

  it.each(holes)('$id still ends exactly as recorded', (hole) => {
    const check = checkReplay(hole, REPLAYS[hole.id]);
    expect(check.problems).toEqual([]);
    expect(check.exact).toBe(true);
  });

  // Evidence that every hole can be finished within par and that every 3-star
  // challenge can be met (SPEC 5.2, SPEC v2 5.2 #8).
  it.each(holes)('$id is holed within par, with its third star', (hole) => {
    const { expect: recorded } = REPLAYS[hole.id];
    expect(recorded).toMatchObject({ holed: true, stars: 3 });
    expect(recorded.strokes).toBeLessThanOrEqual(hole.par);
  });

  it.each(holes)('$id plays the same round the same way twice', (hole) => {
    const { inputs } = REPLAYS[hole.id];
    expect(playReplay(hole, inputs)).toStrictEqual(playReplay(hole, inputs));
  });
});
