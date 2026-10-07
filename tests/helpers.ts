import { registerContent } from '../src/data';
import type { Session } from '../src/game/session';
import type { HoleDef, PieceDef } from '../src/level/schema';
import { initPhysics } from '../src/physics/rapier';

export async function setupEngine(): Promise<void> {
  await initPhysics();
  registerContent();
}

/** Steps until the ball is no longer rolling. Returns the number of ticks taken. */
export function runUntilSettled(session: Session, maxTicks = 3000): number {
  let ticks = 0;
  while (session.phase === 'rolling' && ticks < maxTicks) {
    session.step();
    ticks++;
  }
  return ticks;
}

export function stepTicks(session: Session, ticks: number): void {
  for (let i = 0; i < ticks; i++) session.step();
}

/** Rectangular hole fully enclosed by rails. */
export function boxHole(overrides: Partial<HoleDef> = {}, floors?: PieceDef[]): HoleDef {
  return {
    id: 'box',
    par: 2,
    tee: [0, 0, 0],
    cup: { position: [100, 0, 100], radius: 0.22, captureSpeed: 3.5 },
    pieces: [
      ...(floors ?? [{ type: 'floor', min: [-3, -3], max: [3, 3], surface: 'grass' } as const]),
      { type: 'wall', from: [-3, -3], to: [3, -3], surface: 'rail' },
      { type: 'wall', from: [3, -3], to: [3, 3], surface: 'rail' },
      { type: 'wall', from: [3, 3], to: [-3, 3], surface: 'rail' },
      { type: 'wall', from: [-3, 3], to: [-3, -3], surface: 'rail' },
    ],
    zones: [{ type: 'outOfBounds', shape: { kind: 'box', center: [0, -7, 0], halfExtents: [60, 5, 60] } }],
    outOfBounds: 'lastPosition',
    ...overrides,
  };
}
