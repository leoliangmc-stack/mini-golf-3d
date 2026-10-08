import { FIXED_DT } from '../../core/loop';
import { cos, hypot, sin } from '../../core/math';
import type { Vec3, XYZ } from '../../core/types';
import type { Ball } from '../ball';
import { numberParam, perBall, vectorParam, type ZoneDef, type ZoneFactory } from './index';
import type { ZoneShape } from './shape';

/** One mouth of a tunnel. */
export interface TunnelEnd {
  /** Point on the ground in the middle of the mouth. */
  at: Vec3;
  /**
   * Compass heading the mouth opens toward, in degrees: 0 is -Z (up the screen),
   * 90 is +X (right), 180 is +Z. A ball comes out rolling along it, and has to be
   * rolling against it to get in.
   */
  facing: number;
}

const DEFAULT_RADIUS = 0.45;
const DEFAULT_COLOR = 0x4fb3ff;
/** Ticks the ball spends inside, about 0.3 s: half going in, half coming out. */
const TRANSIT = 18;
const HALF = TRANSIT / 2;
/** Ticks after coming out during which no tunnel takes the ball. */
const COOLDOWN = 30;
/** How fast the ball must be heading into a mouth to be taken, in m/s. A ball lying in front of one stays put. */
const MIN_ENTRY_SPEED = 0.15;
/** How far behind the mouth the ball hides, and how far in front of it the ball is let go, in metres. */
const INSET = 0.35;
const OUTSET = 0.06;

/** Unit vector for a compass heading in degrees. */
export function headingVector(degrees: number): XYZ {
  const a = (degrees * Math.PI) / 180;
  return { x: sin(a), y: 0, z: -cos(a) };
}

/**
 * Hole data for a pair of tunnel mouths. The pair works both ways: a ball rolling into
 * either mouth comes out of the other.
 *
 * Do not point a mouth straight at its partner, or the ball can shuttle back and forth
 * (tests/worlds.test.ts checks this).
 */
export function tunnelPair(a: TunnelEnd, b: TunnelEnd, options: { radius?: number; color?: number } = {}): ZoneDef {
  const radius = options.radius ?? DEFAULT_RADIUS;
  return {
    type: 'tunnelPair',
    shape: mouthShape(a, radius),
    params: { a: a.at, aFacing: a.facing, b: b.at, bFacing: b.facing, radius, color: options.color ?? DEFAULT_COLOR },
  };
}

/** The two mouths of a `tunnelPair` zone, as its data describes them. */
export function tunnelEnds(def: ZoneDef): [TunnelEnd, TunnelEnd] {
  return [
    { at: vectorParam(def, 'a'), facing: numberParam(def, 'aFacing') },
    { at: vectorParam(def, 'b'), facing: numberParam(def, 'bFacing') },
  ];
}

export const tunnelRadius = (def: ZoneDef): number => numberParam(def, 'radius', DEFAULT_RADIUS);
export const tunnelColor = (def: ZoneDef): number => numberParam(def, 'color', DEFAULT_COLOR);

/** The volume in front of each mouth that takes the ball. */
export function tunnelMouths(def: ZoneDef): [ZoneShape, ZoneShape] {
  const radius = tunnelRadius(def);
  const [a, b] = tunnelEnds(def);
  return [mouthShape(a, radius), mouthShape(b, radius)];
}

function mouthShape(end: TunnelEnd, radius: number): ZoneShape {
  return { kind: 'sphere', center: [end.at[0], end.at[1] + 0.1, end.at[2]], radius };
}

/**
 * When the ball last came out of a tunnel. Shared by every tunnel of the hole, because
 * the pause applies to all of them, and keyed by the ball so it ends with the round.
 */
const lastExit = new WeakMap<Ball, number>();

interface Mouth {
  /** Middle of the mouth at ball height. */
  center: XYZ;
  dir: XYZ;
  /** Where the ball hides behind the mouth, and where it is let go in front of it. */
  inside: XYZ;
  exit: XYZ;
}

/** True if a point moving from `p` at velocity `v` comes within `radius` of `c` during the next step. */
function sweepHits(p: XYZ, v: XYZ, c: XYZ, radius: number): boolean {
  const dx = v.x * FIXED_DT;
  const dy = v.y * FIXED_DT;
  const dz = v.z * FIXED_DT;
  const lengthSq = dx * dx + dy * dy + dz * dz;
  const along = lengthSq < 1e-12 ? 0 : ((c.x - p.x) * dx + (c.y - p.y) * dy + (c.z - p.z) * dz) / lengthSq;
  const t = Math.min(1, Math.max(0, along));
  return hypot(p.x + dx * t - c.x, p.y + dy * t - c.y, p.z + dz * t - c.z) <= radius;
}

const lerp = (a: XYZ, b: XYZ, t: number): XYZ => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

/**
 * A pair of tunnel mouths. A ball rolling into one is taken out of the simulation,
 * travels unseen for a fixed number of ticks, and is let go at the other mouth at the
 * speed it went in with, heading the way that mouth faces.
 *
 * Everything here is counted in ticks and decided from the ball's own position and
 * velocity, so a stroke through a tunnel replays exactly.
 */
export const tunnel: ZoneFactory = (def) => {
  const radius = tunnelRadius(def);
  const ends = tunnelEnds(def);
  // The mouths sit at the height of the ball's centre, so each size of ball has its own.
  const mouthsBySize = new Map<number, [Mouth, Mouth]>();
  const trips = perBall<{ transit: { from: Mouth; to: Mouth; start: XYZ; speed: number; tick: number } | null }>(
    () => ({ transit: null }),
  );

  const build = (ballRadius: number): [Mouth, Mouth] =>
    ends.map((end): Mouth => {
      const dir = headingVector(end.facing);
      const center = { x: end.at[0], y: end.at[1] + ballRadius, z: end.at[2] };
      const offset = (d: number): XYZ => ({ x: center.x + dir.x * d, y: center.y, z: center.z + dir.z * d });
      return { center, dir, inside: offset(-INSET), exit: offset(ballRadius + OUTSET) };
    }) as [Mouth, Mouth];

  return {
    preStep(ctx) {
      const { ball, world } = ctx;
      const ballRadius = ball.props.radius;
      let mouths = mouthsBySize.get(ballRadius);
      if (!mouths) mouthsBySize.set(ballRadius, (mouths = build(ballRadius)));
      const trip = trips(ball);

      if (trip.transit) {
        ctx.busy();
        const { from, to, start, speed } = trip.transit;
        const t = ++trip.transit.tick;
        if (t < HALF) {
          ball.body.setTranslation(lerp(start, from.inside, t / HALF), true);
        } else if (t === HALF) {
          // Hidden at both ends of this jump, so it is never seen crossing the course.
          ball.body.setTranslation(to.inside, true);
          ctx.snap();
          ctx.emit({ type: 'cue', name: 'tunnelExit' });
        } else if (t < TRANSIT) {
          ball.body.setTranslation(lerp(to.inside, to.exit, (t - HALF) / (TRANSIT - HALF)), true);
        } else {
          ball.body.setEnabled(true);
          ball.body.setTranslation(to.exit, true);
          ball.body.setLinvel({ x: to.dir.x * speed, y: 0, z: to.dir.z * speed }, true);
          lastExit.set(ball, world.tick);
          trip.transit = null;
        }
        return;
      }

      // Another zone has the ball, or it has only just come out of a tunnel.
      if (!ball.body.isEnabled()) return;
      const exited = lastExit.get(ball);
      if (exited !== undefined && world.tick - exited < COOLDOWN) return;

      const p = ball.position();
      const v = ball.velocity();
      for (let i = 0; i < 2; i++) {
        const mouth = mouths[i];
        const into = -(v.x * mouth.dir.x + v.z * mouth.dir.z);
        // Looks one step ahead: by the time the ball touched the trunk it would have bounced.
        if (into < MIN_ENTRY_SPEED || !sweepHits(p, v, mouth.center, radius)) continue;
        trip.transit = { from: mouth, to: mouths[1 - i], start: { ...p }, speed: hypot(v.x, v.y, v.z), tick: 0 };
        ball.halt();
        ball.body.setEnabled(false);
        ctx.busy();
        ctx.emit({ type: 'cue', name: 'tunnelEnter' });
        return;
      }
    },
  };
};
