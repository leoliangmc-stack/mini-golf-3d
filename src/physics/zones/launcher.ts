import { xyz } from '../../core/types';
import { numberParam, vectorParam, type ZoneFactory } from './index';
import { shapeContains } from './shape';

/** Ticks after firing during which the launcher ignores the ball, so it cannot re-catch its own shot. */
const COOLDOWN = 30;

/**
 * A cannon: a ball that enters the zone is swallowed, held for `delay` ticks, then
 * fired from `exit` along `direction` at `speed`. It never aims at the ball.
 *
 * Params: exit (point), direction (vector), speed (m/s), delay (ticks, optional).
 */
export const launcher: ZoneFactory = (def) => {
  const exit = xyz(vectorParam(def, 'exit'));
  const [dx, dy, dz] = vectorParam(def, 'direction');
  const length = Math.hypot(dx, dy, dz);
  const speed = numberParam(def, 'speed');
  const delay = numberParam(def, 'delay', 40);
  const velocity = { x: (dx / length) * speed, y: (dy / length) * speed, z: (dz / length) * speed };
  const hold = xyz(def.shape.center);
  let countdown = -1;
  let cooldown = 0;

  return {
    preStep(ctx) {
      const { ball } = ctx;
      if (countdown >= 0) {
        ctx.busy();
        if (countdown-- > 0) return;
        ball.body.setEnabled(true);
        ball.body.setTranslation(exit, true);
        ball.body.setLinvel(velocity, true);
        cooldown = COOLDOWN;
        ctx.emit({ type: 'cue', name: 'launcherFire' });
        return;
      }
      if (cooldown > 0) {
        cooldown--;
        return;
      }
      if (!shapeContains(def.shape, ball.position())) return;
      // Swallowed: the ball waits inside the barrel, out of the simulation.
      ball.teleport(hold);
      ball.body.setEnabled(false);
      countdown = delay;
      ctx.busy();
      ctx.emit({ type: 'cue', name: 'launcherLoad' });
    },
  };
};
