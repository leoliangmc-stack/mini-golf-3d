import { FIXED_DT } from '../../core/loop';
import { hypot } from '../../core/math';
import { numberParam, type ZoneFactory } from './index';

/**
 * A fixed magnet acting on the (iron) ball. The zone's sphere is its reach.
 *
 * Params: strength, the pull in m/s^2 at one metre (negative repels);
 *         maxAccel, the cap close to the core (optional).
 *
 * The pull follows an inverse-square law, is capped near the core so the ball cannot be
 * pinned there, and fades to nothing at the edge of the reach so entering and leaving
 * the field is smooth. It acts along the ground only: magnets never lift the ball.
 */
export const magnet: ZoneFactory = (def) => {
  if (def.shape.kind !== 'sphere') throw new Error('A magnet zone needs a sphere shape');
  const [cx, , cz] = def.shape.center;
  const reach = def.shape.radius;
  const strength = numberParam(def, 'strength');
  const maxAccel = numberParam(def, 'maxAccel', 9);

  return {
    preStep({ ball }) {
      if (!ball.body.isEnabled()) return;
      const p = ball.position();
      const dx = cx - p.x;
      const dz = cz - p.z;
      const distance = hypot(dx, dz);
      if (distance >= reach || distance < 1e-4) return;
      const fade = 1 - (distance / reach) * (distance / reach);
      const accel = Math.sign(strength) * Math.min(maxAccel, Math.abs(strength) / (distance * distance)) * fade;
      const v = ball.velocity();
      const dv = (accel * FIXED_DT) / distance;
      ball.body.setLinvel({ x: v.x + dx * dv, y: v.y, z: v.z + dz * dv }, true);
    },
  };
};
