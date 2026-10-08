import { hypot } from '../../core/math';
import { xyz } from '../../core/types';
import { numberParam, perBall, vectorParam, type ZoneFactory } from './index';
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
  const length = hypot(dx, dy, dz);
  const speed = numberParam(def, 'speed');
  const delay = numberParam(def, 'delay', 40);
  const velocity = { x: (dx / length) * speed, y: (dy / length) * speed, z: (dz / length) * speed };
  const hold = xyz(def.shape.center);
  const timers = perBall(() => ({ countdown: -1, cooldown: 0 }));

  return {
    preStep(ctx) {
      const { ball } = ctx;
      const timer = timers(ball);
      if (timer.countdown >= 0) {
        ctx.busy();
        if (timer.countdown-- > 0) return;
        ball.body.setEnabled(true);
        ball.body.setTranslation(exit, true);
        ball.body.setLinvel(velocity, true);
        timer.cooldown = COOLDOWN;
        ctx.emit({ type: 'cue', name: 'launcherFire' });
        return;
      }
      if (timer.cooldown > 0) {
        timer.cooldown--;
        return;
      }
      if (!shapeContains(def.shape, ball.position())) return;
      // Swallowed: the ball waits inside the barrel, out of the simulation.
      ball.teleport(hold);
      ball.body.setEnabled(false);
      timer.countdown = delay;
      ctx.busy();
      ctx.emit({ type: 'cue', name: 'launcherLoad' });
    },
  };
};
