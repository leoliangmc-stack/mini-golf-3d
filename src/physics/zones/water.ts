import { FIXED_DT } from '../../core/loop';
import { hypot } from '../../core/math';
import type { Vec3, XYZ } from '../../core/types';
import { xyz } from '../../core/types';
import { numberParam, perBall, vectorParam, type ZoneDef, type ZoneFactory } from './index';
import { shapeContains, type ZoneShape } from './shape';

/**
 * Moving water (SPEC v5 3.2). A ball in it is carried: each step its speed along the
 * ground is brought a little nearer the water's own, however fast or slow or which way
 * it was going. So a ball going with the water ends up at the water's pace and no
 * faster, and one going against it is slowed, stopped and brought back.
 *
 * That is what sets it apart from a gravity zone, which adds speed for as long as the
 * ball is in it. The difference is the whole point of the Reef, so this must stay a
 * pull toward a velocity and never become a push.
 *
 * Params: velocity (m/s, on the ground), strength (1/s: how quickly the ball takes up
 * the water's pace; optional).
 */
export const current: ZoneFactory = (def) => {
  const [wx, , wz] = vectorParam(def, 'velocity');
  const share = Math.min(1, numberParam(def, 'strength', DEFAULT_STRENGTH) * FIXED_DT);
  const wet = perBall(() => ({ in: false }));
  return {
    preStep(ctx) {
      const { ball } = ctx;
      // A ball inside a bubble column or a tunnel is not in the water.
      const inside = ball.body.isEnabled() && shapeContains(def.shape, ball.position());
      const memory = wet(ball);
      if (inside && !memory.in) ctx.emit({ type: 'cue', name: 'currentEnter' });
      memory.in = inside;
      if (!inside) return;
      const v = ball.velocity();
      ball.body.setLinvel({ x: v.x + (wx - v.x) * share, y: v.y, z: v.z + (wz - v.z) * share }, true);
    },
  };
};

const DEFAULT_STRENGTH = 4;

/** A stretch of moving water over a rectangle of ground at height `y`, flowing at `velocity` [x, z] m/s. */
export const stream = (
  min: readonly [number, number],
  max: readonly [number, number],
  velocity: readonly [number, number],
  options: { y?: number; strength?: number } = {},
): ZoneDef => {
  const y = options.y ?? 0;
  return {
    type: 'current',
    shape: {
      kind: 'box',
      center: [(min[0] + max[0]) / 2, y + 0.3, (min[1] + max[1]) / 2],
      halfExtents: [(max[0] - min[0]) / 2, 0.4, (max[1] - min[1]) / 2],
    },
    params: { velocity: [velocity[0], 0, velocity[1]], strength: options.strength ?? DEFAULT_STRENGTH },
  };
};

/** The water's velocity in a current zone, on the ground. */
export const streamVelocity = (def: ZoneDef): { x: number; z: number } => {
  const [x, , z] = vectorParam(def, 'velocity');
  return { x, z };
};

/**
 * Ticks after letting a ball go in which a column leaves it alone: long enough for one
 * that was let go slowly to come down and roll clear of the foot.
 */
const COOLDOWN = 120;
/** Ticks a ball takes to drift from where it was caught to the middle of the column. */
const GATHER = 10;
const DEFAULT_RISE = 2.4;

/**
 * A column of bubbles (SPEC v5 3.2). A ball that rolls into its foot is taken up: it
 * rises in plain sight at a fixed pace to the top, and is let go from there with a
 * fixed velocity. Nothing about how the ball came in matters, so the same column always
 * sets a ball down in the same place.
 *
 * Params: top (the point it is let go from), exit (the velocity it is let go with),
 * rise (m/s, optional).
 */
export const bubbleLift: ZoneFactory = (def) => {
  const top = xyz(vectorParam(def, 'top'));
  const exit = xyz(vectorParam(def, 'exit'));
  const rise = numberParam(def, 'rise', DEFAULT_RISE);
  const [fx, fy, fz] = def.shape.center;
  const rides = perBall<{ ride: { from: XYZ; foot: XYZ; tick: number; ticks: number } | null; cooldown: number }>(() => ({
    ride: null,
    cooldown: 0,
  }));

  return {
    preStep(ctx) {
      const { ball } = ctx;
      const state = rides(ball);
      if (state.ride) {
        ctx.busy();
        const { from, foot, ticks } = state.ride;
        const t = ++state.ride.tick;
        if (t <= GATHER) {
          const u = t / GATHER;
          ball.body.setTranslation({ x: from.x + (foot.x - from.x) * u, y: from.y + (foot.y - from.y) * u, z: from.z + (foot.z - from.z) * u }, true);
        } else if (t < GATHER + ticks) {
          const u = (t - GATHER) / ticks;
          ball.body.setTranslation({ x: foot.x + (top.x - foot.x) * u, y: foot.y + (top.y - foot.y) * u, z: foot.z + (top.z - foot.z) * u }, true);
        } else {
          ball.body.setEnabled(true);
          ball.body.setTranslation(top, true);
          ball.body.setLinvel(exit, true);
          state.ride = null;
          state.cooldown = COOLDOWN;
          ctx.emit({ type: 'cue', name: 'bubbleRelease' });
        }
        return;
      }
      if (state.cooldown > 0) {
        state.cooldown--;
        return;
      }
      if (!ball.body.isEnabled() || !shapeContains(def.shape, ball.position())) return;
      const foot = { x: fx, y: fy, z: fz };
      const height = hypot(top.x - foot.x, top.y - foot.y, top.z - foot.z);
      state.ride = { from: { ...ball.position() }, foot, tick: 0, ticks: Math.max(1, Math.round(height / rise / FIXED_DT)) };
      ball.halt();
      ball.body.setEnabled(false);
      ctx.busy();
      ctx.emit({ type: 'cue', name: 'bubbleCatch' });
    },
  };
};

/**
 * A column of bubbles standing on the ground at `at`, that lifts a ball to `height`
 * above it and lets it go with the velocity `exit`.
 */
export const bubbles = (at: Vec3, height: number, exit: Vec3, radius = 0.55): ZoneDef => ({
  type: 'bubbleLift',
  shape: { kind: 'sphere', center: [at[0], at[1] + 0.1, at[2]], radius } satisfies ZoneShape,
  params: { top: [at[0], at[1] + height, at[2]], exit },
});

export const bubbleTop = (def: ZoneDef): Vec3 => vectorParam(def, 'top');
