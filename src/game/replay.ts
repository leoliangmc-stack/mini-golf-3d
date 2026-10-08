import { hypot } from '../core/math';
import type { HoleDef } from '../level/schema';
import { Session, type InputRecord, type ShotRecord } from './session';

export interface ReplayOutcome {
  phase: string;
  holed: boolean;
  strokes: number;
  tick: number;
  position: [number, number, number];
}

/** Plays a recorded round to its end without rendering and reports where it finished. */
export function runReplay(
  hole: HoleDef,
  shots: readonly (InputRecord | ShotRecord)[],
  maxTicks = 20000,
): ReplayOutcome {
  const session = new Session(hole);
  session.replay(shots);
  let ticks = 0;
  while ((session.replaying || session.phase === 'rolling') && ticks++ < maxTicks) session.step();
  const p = session.ball.position();
  const outcome: ReplayOutcome = {
    phase: session.phase,
    holed: session.outcome?.holed ?? false,
    strokes: session.strokes,
    tick: session.world.tick,
    position: [p.x, p.y, p.z],
  };
  session.dispose();
  return outcome;
}

/** Replays a round `runs` times and reports whether every run ended in exactly the same state. */
export function verifyDeterminism(
  hole: HoleDef,
  shots: readonly (InputRecord | ShotRecord)[],
  runs = 10,
): { identical: boolean; outcome: ReplayOutcome } {
  const first = runReplay(hole, shots);
  const key = JSON.stringify(first);
  let identical = true;
  for (let i = 1; i < runs; i++) {
    if (JSON.stringify(runReplay(hole, shots)) !== key) identical = false;
  }
  return { identical, outcome: first };
}

/** One thing the player did, and the physics tick it was done on. */
export type ReplayInput = InputRecord;

/** How a recorded round ended. */
export interface ReplayResult {
  holed: boolean;
  strokes: number;
  stars: 1 | 2 | 3;
  /** Physics tick on which the hole ended. */
  tick: number;
  /** Where the ball was when the hole ended. */
  position: [number, number, number];
}

/**
 * A hole's reference solution (SPEC v3 2.9): the inputs of one round that finishes it,
 * and how that round ended when it was recorded. One file per hole, in `replays/`.
 */
export interface ReplayFile {
  hole: string;
  inputs: ReplayInput[];
  expect: ReplayResult;
}

/** How far the final position may be from the recorded one, in metres, and still pass. */
export const POSITION_TOLERANCE = 1e-3;
/** Ticks a round is given after its last input before it is called unfinished. */
const SETTLE_TICKS = 3000;

/** Plays recorded inputs to the end of the hole. Returns null if the hole never ended. */
export function playReplay(hole: HoleDef, inputs: readonly ReplayInput[]): ReplayResult | null {
  const session = new Session(hole);
  session.replay(inputs);
  const giveUpAt = Math.max(0, ...inputs.map((input) => input.tick)) + SETTLE_TICKS;
  while (session.playing && session.world.tick < giveUpAt) session.step();
  const { outcome } = session;
  const p = session.ball.position();
  const result: ReplayResult | null = outcome && {
    holed: outcome.holed,
    strokes: outcome.strokes,
    stars: outcome.stars,
    tick: session.world.tick,
    position: [p.x, p.y, p.z],
  };
  session.dispose();
  return result;
}

export interface ReplayCheck {
  hole: string;
  /** The round still ends the way it was recorded, within tolerance. */
  ok: boolean;
  /** The round ended in exactly the recorded state, to the last bit. */
  exact: boolean;
  /** What differs from the recording; empty when `ok`. */
  problems: string[];
  actual: ReplayResult | null;
}

/** Replays a hole's reference solution and compares the ending with the recorded one. */
export function checkReplay(hole: HoleDef, file: ReplayFile): ReplayCheck {
  const actual = playReplay(hole, file.inputs);
  const want = file.expect;
  const problems: string[] = [];
  if (!actual) {
    problems.push('the hole did not end');
  } else {
    if (actual.holed !== want.holed) problems.push(`holed ${actual.holed}, recorded ${want.holed}`);
    if (actual.strokes !== want.strokes) problems.push(`${actual.strokes} strokes, recorded ${want.strokes}`);
    if (actual.stars !== want.stars) problems.push(`${actual.stars} stars, recorded ${want.stars}`);
    if (actual.tick !== want.tick) problems.push(`ended on tick ${actual.tick}, recorded ${want.tick}`);
    const off = hypot(
      actual.position[0] - want.position[0],
      actual.position[1] - want.position[1],
      actual.position[2] - want.position[2],
    );
    if (!(off <= POSITION_TOLERANCE)) problems.push(`ended ${off.toFixed(4)} m from the recorded position`);
  }
  const exact = actual !== null && JSON.stringify(actual) === JSON.stringify(want);
  return { hole: hole.id, ok: problems.length === 0, exact, problems, actual };
}

/** Plays inputs and packs them with their result into a replay file. Null if they do not finish the hole. */
export function recordReplay(hole: HoleDef, inputs: readonly ReplayInput[]): ReplayFile | null {
  const expect = playReplay(hole, inputs);
  return expect && { hole: hole.id, inputs: inputs.map((input) => ({ ...input })), expect };
}
