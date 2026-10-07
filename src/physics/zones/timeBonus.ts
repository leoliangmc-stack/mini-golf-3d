import { FIXED_DT } from '../../core/loop';
import { numberParam, type ZoneFactory } from './index';
import { shapeContains } from './shape';

/**
 * A clock lying on the course: the first time the ball rolls through it, `seconds` are
 * added to the hole's countdown. It works once per attempt.
 *
 * Params: seconds.
 */
export const timeBonus: ZoneFactory = (def) => {
  const seconds = numberParam(def, 'seconds');
  let spent = false;
  return {
    get spent() {
      return spent;
    },
    preStep(ctx) {
      const { ball } = ctx;
      if (spent || !ball.body.isEnabled()) return;
      const p = ball.position();
      const v = ball.velocity();
      // Also looks half a step and a full step ahead: a fast ball must not skip over a small clock.
      const touched = [0, 0.5, 1].some((t) =>
        shapeContains(def.shape, {
          x: p.x + v.x * FIXED_DT * t,
          y: p.y + v.y * FIXED_DT * t,
          z: p.z + v.z * FIXED_DT * t,
        }),
      );
      if (!touched) return;
      spent = true;
      ctx.addTime(seconds);
      ctx.emit({ type: 'cue', name: 'timeBonus' });
    },
  };
};
