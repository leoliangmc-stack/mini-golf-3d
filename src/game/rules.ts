import type { XYZ } from '../core/types';
import type { CupDef } from '../level/schema';

/**
 * Rule and feel constants. Durations are in physics ticks (60 per second).
 * Mutable so the dev panel can tune them live; game code only reads them.
 */
export const RULES = {
  /** Magnitude of gravity, in m/s^2. */
  gravity: 9.81,
  /** Launch speed of a full-power shot, in m/s. */
  maxShotSpeed: 18,
  /** Shots weaker than this fraction of full power are treated as a cancelled aim. */
  minPower: 0.06,
  /** The ball counts as stopped after staying below this speed for `stopTicks`. */
  stopSpeed: 0.06,
  stopTicks: 30,
  /** Failsafe: a ball jittering below this speed for `jitterTicks` is forced to stop. */
  jitterSpeed: 0.6,
  jitterTicks: 300,
};

export class StopDetector {
  private slow = 0;
  private jitter = 0;

  reset(): void {
    this.slow = 0;
    this.jitter = 0;
  }

  /** Feed the ball speed once per tick. Returns true on the tick the ball counts as stopped. */
  update(speed: number): boolean {
    this.slow = speed < RULES.stopSpeed ? this.slow + 1 : 0;
    this.jitter = speed < RULES.jitterSpeed ? this.jitter + 1 : 0;
    return this.slow >= RULES.stopTicks || this.jitter >= RULES.jitterTicks;
  }
}

/**
 * True when a ball at `position` drops into the cup, which is at `at` right now.
 * `speed` is the ball's speed measured against the cup, not against the world: a cup
 * coming the other way makes a slow ball fast. Cups sit on level ground.
 */
export function cupCaptures(cup: CupDef, at: XYZ, position: XYZ, speed: number, ballRadius: number): boolean {
  if (speed > cup.captureSpeed) return false;
  const dx = position.x - at.x;
  const dy = position.y - at.y;
  const dz = position.z - at.z;
  // The ball must be on the ground at the cup, not flying over it.
  if (Math.abs(dy - ballRadius) > ballRadius) return false;
  return Math.hypot(dx, dz) <= cup.radius;
}

/** Stars for a finished hole (SPEC 2.6): finish, par, par plus the hole's challenge. */
export function starsFor(holed: boolean, strokes: number, par: number, challengeMet: boolean): 1 | 2 | 3 {
  if (!holed || strokes > par) return 1;
  return challengeMet ? 3 : 2;
}
