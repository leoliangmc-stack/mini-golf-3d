import { FIXED_DT } from '../core/loop';
import type { Vec3, XYZ } from '../core/types';
import { RAPIER } from './rapier';

/**
 * Thin wrapper around a Rapier world. Owns the two things the rest of the engine
 * must never assume: which way is down, and what time it is.
 */
export class PhysicsWorld {
  readonly raw: RAPIER.World;
  /** Collisions that began or ended during the last step. Drain it after every step. */
  readonly events: RAPIER.EventQueue;
  /** Number of physics steps taken. The only clock gameplay code may read. */
  tick = 0;
  private upDir: XYZ = { x: 0, y: 1, z: 0 };

  constructor(gravity: Vec3) {
    this.raw = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.raw.timestep = FIXED_DT;
    this.events = new RAPIER.EventQueue(true);
    this.setGravity(gravity);
  }

  get gravity(): XYZ {
    return this.raw.gravity;
  }

  /** Unit vector opposite to gravity. Zones may change it at any time. */
  get up(): XYZ {
    return this.upDir;
  }

  setGravity(g: Vec3): void {
    this.raw.gravity = { x: g[0], y: g[1], z: g[2] };
    const len = Math.hypot(g[0], g[1], g[2]);
    // `|| 0` turns the -0 of a zero component into plain 0.
    if (len > 1e-9) this.upDir = { x: -g[0] / len || 0, y: -g[1] / len || 0, z: -g[2] / len || 0 };
  }

  step(): void {
    this.raw.step(this.events);
    this.tick++;
  }

  free(): void {
    this.events.free();
    this.raw.free();
  }
}
