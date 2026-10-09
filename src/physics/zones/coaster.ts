import { FIXED_DT } from '../../core/loop';
import { cos, hypot, sin } from '../../core/math';
import type { Vec3, XYZ } from '../../core/types';
import { xyz } from '../../core/types';
import { numberParam, perBall, vectorsParam, type Zone, type ZoneDef, type ZoneFactory } from './index';
import type { ZoneShape } from './shape';
import { sweepHits } from './tunnel';

/**
 * One stretch of roller coaster track, laid end to end from the entry (SPEC v7 3.4).
 *
 * - `run`: straight on for so many metres along the ground, climbing `rise` on the way
 *   (falling, if it is negative).
 * - `loop`: a full loop of this radius, standing in the line of travel. It leans to one
 *   `side` (1 is the right of the way it runs, the default) so that the track clears itself.
 * - `bend`: turns by so many degrees, clockwise if positive, on a level curve of `radius`.
 */
export type TrackPiece = { run: number; rise?: number } | { loop: number; side?: 1 | -1 } | { bend: number; radius: number };

const RAD = Math.PI / 180;
/** Metres between the points a run or a bend is laid out in. */
const SPACING = 0.25;
/** Points a loop is laid out in. Even, so that one of them is the very top. */
const LOOP_POINTS = 32;
/** How far a loop carries the track sideways. */
const LOOP_SHIFT = 0.6;
const DEFAULT_RADIUS = 0.45;
const DEFAULT_LOSS = 0.6;
const DEFAULT_GRAVITY = 9.81;
/** How fast a ball must be heading along the track to be taken, in m/s. One lying at the entry stays put. */
const MIN_ENTRY_SPEED = 0.15;
/** The slowest a ball on the track ever moves, in m/s: it creeps over a crest it only just makes, and creeps home from a stall. */
const MIN_SPEED = 0.8;
/** How far in front of either end of the track a ball is let go, on top of its own radius. */
const OUTSET = 0.06;
/** Ticks after letting a ball go in which the track does not take it again (SPEC v7 5). */
const COOLDOWN = 30;
/** Ticks over which a ball taken at the entry is drawn onto the track, so that it does not jump. */
const BLEND = 5;

const smooth = (t: number): number => t * t * (3 - 2 * t);

interface Turtle {
  x: number;
  y: number;
  z: number;
  /** Compass heading in degrees: 0 is -Z, 90 is +X. */
  heading: number;
}

/**
 * Lays pieces of track from where `from` stands. Returns the points after the first
 * (which is `from` itself), where it ended up, and each loop as [the point it starts
 * at, the point it ends at, its radius], counting points from `offset`.
 */
function lay(from: Turtle, pieces: readonly TrackPiece[], offset: number): { points: Vec3[]; loops: Vec3[]; end: Turtle } {
  const points: Vec3[] = [];
  const loops: Vec3[] = [];
  let at = { ...from };
  for (const piece of pieces) {
    const dir = { x: sin(at.heading * RAD), z: -cos(at.heading * RAD) };
    const right = { x: cos(at.heading * RAD), z: sin(at.heading * RAD) };
    if ('run' in piece) {
      const rise = piece.rise ?? 0;
      const count = Math.max(1, Math.ceil(piece.run / SPACING));
      for (let k = 1; k <= count; k++) {
        const t = k / count;
        points.push([at.x + dir.x * piece.run * t, at.y + rise * smooth(t), at.z + dir.z * piece.run * t]);
      }
      at = { x: at.x + dir.x * piece.run, y: at.y + rise, z: at.z + dir.z * piece.run, heading: at.heading };
    } else if ('loop' in piece) {
      const radius = piece.loop;
      const side = piece.side ?? 1;
      const first = offset + points.length;
      for (let k = 1; k <= LOOP_POINTS; k++) {
        const t = k / LOOP_POINTS;
        const angle = 2 * Math.PI * t;
        const forward = radius * sin(angle);
        const shift = side * LOOP_SHIFT * t;
        points.push([
          at.x + dir.x * forward + right.x * shift,
          at.y + radius * (1 - cos(angle)),
          at.z + dir.z * forward + right.z * shift,
        ]);
      }
      loops.push([first, first + LOOP_POINTS, radius]);
      // The last point of a loop is its first again, moved over: exactly, not to within rounding.
      at = { x: at.x + right.x * side * LOOP_SHIFT, y: at.y, z: at.z + right.z * side * LOOP_SHIFT, heading: at.heading };
      points[points.length - 1] = [at.x, at.y, at.z];
    } else {
      const sign = piece.bend < 0 ? -1 : 1;
      const sweep = Math.abs(piece.bend) * RAD;
      const count = Math.max(1, Math.ceil((sweep * piece.radius) / SPACING));
      const point = (angle: number): Vec3 => [
        at.x + dir.x * piece.radius * sin(angle) + right.x * sign * piece.radius * (1 - cos(angle)),
        at.y,
        at.z + dir.z * piece.radius * sin(angle) + right.z * sign * piece.radius * (1 - cos(angle)),
      ];
      for (let k = 1; k <= count; k++) points.push(point((sweep * k) / count));
      const [x, y, z] = point(sweep);
      at = { x, y, z, heading: at.heading + piece.bend };
    }
  }
  return { points, loops, end: at };
}

export interface CoasterOptions {
  /**
   * Where the track divides, at the end of the pieces before it (SPEC v7 3.4): a ball
   * doing `speed` m/s or more there takes the `high` branch, a slower one the `low`.
   */
  fork?: { speed: number; high: readonly TrackPiece[]; low: readonly TrackPiece[] };
  /** How hard the track itself slows a ball, in m/s^2, all the way along it. Defaults to 0.6. */
  loss?: number;
  /** Radius of the entry: how near a ball has to pass to be taken. */
  radius?: number;
  color?: number;
}

/**
 * Hole data for a roller coaster (SPEC v7 3.4): track laid piece by piece from `entry`,
 * a point on the ground, setting off along the compass `heading`. A ball that rolls in
 * at the entry, along the track, comes out at the far end; one that is too slow for a
 * climb or a loop comes back out of the entry the way it went in.
 *
 * End a track, and each branch of one that divides, with a level run: that is the way
 * a ball is let go.
 */
export function coaster(entry: Vec3, heading: number, pieces: readonly TrackPiece[], options: CoasterOptions = {}): ZoneDef {
  const start = { x: entry[0], y: entry[1], z: entry[2], heading };
  const main = lay(start, pieces, 0);
  const points = [entry, ...main.points];
  const radius = options.radius ?? DEFAULT_RADIUS;
  const params: Record<string, number | Vec3 | readonly Vec3[]> = {
    points,
    loops: main.loops,
    loss: options.loss ?? DEFAULT_LOSS,
    gravity: DEFAULT_GRAVITY,
    radius,
    color: options.color ?? 0xe5484d,
  };
  if (options.fork) {
    params.forkSpeed = options.fork.speed;
    // Loops belong on the main line: a branch's are laid but not judged.
    params.high = lay(main.end, options.fork.high, points.length - 1).points;
    params.low = lay(main.end, options.fork.low, points.length - 1).points;
  }
  return { type: 'coaster', shape: { kind: 'sphere', center: [entry[0], entry[1] + 0.1, entry[2]], radius } satisfies ZoneShape, params };
}

/** A run of track as a ball rides it: its points, and what is known about each. */
export interface Track {
  points: XYZ[];
  /** Metres of track from the entry to each point. */
  along: number[];
  /**
   * The least speed, squared, a ball must have at each point to stay on the track there:
   * nothing on the level or on the lower half of a loop, and more the higher up the
   * upper half it is, up to gravity times the radius at the very top.
   */
  need: number[];
}

/** The tracks of a coaster: the main line, and if it divides, the main line run on into each branch. */
export interface CoasterTracks {
  main: Track;
  high: Track | null;
  low: Track | null;
  /** How many points the main line has: a branch's own points come after them. */
  mainPoints: number;
  /** Each loop as [first point, last point, radius]. */
  loops: readonly Vec3[];
  forkSpeed: number;
  loss: number;
  gravity: number;
}

function track(points: readonly Vec3[], loops: readonly Vec3[], gravity: number): Track {
  const at = points.map(xyz);
  const along = [0];
  for (let i = 1; i < at.length; i++) {
    const a = at[i - 1];
    const b = at[i];
    along.push(along[i - 1] + hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  const need = at.map(() => 0);
  for (const [first, last, radius] of loops) {
    const base = at[first].y;
    for (let i = first; i <= last; i++) need[i] = gravity * Math.max(0, at[i].y - base - radius);
  }
  return { points: at, along, need };
}

/** The tracks a coaster's data describes. */
export function coasterTracks(def: ZoneDef): CoasterTracks {
  const points = vectorsParam(def, 'points');
  const loops = vectorsParam(def, 'loops');
  const gravity = numberParam(def, 'gravity', DEFAULT_GRAVITY);
  const forked = def.params?.high !== undefined;
  const branch = (name: string): Track | null => (forked ? track([...points, ...vectorsParam(def, name)], loops, gravity) : null);
  return {
    main: track(points, loops, gravity),
    high: branch('high'),
    low: branch('low'),
    mainPoints: points.length,
    loops,
    forkSpeed: numberParam(def, 'forkSpeed', 0),
    loss: numberParam(def, 'loss', DEFAULT_LOSS),
    gravity,
  };
}

/**
 * The speed a ball has to come in at to get all the way through (SPEC v7 3.4): over
 * every climb and round every loop, and, on a track that divides, onto the high branch
 * and along it. It is what the gauge at the entry shows.
 */
export function coasterNeed(def: ZoneDef): number {
  const tracks = coasterTracks(def);
  const way = tracks.high ?? tracks.main;
  const base = way.points[0].y;
  let most = 0;
  way.points.forEach((point, i) => {
    let needed = way.need[i];
    if (tracks.high && i === tracks.mainPoints - 1) needed = Math.max(needed, tracks.forkSpeed * tracks.forkSpeed);
    most = Math.max(most, needed + 2 * tracks.gravity * (point.y - base) + 2 * tracks.loss * way.along[i]);
  });
  return Math.sqrt(most);
}

/** A coaster while a round is on. What its gauge reads is there for the picture. */
export interface CoasterZone extends Zone {
  /** The speed needed at the entry, and the speed the last ball came in at, in m/s; null before the first. */
  gauge: { need: number; last: number | null };
}

interface Ride {
  way: Track;
  /** Metres along the track, and the stretch of it that is on: between point `i` and the next. */
  s: number;
  i: number;
  /** Speed squared at the entry. */
  energy: number;
  /** Rolling back: from how far along, and how high. */
  back: boolean;
  top: number;
  topY: number;
  forked: boolean;
  tick: number;
  from: XYZ;
}

/**
 * A roller coaster (SPEC v7 3.4). A ball that rolls in at the entry is taken out of the
 * simulation and carried along the track, like a ball in a tunnel that can be seen.
 * How fast it goes is not simulated but reckoned: at any point of the track its speed
 * is what it came in with, less what the climb to there and the track itself have taken.
 * So the same speed at the entry always gives the same ride, to the last bit.
 *
 * Where that leaves a ball too slow to go on, short of a crest or without the speed to
 * stay on the upper half of a loop, it rolls back the way it came and is let go out of
 * the entry. On a track that divides, a ball fast enough at the fork takes the high
 * branch and a slower one the low.
 *
 * Nothing about it can be changed, so it is in no snapshot and brings no undo.
 *
 * Params: points (the main line, the first of them the entry), loops ([first point,
 * last point, radius] each), high and low (the points of each branch, if it divides),
 * forkSpeed, loss, gravity, radius. Hole files build all of it with `coaster`.
 */
export const coasterZone: ZoneFactory = (def): CoasterZone => {
  const tracks = coasterTracks(def);
  const { main, loss, gravity } = tracks;
  const radius = numberParam(def, 'radius', DEFAULT_RADIUS);
  const base = main.points[0].y;
  const mainLength = main.along[main.along.length - 1];
  const rides = perBall<{ ride: Ride | null; cooldown: number }>(() => ({ ride: null, cooldown: 0 }));

  /** The way the track runs along the ground on the stretch after point `i`. */
  const flat = (way: Track, i: number): { x: number; z: number } => {
    // A stretch that goes straight up, as none should, takes the heading of the one before it.
    for (let k = i; k >= 0; k--) {
      const a = way.points[k];
      const b = way.points[k + 1];
      const length = hypot(b.x - a.x, b.z - a.z);
      if (length > 1e-9) return { x: (b.x - a.x) / length, z: (b.z - a.z) / length };
    }
    return { x: 0, z: -1 };
  };
  const entryDir = flat(main, 0);

  /** Where a ride is: the point of the track `s` metres along, on the stretch `i`. */
  const place = (way: Track, i: number, s: number): XYZ => {
    const a = way.points[i];
    const b = way.points[i + 1];
    const span = way.along[i + 1] - way.along[i];
    const t = span > 0 ? Math.min(1, Math.max(0, (s - way.along[i]) / span)) : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  };

  /** Speed squared of a ball going forward, `s` metres along and `y` high. */
  const forward = (ride: Ride, s: number, y: number): number => ride.energy - 2 * gravity * (y - base) - 2 * loss * s;
  /** And of one rolling back from where it turned. */
  const backward = (ride: Ride, s: number, y: number): number => 2 * gravity * (ride.topY - y) - 2 * loss * (ride.top - s);

  const zone: CoasterZone = {
    gauge: { need: coasterNeed(def), last: null },
    preStep(ctx) {
      const { ball } = ctx;
      const state = rides(ball);
      const r = ball.props.radius;
      const ride = state.ride;

      if (!ride) {
        if (state.cooldown > 0) {
          state.cooldown--;
          return;
        }
        if (!ball.body.isEnabled()) return;
        const p = ball.position();
        const v = ball.velocity();
        const start = main.points[0];
        const into = v.x * entryDir.x + v.z * entryDir.z;
        // Looks one step ahead, as a tunnel does: the ball is taken as it arrives.
        if (into < MIN_ENTRY_SPEED || !sweepHits(p, v, { x: start.x, y: start.y + r, z: start.z }, radius)) return;
        const speed = hypot(v.x, v.y, v.z);
        state.ride = {
          way: main,
          s: 0,
          i: 0,
          energy: speed * speed,
          back: false,
          top: 0,
          topY: base,
          forked: tracks.high === null,
          tick: 0,
          from: { x: p.x, y: p.y - r, z: p.z },
        };
        zone.gauge.last = speed;
        ball.halt();
        ball.body.setEnabled(false);
        ctx.busy();
        ctx.emit({ type: 'cue', name: 'coasterEnter' });
        return;
      }

      ctx.busy();
      ride.tick++;
      const here = place(ride.way, ride.i, ride.s);
      const squared = ride.back ? backward(ride, ride.s, here.y) : forward(ride, ride.s, here.y);
      const speed = Math.sqrt(Math.max(squared, MIN_SPEED * MIN_SPEED));
      const release = (at: XYZ, dir: { x: number; z: number }, name: string): void => {
        ball.body.setEnabled(true);
        ball.body.setTranslation({ x: at.x + dir.x * (r + OUTSET), y: at.y + r, z: at.z + dir.z * (r + OUTSET) }, true);
        ball.body.setLinvel({ x: dir.x * speed, y: 0, z: dir.z * speed }, true);
        state.ride = null;
        state.cooldown = COOLDOWN;
        ctx.emit({ type: 'cue', name });
      };

      if (ride.back) {
        const s = ride.s - speed * FIXED_DT;
        if (s <= 0) {
          // Out of the entry the way it came in (SPEC v7 3.4).
          release(main.points[0], { x: -entryDir.x, z: -entryDir.z }, 'coasterBack');
          return;
        }
        while (ride.i > 0 && s < ride.way.along[ride.i]) ride.i--;
        ride.s = s;
      } else {
        const s = ride.s + speed * FIXED_DT;
        // At the fork the branch is chosen by the speed the ball has there, exactly at the fork.
        if (!ride.forked && s >= mainLength) {
          ride.forked = true;
          const fork = main.points[main.points.length - 1];
          const fast = forward(ride, mainLength, fork.y) >= tracks.forkSpeed * tracks.forkSpeed;
          ride.way = fast ? tracks.high! : tracks.low!;
          ctx.emit({ type: 'cue', name: fast ? 'coasterHigh' : 'coasterLow' });
        }
        const { way } = ride;
        const last = way.points.length - 1;
        // Every point passed on the way to `s`, and `s` itself, has to be somewhere the
        // ball has the speed to be. The top of a loop is one of the points.
        let i = ride.i;
        let stalled = false;
        while (!stalled && i < last && s >= way.along[i + 1]) {
          i++;
          const e = forward(ride, way.along[i], way.points[i].y);
          stalled = e <= 0 || e < way.need[i];
          if (!stalled && way.need[i] > 0 && way.need[i] >= way.need[i - 1] && way.need[i] > way.need[Math.min(last, i + 1)]) {
            ctx.emit({ type: 'cue', name: 'coasterLoop' });
          }
        }
        if (!stalled && i < last) {
          const there = place(way, i, s);
          const span = way.along[i + 1] - way.along[i];
          const t = span > 0 ? (s - way.along[i]) / span : 0;
          const e = forward(ride, s, there.y);
          stalled = e <= 0 || e < way.need[i] + (way.need[i + 1] - way.need[i]) * t;
        }
        if (stalled) {
          // No further: it rolls back from where it is.
          ride.back = true;
          ride.top = ride.s;
          ride.topY = here.y;
          ctx.emit({ type: 'cue', name: 'coasterStall' });
        } else if (i >= last) {
          release(way.points[last], flat(way, last - 1), 'coasterExit');
          return;
        } else {
          ride.i = i;
          ride.s = s;
        }
      }

      const at = place(ride.way, ride.i, ride.s);
      const blend = Math.min(1, ride.tick / BLEND);
      ball.body.setTranslation(
        {
          x: ride.from.x + (at.x - ride.from.x) * blend,
          y: ride.from.y + (at.y - ride.from.y) * blend + r,
          z: ride.from.z + (at.z - ride.from.z) * blend,
        },
        true,
      );
    },
  };
  return zone;
};

/** True for a zone that is a roller coaster, so the screen can show its gauge. */
export const isCoaster = (zone: Zone): zone is CoasterZone => 'gauge' in zone;
