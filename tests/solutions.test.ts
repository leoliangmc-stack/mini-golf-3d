import { beforeAll, describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/chapters';
import { Session, type ShotRecord } from '../src/game/session';
import { stagesOf } from '../src/level/chapters';
import type { HoleDef } from '../src/level/schema';
import { setupEngine } from './helpers';

beforeAll(setupEngine);

/**
 * One recorded round for every hole added in v2: the Chapter 1 finale and all of
 * Chapter 2. Each is within par and earns the third star, which is the evidence for
 * SPEC v2 5.2 #8 and for "every 3-star challenge can be met".
 *
 * A round is only reproducible while the physics numbers stay as they are. After
 * retuning a surface, the shot speed or a hole, some of these will stop working: play
 * the hole in the dev build, press COPY STROKES in the dev panel, and paste the result.
 */
const SOLUTIONS: Record<string, ShotRecord[]> = {
  'ch1-finale': [
    { tick: 60, dir: [-0.008726535498373935, 0, -0.9999619230641713], power: 1 },
    { tick: 431, dir: [0.39927019785174844, 0, 0.9168333049728428], power: 0.9 },
    { tick: 758, dir: [-0.7789498398597375, 0, -0.627086235682533], power: 1 },
    { tick: 1030, dir: [0.011182282455801685, 0, -0.9999374763249343], power: 0.14 },
  ],
  'ch2-finale': [
    { tick: 60, dir: [-0.05233595624294383, 0, -0.9986295347545738], power: 0.64 },
    { tick: 457, dir: [-0.2040418182101867, 0, -0.9789621731310567], power: 0.58 },
  ],
  'forest-1': [{ tick: 60, dir: [0, 0, -1], power: 0.78 }],
  'forest-2': [{ tick: 60, dir: [0.29366461712409037, 0, -0.9559085168829502], power: 0.78 }],
  'forest-3': [
    { tick: 60, dir: [-0.9338068285362079, 0, -0.35777759429448514], power: 0.4 },
    { tick: 367, dir: [1, 0, 0], power: 0.66 },
  ],
  'city-1': [{ tick: 60, dir: [0, 0, -1], power: 0.75 }],
  'city-2': [
    { tick: 60, dir: [-0.8829475928589271, 0, -0.4694715627858904], power: 0.4 },
    { tick: 397, dir: [0.2972969025317799, 0, -0.9547850814424204], power: 0.14 },
  ],
  'city-3': [
    { tick: 60, dir: [0.374606593415912, 0, -0.9271838545667874], power: 0.48 },
    { tick: 457, dir: [-0.7267146057986392, 0, 0.6869395036820406], power: 0.13 },
  ],
  'moving-1': [{ tick: 270, dir: [-0.17364817766693033, 0, -0.984807753012208], power: 0.56 }],
  'moving-2': [
    { tick: 30, dir: [0.0697564737441253, 0, -0.9975640502598242], power: 0.36 },
    { tick: 309, dir: [-0.7365083211643993, 0, -0.6764284831788192], power: 0.14 },
  ],
  'moving-3': [
    { tick: 30, dir: [0.03489949670250097, 0, -0.9993908270190958], power: 0.75 },
    { tick: 657, dir: [0.37690305642394406, 0, 0.9262527117683863], power: 0.32 },
  ],
  'bomb-1': [
    { tick: 60, dir: [-0.0697564737441253, 0, -0.9975640502598242], power: 0.85 },
    { tick: 482, dir: [0.9999168077331263, 0, -0.012898744620856745], power: 0.35 },
  ],
  'bomb-2': [
    { tick: 60, dir: [0.576662074295335, 0, -0.8169827734226723], power: 0.87 },
    { tick: 476, dir: [-0.5751798189355322, 0, 0.8180270019316529], power: 0.26 },
  ],
  'bomb-3': [
    { tick: 60, dir: [0.01745240643728351, 0, -0.9998476951563913], power: 1 },
    { tick: 478, dir: [0.2677028636827064, 0, 0.9635015188239603], power: 0.68 },
    { tick: 871, dir: [0.9924475615299234, 0, 0.122669627917056], power: 0.23 },
  ],
};

/** Plays a recorded round to its end. A ball lying on the track of a moving cup is given time to be collected. */
function play(hole: HoleDef, shots: readonly ShotRecord[]): Session {
  const session = new Session(hole);
  session.replay(shots);
  const giveUpAt = shots[shots.length - 1].tick + 3000;
  while (session.playing && session.world.tick < giveUpAt) session.step();
  return session;
}

const [chapter1, chapter2] = CHAPTERS;
const added = [chapter1.finale, ...stagesOf(chapter2)].flatMap((stage) => stage.holes);

describe('known solutions (SPEC v2 5.2 #1 and #8)', () => {
  it('covers every hole added in v2', () => {
    expect(Object.keys(SOLUTIONS).sort()).toEqual(added.map((hole) => hole.id).sort());
  });

  it.each(added)('$id can be holed within par, with its third star', (hole) => {
    const session = play(hole, SOLUTIONS[hole.id]);
    expect(session.phase).toBe('done');
    expect(session.outcome).toMatchObject({ holed: true, stars: 3, challengeMet: true });
    expect(session.outcome!.strokes).toBeLessThanOrEqual(hole.par);
    expect(session.stats.outOfBounds).toBe(0);
    session.dispose();
  });

  it.each(added)('$id plays the same round the same way twice', (hole) => {
    const first = play(hole, SOLUTIONS[hole.id]);
    const second = play(hole, SOLUTIONS[hole.id]);
    expect(second.world.tick).toBe(first.world.tick);
    expect(second.ball.position()).toEqual(first.ball.position());
    expect(second.outcome).toEqual(first.outcome);
    first.dispose();
    second.dispose();
  });
});
