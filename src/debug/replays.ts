import { CHAPTERS } from '../data/chapters';
import { checkReplay, recordReplay, type ReplayCheck, type ReplayFile, type ReplayInput } from '../game/replay';
import { allHoles } from '../level/chapters';
import type { HoleDef } from '../level/schema';

/**
 * Every reference solution in `replays/`, by hole id. Development and CI only: nothing
 * the shipped game runs imports this module, so the files stay out of the bundle.
 */
export const REPLAYS: Record<string, ReplayFile> = Object.fromEntries(
  Object.values(
    import.meta.glob<ReplayFile>('../../replays/*.json', { eager: true, import: 'default' }),
  ).map((file) => [file.hole, file]),
);

export interface ReplayReport {
  checks: ReplayCheck[];
  /** Holes of the game that have no replay file. */
  missing: string[];
  /** Replay files for holes the game does not have. */
  orphans: string[];
  ok: boolean;
}

const findHole = (id: string): HoleDef | undefined => allHoles(CHAPTERS).find((hole) => hole.id === id);

/**
 * Replays the reference solution of every hole in the game (SPEC v3 2.9). The same
 * function runs in Node (`npm run replay`), in the tests and in the browser's dev panel,
 * so a difference between them is a difference in the engine underneath.
 */
export function checkAllReplays(only?: readonly string[]): ReplayReport {
  const holes = allHoles(CHAPTERS).filter((hole) => !only?.length || only.includes(hole.id));
  const checks: ReplayCheck[] = [];
  const missing: string[] = [];
  for (const hole of holes) {
    const file = REPLAYS[hole.id];
    if (file) checks.push(checkReplay(hole, file));
    else missing.push(hole.id);
  }
  const orphans = only?.length ? [] : Object.keys(REPLAYS).filter((id) => !findHole(id));
  const ok = missing.length === 0 && orphans.length === 0 && checks.every((check) => check.ok);
  return { checks, missing, orphans, ok };
}

/** Records a reference solution from inputs. Null for an unknown hole or a round that does not end. */
export function recordHoleReplay(holeId: string, inputs: readonly ReplayInput[]): ReplayFile | null {
  const hole = findHole(holeId);
  return hole ? recordReplay(hole, inputs) : null;
}
