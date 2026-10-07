import type { HoleDef } from '../level/schema';
import { Session, type ShotRecord } from './session';

export interface ReplayOutcome {
  phase: string;
  holed: boolean;
  strokes: number;
  tick: number;
  position: [number, number, number];
}

/** Plays a recorded round to its end without rendering and reports where it finished. */
export function runReplay(hole: HoleDef, shots: readonly ShotRecord[], maxTicks = 20000): ReplayOutcome {
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
  shots: readonly ShotRecord[],
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
