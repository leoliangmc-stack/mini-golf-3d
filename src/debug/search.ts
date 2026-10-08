import { Session, type InputRecord } from '../game/session';
import type { HoleDef } from '../level/schema';

/**
 * Looks for a stroke that does a given thing: the tool the reference solutions in
 * `replays/` are found with. Development only; nothing the shipped game runs imports it.
 *
 * A round is its inputs (SPEC v3 2.9), so a stroke is tried by playing the round so far
 * and then the stroke, from scratch, every time. That is slow per try and exact.
 */
export interface StrokeSearch {
  /** The point on the ground to aim at, [x, z]. Strokes are tried to either side of it. */
  toward: readonly [number, number];
  /** How far to either side, in degrees. Defaults to 6. */
  spread?: number;
  /** Directions tried. Defaults to 25. */
  aims?: number;
  /** Lowest and highest power tried, 0..1. */
  power: readonly [number, number];
  /** Powers tried. Defaults to 25. */
  powers?: number;
  /** Ticks to wait after the round so far has come to rest, each tried in turn. Defaults to [30]. */
  wait?: readonly number[];
  /**
   * Judges how the stroke ended: a number, higher being better, or null if it did not
   * do what was wanted. Called with the round at the moment the stroke is over.
   */
  score(session: Session): number | null;
}

export interface StrokeFound {
  input: InputRecord;
  score: number;
  /** Share of the strokes tried that did what was wanted: how forgiving the stroke is. */
  passRate: number;
  tried: number;
}

/** Plays inputs until the last of them is over. Returns the session, still open. */
export function playTo(hole: HoleDef, inputs: readonly InputRecord[], maxTicks = 12000): Session {
  const session = new Session(hole);
  session.replay(inputs);
  let ticks = 0;
  while ((session.replaying || session.phase === 'rolling') && ticks++ < maxTicks) session.step();
  return session;
}

/** Tries strokes after `prefix` and returns the best of those that did what was wanted, or null. */
export function searchStroke(hole: HoleDef, prefix: readonly InputRecord[], search: StrokeSearch): StrokeFound | null {
  const base = playTo(hole, prefix);
  if (base.phase !== 'aiming') {
    base.dispose();
    throw new Error(`After ${prefix.length} inputs the round is "${base.phase}", not waiting for a stroke`);
  }
  const from = { ...base.ball.position() };
  const tick = base.world.tick;
  base.dispose();

  const aims = search.aims ?? 25;
  const powers = search.powers ?? 25;
  const spread = ((search.spread ?? 6) * Math.PI) / 180;
  const heading = Math.atan2(search.toward[0] - from.x, search.toward[1] - from.z);
  let best: StrokeFound | null = null;
  let tried = 0;
  let passed = 0;
  for (const wait of search.wait ?? [30]) {
    for (let a = 0; a < aims; a++) {
      const angle = heading + (aims === 1 ? 0 : (a / (aims - 1)) * 2 * spread - spread);
      for (let p = 0; p < powers; p++) {
        const power = search.power[0] + (powers === 1 ? 0 : (p / (powers - 1)) * (search.power[1] - search.power[0]));
        const input: InputRecord = {
          type: 'shot',
          tick: tick + wait,
          dir: [Math.sin(angle), 0, Math.cos(angle)],
          power,
        };
        const session = playTo(hole, [...prefix, input]);
        const score = session.phase === 'rolling' ? null : search.score(session);
        session.dispose();
        tried++;
        if (score === null) continue;
        passed++;
        if (!best || score > best.score) best = { input, score, passRate: 0, tried: 0 };
      }
    }
  }
  if (best) {
    best.passRate = passed / tried;
    best.tried = tried;
  }
  return best;
}
