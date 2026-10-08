import { FIXED_DT } from '../../core/loop';
import type { Vec3 } from '../../core/types';
import type { Ball } from '../ball';
import { numberParam, perBall, type Zone, type ZoneContext, type ZoneDef, type ZoneFactory } from './index';
import { shapeContains, type ZoneShape } from './shape';

/**
 * Pads: marks on the ground that do something to a ball rolling over them. A pad works
 * again and again, but a ball has to leave it and come back for the next time (SPEC v3
 * 2.2), so one that stops on a pad is not changed over and over. A ball flying over a
 * pad is too high to touch it.
 */

const PAD_RADIUS = 0.45;
const DEFAULT_SPLIT_ANGLE = 20;

const padShape = (at: Vec3, radius: number): ZoneShape => ({
  kind: 'sphere',
  center: [at[0], at[1] + 0.1, at[2]],
  radius,
});

/** A pad that makes the ball one size bigger. `at` is a point on the ground. */
export const growPad = (at: Vec3, radius = PAD_RADIUS): ZoneDef => ({ type: 'grow', shape: padShape(at, radius) });

/** A pad that makes the ball one size smaller. */
export const shrinkPad = (at: Vec3, radius = PAD_RADIUS): ZoneDef => ({ type: 'shrink', shape: padShape(at, radius) });

/**
 * A pad that splits the ball in two, the halves heading `angle` degrees to either side
 * of the way it was going. It does nothing once the hole has `maxBalls` on the course.
 */
export const splitPad = (at: Vec3, angle = DEFAULT_SPLIT_ANGLE, radius = PAD_RADIUS): ZoneDef => ({
  type: 'split',
  shape: padShape(at, radius),
  params: { angle },
});

export const splitAngle = (def: ZoneDef): number => numberParam(def, 'angle', DEFAULT_SPLIT_ANGLE);

/** True if the ball is on the pad now or will be within the coming step: a fast ball must not skip a small pad. */
function touches(shape: ZoneShape, ball: Ball): boolean {
  const p = ball.position();
  const v = ball.velocity();
  for (const t of [0, 0.5, 1]) {
    const ahead = { x: p.x + v.x * FIXED_DT * t, y: p.y + v.y * FIXED_DT * t, z: p.z + v.z * FIXED_DT * t };
    if (shapeContains(shape, ahead)) return true;
  }
  return false;
}

/** Runs `enter` each time a ball comes onto the pad from outside it. */
function pad(def: ZoneDef, enter: (ctx: ZoneContext, mark: (ball: Ball) => void) => void): Zone {
  const on = perBall(() => ({ pad: false }));
  return {
    preStep(ctx) {
      const { ball } = ctx;
      // A ball inside a tunnel or a cannon is not on the ground.
      if (!ball.body.isEnabled()) return;
      const memory = on(ball);
      const now = touches(def.shape, ball);
      if (now && !memory.pad) enter(ctx, (other) => (on(other).pad = true));
      memory.pad = now;
    },
  };
}

/** Grows (`step` 1) or shrinks (`step` -1) the ball by one size. A ball with no further to go is left alone. */
export const resizer =
  (step: 1 | -1): ZoneFactory =>
  (def) =>
    pad(def, (ctx) => ctx.resize(step));

export const splitter: ZoneFactory = (def) => {
  const angle = splitAngle(def);
  return pad(def, (ctx, mark) => {
    const twin = ctx.split(angle);
    // The new ball starts on the pad; it must not split again on the spot.
    if (twin) mark(twin);
  });
};
