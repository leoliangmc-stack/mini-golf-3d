import { beforeAll, describe, expect, it } from 'vitest';
import { Session } from '../src/game/session';
import type { PieceDef } from '../src/level/schema';
import { DEFAULT_BALL } from '../src/physics/ball';
import { boxHole, setupEngine } from './helpers';

beforeAll(setupEngine);

describe('floor seams', () => {
  it('rolls dead straight across a floor made of many pieces', () => {
    // 6 strips along z, each split in two along x: seams in both directions.
    const floors: PieceDef[] = [];
    for (let z = -3; z < 3; z++) {
      floors.push({ type: 'floor', min: [-3, z], max: [0.5, z + 1], surface: 'grass' });
      floors.push({ type: 'floor', min: [0.5, z], max: [3, z + 1], surface: 'grass' });
    }
    const session = new Session(boxHole({ tee: [-1, 0, 2.5] }, floors));
    const angle = 0.35;
    session.shoot({ x: Math.sin(angle), y: 0, z: -Math.cos(angle) }, 0.6);
    let ticks = 0;
    // Stop measuring before the ball reaches the far rail.
    while (session.ball.position().z > -2.6 && ticks++ < 200) {
      session.step();
      const p = session.ball.position();
      const v = session.ball.velocity();
      expect(Math.abs(p.y - DEFAULT_BALL.radius)).toBeLessThan(0.01);
      expect(Math.abs(Math.atan2(v.x, -v.z) - angle)).toBeLessThan(1e-4);
    }
    expect(session.ball.position().z).toBeLessThan(-2.6);
    session.dispose();
  });

  it('rejects floor pieces that are off the grid', () => {
    const floors: PieceDef[] = [{ type: 'floor', min: [-3, -3], max: [3.2, 3], surface: 'grass' }];
    expect(() => new Session(boxHole({}, floors))).toThrow(/multiples of 0.5/);
  });
});
