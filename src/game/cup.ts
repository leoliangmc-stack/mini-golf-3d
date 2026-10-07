import { FIXED_DT } from '../core/loop';
import type { XYZ } from '../core/types';
import { xyz } from '../core/types';
import type { CupDef } from '../level/schema';
import { cyclePhase, motionPose } from '../physics/movers';

/** Where the cup is and whether it can take a ball, at the last two physics steps. */
export interface CupPose {
  prevPosition: XYZ;
  position: XYZ;
  open: boolean;
}

/** True when the cup changes from tick to tick: it travels, or its lid opens and shuts. */
export const cupIsLive = (cup: CupDef): boolean => cup.motion !== undefined || cup.hidden !== undefined;

/** Centre of the cup at a given tick. Like a moving part, a pure function of the tick. */
export function cupPositionAt(cup: CupDef, tick: number): XYZ {
  return cup.motion ? motionPose(cup.position, 0, cup.motion, tick).position : xyz(cup.position);
}

/** Whether the lid is open at a given tick. A cup without a lid is always open. */
export function cupOpenAt(cup: CupDef, tick: number): boolean {
  const lid = cup.hidden;
  return !lid || cyclePhase(tick, lid.period, lid.phase) < lid.openRatio;
}

/** Seconds the lid takes to slide open or shut. Drawing only: the rule switches at once. */
const LID_SLIDE = 0.18;

/**
 * How far open the lid looks at a given tick, 0 shut to 1 open. It finishes opening
 * just after the cup starts taking balls and starts closing just before it stops.
 */
export function cupLidOpenness(cup: CupDef, tick: number): number {
  const lid = cup.hidden;
  if (!lid) return 1;
  const u = cyclePhase(tick, lid.period, lid.phase);
  if (u >= lid.openRatio) return 0;
  const edge = LID_SLIDE / lid.period;
  return Math.min(1, u / edge, (lid.openRatio - u) / edge);
}

/** Points along the path the cup travels in one full cycle; a single point if it stays put. */
export function cupTrack(cup: CupDef, samples = 96): XYZ[] {
  if (!cup.motion) return [xyz(cup.position)];
  const ticks = Math.max(2, Math.round(cup.motion.period / FIXED_DT));
  const points: XYZ[] = [];
  for (let i = 0; i <= samples; i++) points.push(cupPositionAt(cup, Math.round((i / samples) * ticks)));
  return points;
}

/** Middle of the cup's path: a point that stays put, for the camera to frame. */
export function cupAnchor(cup: CupDef): XYZ {
  const track = cupTrack(cup);
  const xs = track.map((p) => p.x);
  const zs = track.map((p) => p.z);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: cup.position[1],
    z: (Math.min(...zs) + Math.max(...zs)) / 2,
  };
}
