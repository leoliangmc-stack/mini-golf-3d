import { beforeAll, describe, expect, it } from 'vitest';
import { RULES } from '../src/game/rules';
import { Session } from '../src/game/session';
import { DEFAULT_BALL } from '../src/physics/ball';
import { boxHole, setupEngine } from './helpers';

beforeAll(setupEngine);

describe('tunneling (SPEC 5.2 #4)', () => {
  it('keeps a full-power ball inside the rails from every direction', () => {
    const r = DEFAULT_BALL.radius;
    // A full-power ball travels further per tick than a rail is thick.
    expect(RULES.maxShotSpeed / 60).toBeGreaterThan(0.2);
    for (let deg = 0; deg < 360; deg += 5) {
      const a = (deg * Math.PI) / 180;
      const session = new Session(boxHole());
      session.shoot({ x: Math.sin(a), y: 0, z: -Math.cos(a) }, 1);
      for (let i = 0; i < 240; i++) {
        session.step();
        const p = session.ball.position();
        const inside = Math.abs(p.x) < 3 && Math.abs(p.z) < 3 && Math.abs(p.y - r) < 0.05;
        if (!inside) throw new Error(`escaped at ${deg} deg, tick ${i}: ${p.x}, ${p.y}, ${p.z}`);
      }
      expect(session.strokes).toBe(1);
      session.dispose();
    }
  });
});
