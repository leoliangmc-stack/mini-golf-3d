import type { XYZ } from '../core/types';
import type { ChallengeDef } from '../level/schema';
import { shapeContains } from '../physics/zones/shape';

/** What happened during a round, as far as challenges are concerned. */
export interface RoundStats {
  strokes: number;
  wallHits: number;
  /** Times the ball touched a moving part. */
  moverHits: number;
  outOfBounds: number;
  /** Ids of every surface the ball rolled on. */
  surfaces: Set<string>;
  /** Where the ball was at the end of each stroke, in order. */
  rests: XYZ[];
  /**
   * How many times each named moment happened: tunnels taken, clocks picked up, and the
   * round's own (`holed`, `pinDown`, `grow`, `shrink`, `split`, `freeze`, `airShot`).
   */
  cues: Record<string, number>;
  /** Seconds left on the hole's countdown when it ended, or null if it has none. */
  timeLeft: number | null;
}

export const emptyStats = (): RoundStats => ({
  strokes: 0,
  wallHits: 0,
  moverHits: 0,
  outOfBounds: 0,
  surfaces: new Set(),
  rests: [],
  cues: {},
  timeLeft: null,
});

export type ChallengeCheck = (stats: RoundStats, def: ChallengeDef) => boolean;

const registry = new Map<string, ChallengeCheck>();

export function registerChallenge(type: string, check: ChallengeCheck): void {
  registry.set(type, check);
}

/** Whether the round met the hole's challenge. A hole without one is always met. */
export function challengeMet(def: ChallengeDef | undefined, stats: RoundStats): boolean {
  if (!def) return true;
  const check = registry.get(def.type);
  if (!check) throw new Error(`Unknown challenge type "${def.type}"`);
  return check(stats, def);
}

const need = <T>(value: T | undefined, def: ChallengeDef, field: string): T => {
  if (value === undefined) throw new Error(`Challenge "${def.type}" needs "${field}"`);
  return value;
};

export function registerBuiltinChallenges(): void {
  /** Never touch a wall, rail or pillar. */
  registerChallenge('noWallHits', (stats) => stats.wallHits === 0);
  /** Never touch a moving part. */
  registerChallenge('noMoverHits', (stats) => stats.moverHits === 0);
  /** Never go out of bounds. */
  registerChallenge('noOutOfBounds', (stats) => stats.outOfBounds === 0);
  /** Never roll on `surface`. */
  registerChallenge('avoidSurface', (stats, def) => !stats.surfaces.has(need(def.surface, def, 'surface')));
  /** Finish in at most `strokes`. */
  registerChallenge('maxStrokes', (stats, def) => stats.strokes <= need(def.strokes, def, 'strokes'));
  /** The first stroke must end inside `shape`, e.g. across a bridge. */
  registerChallenge('firstStrokeInto', (stats, def) => {
    const rest = stats.rests[0];
    return rest !== undefined && shapeContains(need(def.shape, def, 'shape'), rest);
  });
  /** The zone cue `cue` fired at most `count` times, e.g. no clock was picked up. */
  registerChallenge(
    'maxCues',
    (stats, def) => (stats.cues[need(def.cue, def, 'cue')] ?? 0) <= need(def.count, def, 'count'),
  );
  /** The cue `cue` fired at least `count` times, e.g. two balls were holed. */
  registerChallenge(
    'minCues',
    (stats, def) => (stats.cues[need(def.cue, def, 'cue')] ?? 0) >= need(def.count, def, 'count'),
  );
  /** At least `seconds` were left on the countdown at the end. */
  registerChallenge(
    'timeLeft',
    (stats, def) => stats.timeLeft !== null && stats.timeLeft >= need(def.seconds, def, 'seconds'),
  );
}
