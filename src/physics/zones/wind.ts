import { FIXED_DT } from '../../core/loop';
import type { Vec3 } from '../../core/types';
import { numberParam, shapesParam, vectorsParam, type Zone, type ZoneContext, type ZoneDef, type ZoneFactory } from './index';
import { shapeContains, type ZoneShape } from './shape';

/** What the wind is doing at one tick. */
export interface Gust {
  /** Which of the hole's gusts is blowing. */
  index: number;
  /** Acceleration it gives a ball in the air, in m/s^2 on the ground. Zero in a calm. */
  x: number;
  z: number;
  /** The one that comes next. */
  next: { x: number; z: number };
  /** Share of this gust still to come, from 1 at its start to 0 at its end. */
  left: number;
  /** True in the last moments of a gust: the vane is already turning. */
  turning: boolean;
}

const DEFAULT_WARNING = 0.6;

/** Whole ticks one gust lasts. */
const gustTicks = (def: ZoneDef): number => Math.max(2, Math.round(numberParam(def, 'period') / FIXED_DT));

/**
 * The wind at a tick: a pure function of the hole's clock, like a moving part. It
 * depends on nothing a player does, so a stroke meets the same wind every time it is
 * played on the same tick, and going back a stroke does not rewind it (SPEC v5 3.3).
 */
export function gustAt(def: ZoneDef, tick: number): Gust {
  const gusts = vectorsParam(def, 'gusts');
  const ticks = gustTicks(def);
  const index = Math.floor(tick / ticks) % gusts.length;
  const into = tick % ticks;
  const [x, , z] = gusts[index];
  const [nx, , nz] = gusts[(index + 1) % gusts.length];
  const warning = Math.round(numberParam(def, 'warning', DEFAULT_WARNING) / FIXED_DT);
  return { index, x, z, next: { x: nx, z: nz }, left: 1 - into / ticks, turning: ticks - into <= warning };
}

/** A wind zone while a round is on. What it is doing right now is there for the picture to read. */
export interface WindZone extends Zone {
  gust: Gust;
}

/**
 * Wind (SPEC v5 3.3). It pushes a ball that is in the air and leaves one on the ground
 * alone, which is what makes it a matter of when to take off and not one more slope.
 * It changes on a fixed round of gusts, and inside a shelter it does nothing.
 *
 * Params: gusts (accelerations in m/s^2, on the ground, blown in turn), period
 * (seconds each lasts), warning (seconds before a change that the vane starts to turn,
 * optional), shelters (shapes the wind does not reach, optional).
 */
export const wind: ZoneFactory = (def): WindZone => {
  const shelters = shapesParam(def, 'shelters');
  let blowing = 0;
  const zone: WindZone = {
    gust: gustAt(def, 0),
    preStep(ctx: ZoneContext) {
      const { ball, world } = ctx;
      const gust = (zone.gust = gustAt(def, world.tick));
      // The moment it changes, for the sound of it.
      if (gust.index !== blowing) {
        blowing = gust.index;
        ctx.emit({ type: 'cue', name: 'gust' });
      }
      if (!ball.body.isEnabled() || ctx.grounded()) return;
      const p = ball.position();
      if (!shapeContains(def.shape, p) || shelters.some((shelter) => shapeContains(shelter, p))) return;
      const v = ball.velocity();
      ball.body.setLinvel({ x: v.x + gust.x * FIXED_DT, y: v.y, z: v.z + gust.z * FIXED_DT }, true);
    },
  };
  return zone;
};

/**
 * Wind over the box `shape`: `gusts` are [x, z] accelerations blown in turn for
 * `period` seconds each. `vane` is where the weathervane stands, on the ground.
 */
export const gusts = (
  shape: ZoneShape,
  list: readonly (readonly [number, number])[],
  period: number,
  vane: Vec3,
  shelters: readonly ZoneShape[] = [],
): ZoneDef => ({
  type: 'wind',
  shape,
  params: { gusts: list.map(([x, z]): Vec3 => [x, 0, z]), period, vane, shelters },
});

/** True for a zone that is wind, so the screen can show its vane. */
export const isWind = (zone: Zone): zone is WindZone => 'gust' in zone;
