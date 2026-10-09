import { hypot } from '../../core/math';
import type { Vec3, XYZ } from '../../core/types';
import { xyz } from '../../core/types';
import { numberParam, perBall, vectorParam, vectorsParam, type Zone, type ZoneDef, type ZoneFactory } from './index';
import { shapeContains, type ZoneShape } from './shape';

/** Ticks a strike lasts: a ball that is on the skin at any moment of them is thrown. */
const DEFAULT_WINDOW = 6;

/** What a drum is doing at one tick. */
export interface DrumBeat {
  /** How many times it has struck so far. */
  count: number;
  /** True while it is striking. */
  striking: boolean;
  /** Share of the wait for the next strike still to go, from 1 down to 0. */
  left: number;
}

/** The drum at a tick: a pure function of the hole's clock, like everything that keeps the beat. */
export function drumAt(def: ZoneDef, tick: number): DrumBeat {
  const ticks = numberParam(def, 'ticks');
  const clock = tick - numberParam(def, 'offset', 0);
  const into = ((clock % ticks) + ticks) % ticks;
  return {
    count: Math.floor(clock / ticks) + 1,
    striking: clock >= 0 && into < numberParam(def, 'window', DEFAULT_WINDOW),
    left: into === 0 ? 0 : 1 - into / ticks,
  };
}

/** A drum while a round is on. What it is doing right now is there for the picture to read. */
export interface DrumZone extends Zone {
  beat: DrumBeat;
}

/**
 * A drum set in the ground (SPEC v6 3.4). Every so many beats it strikes, and a ball
 * lying or rolling on its skin just then is thrown, always the same way and at the
 * same speed, however it came there. Between strikes it is ground like any other.
 *
 * A ball may not be left on it: one lying there when the player came to aim would be
 * thrown without a stroke. One that stops there is moved to a safe spot the hole names.
 *
 * Params: ticks (physics ticks from one strike to the next: a whole number of beats),
 * offset (ticks before the first strike, optional), window (ticks a strike lasts,
 * optional), velocity (what a ball is thrown with), rest (safe spots).
 */
export const drum: ZoneFactory = (def): DrumZone => {
  const velocity = xyz(vectorParam(def, 'velocity'));
  const rests = vectorsParam(def, 'rest');
  const ticks = numberParam(def, 'ticks');
  if (!Number.isInteger(ticks) || ticks < 2) throw new Error(`A drum strikes every whole number of ticks, not ${ticks}`);
  /** The strike that last threw each ball, so that one strike throws it once. */
  const thrown = perBall(() => ({ count: 0 }));
  let heard = 0;
  const zone: DrumZone = {
    beat: drumAt(def, 0),
    preStep(ctx) {
      const { ball, world } = ctx;
      const beat = (zone.beat = drumAt(def, world.tick));
      if (!beat.striking) return;
      // Once per strike, for the sound of it, ball or no ball.
      if (beat.count !== heard) {
        heard = beat.count;
        ctx.emit({ type: 'cue', name: 'drumBeat' });
      }
      const memory = thrown(ball);
      if (memory.count === beat.count || !ball.body.isEnabled() || !ctx.grounded()) return;
      if (!shapeContains(def.shape, ball.position())) return;
      memory.count = beat.count;
      ball.body.setLinvel(velocity, true);
      ctx.emit({ type: 'cue', name: 'drumThrow' });
    },
    forbidsRest: (point) => shapeContains(def.shape, point),
    nearestRest(point) {
      let best: Vec3 | null = null;
      let nearest = Infinity;
      for (const rest of rests) {
        const distance = hypot(rest[0] - point.x, rest[1] - point.y, rest[2] - point.z);
        if (distance < nearest) {
          nearest = distance;
          best = rest;
        }
      }
      return best;
    },
  };
  return zone;
};

/**
 * A drum of `radius` set in the ground at `at`. It strikes every `every` beats of
 * `beat` ticks each, the first time `offset` beats in, and throws a ball with `velocity`.
 */
export const drumPad = (
  at: Vec3,
  radius: number,
  options: { beat: number; every: number; offset?: number; velocity: Vec3; rest: readonly Vec3[]; window?: number },
): ZoneDef => ({
  type: 'drum',
  shape: { kind: 'sphere', center: [at[0], at[1] + 0.1, at[2]], radius } satisfies ZoneShape,
  params: {
    ticks: options.every * options.beat,
    offset: (options.offset ?? 0) * options.beat,
    window: options.window ?? DEFAULT_WINDOW,
    velocity: options.velocity,
    rest: options.rest,
  },
});

/** Where a point on a drum's skin is, for the picture: its middle, on the ground. */
export const drumCentre = (def: ZoneDef): XYZ => ({ x: def.shape.center[0], y: def.shape.center[1] - 0.1, z: def.shape.center[2] });

/** True for a zone that is a drum, so the screen can show it. */
export const isDrum = (zone: Zone): zone is DrumZone => 'beat' in zone;
