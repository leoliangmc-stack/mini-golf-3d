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
}

export const emptyStats = (): RoundStats => ({
  strokes: 0,
  wallHits: 0,
  moverHits: 0,
  outOfBounds: 0,
  surfaces: new Set(),
  rests: [],
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
}
