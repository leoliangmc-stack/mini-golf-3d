import { FIXED_DT } from '../../core/loop';
import type { Vec3, XYZ } from '../../core/types';
import { xyz } from '../../core/types';
import { numberParam, perBall, vectorParam, vectorsParam, type Zone, type ZoneDef, type ZoneFactory } from './index';
import { shapeContains, type ZoneShape } from './shape';

/** Ticks a ball takes to settle in the middle of the pad once it has rolled in. */
const GATHER = 8;
/** Ticks after setting a ball down in which the arm leaves it alone. */
const COOLDOWN = 60;
/** Shares of one trip: waiting at the pad, the way out, at the drop. The way back is the rest. */
const LOAD = 0.25;
const OUT = 0.35;
const SET = 0.08;
/** Shares of the way out, or back, spent going straight up at one end and straight down at the other. */
const HOIST = 0.2;
const DEFAULT_LIFT = 1.6;
const DEFAULT_RADIUS = 0.5;

/** Where a robot arm is in its round at one tick. */
export interface ArmPose {
  /** The gripper: where the middle of a ball in it would be, less the ball's radius. */
  grip: XYZ;
  /** Which of the drops the trip under way goes to. */
  trip: number;
  /** Which of them the next trip to leave the pad goes to: what the lamp shows. */
  next: number;
  /** Share of a whole trip still to go before that one leaves, from 1 down to 0. */
  left: number;
  /** True on the one tick a trip leaves the pad, and on the one it reaches its drop. */
  leaving: boolean;
  arriving: boolean;
}

interface Timing {
  ticks: number;
  load: number;
  out: number;
  set: number;
  shift: number;
  drops: number;
}

function timing(def: ZoneDef): Timing {
  const ticks = Math.max(8, Math.round(numberParam(def, 'period') / FIXED_DT));
  const drops = vectorsParam(def, 'drops').length;
  if (drops === 0) throw new Error('An arm needs somewhere to set a ball down');
  return {
    ticks,
    load: Math.round(ticks * LOAD),
    out: Math.round(ticks * OUT),
    set: Math.round(ticks * SET),
    shift: Math.round(numberParam(def, 'phase', 0) * drops * ticks),
    drops,
  };
}

const smooth = (u: number): number => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
};

/** A point `s` of the way from the pad to a drop: straight up, across, straight down. */
function along(pad: XYZ, drop: XYZ, lift: number, s: number): XYZ {
  const across = smooth((s - HOIST) / (1 - 2 * HOIST));
  const height = s < HOIST ? smooth(s / HOIST) : s > 1 - HOIST ? smooth((1 - s) / HOIST) : 1;
  return {
    x: pad.x + (drop.x - pad.x) * across,
    y: pad.y + (drop.y - pad.y) * across + lift * height,
    z: pad.z + (drop.z - pad.z) * across,
  };
}

/**
 * The arm at a tick: a pure function of the hole's clock, like a moving part (SPEC v6
 * 3.3). It goes round its drops in order, one trip each, whether or not there is a
 * ball to take. So the same stroke on the same tick is always carried to the same place.
 */
export function armAt(def: ZoneDef, tick: number): ArmPose {
  const t = timing(def);
  const pad = padPoint(def);
  const drops = vectorsParam(def, 'drops');
  const lift = numberParam(def, 'lift', DEFAULT_LIFT);
  const clock = tick + t.shift;
  const into = clock % t.ticks;
  const trip = Math.floor(clock / t.ticks) % t.drops;
  const drop = xyz(drops[trip]);
  const waiting = into < t.load;
  let grip: XYZ;
  if (waiting) grip = pad;
  else if (into < t.load + t.out) grip = along(pad, drop, lift, (into - t.load) / t.out);
  else if (into < t.load + t.out + t.set) grip = drop;
  else grip = along(pad, drop, lift, 1 - (into - t.load - t.out - t.set) / (t.ticks - t.load - t.out - t.set));
  return {
    grip,
    trip,
    next: waiting ? trip : (trip + 1) % t.drops,
    left: (waiting ? t.load - into : t.ticks - into + t.load) / t.ticks,
    leaving: into === t.load,
    arriving: into === t.load + t.out,
  };
}

/** A robot arm while a round is on. Where it is and what it holds are there for the picture to read. */
export interface ArmZone extends Zone {
  /** The arm after the coming step, and after the last one. */
  pose: ArmPose;
  prev: ArmPose;
  /** A ball is on the pad waiting, or in the gripper. */
  loaded: boolean;
}

type Stage = 'free' | 'gather' | 'wait' | 'carry';

/**
 * A robot arm (SPEC v6 3.3). A ball that rolls onto its pad is held there, and the
 * stroke is not over: the next time the arm leaves the pad it takes the ball along,
 * in plain sight, and sets it down at that trip's drop, at rest. Where a ball ends up
 * is a matter of which trip it was in time for, which the lamp by the pad foretells.
 *
 * Params: drops (the points on the ground it sets a ball down at, visited in turn),
 * period (seconds one trip takes, out and back), base (where the arm stands; for the
 * picture), phase (where in its round it starts, 0..1, optional), lift (how high it
 * carries, optional).
 */
export const arm: ZoneFactory = (def): ArmZone => {
  const pad = padPoint(def);
  const balls = perBall<{ stage: Stage; from: XYZ; tick: number; cooldown: number }>(() => ({
    stage: 'free',
    from: pad,
    tick: 0,
    cooldown: 0,
  }));
  const start = armAt(def, 0);
  const zone: ArmZone = {
    pose: start,
    prev: start,
    loaded: false,
    preStep(ctx) {
      const { ball, world } = ctx;
      // What is set here is where things are once the coming step is done.
      const pose = (zone.pose = armAt(def, world.tick + 1));
      zone.prev = armAt(def, world.tick);
      const state = balls(ball);
      const r = ball.props.radius;
      const hold = (at: XYZ) => ball.body.setTranslation({ x: at.x, y: at.y + r, z: at.z }, true);

      if (state.stage === 'free') {
        zone.loaded = false;
        if (state.cooldown > 0) {
          state.cooldown--;
          return;
        }
        if (!ball.body.isEnabled() || !shapeContains(def.shape, ball.position())) return;
        const p = ball.position();
        state.stage = 'gather';
        state.from = { x: p.x, y: p.y - r, z: p.z };
        state.tick = 0;
        ball.halt();
        ball.body.setEnabled(false);
        zone.loaded = true;
        ctx.busy();
        ctx.emit({ type: 'cue', name: 'armCatch' });
        return;
      }

      zone.loaded = true;
      ctx.busy();
      if (state.stage === 'gather') {
        const u = ++state.tick / GATHER;
        const { from } = state;
        hold({ x: from.x + (pad.x - from.x) * u, y: from.y + (pad.y - from.y) * u, z: from.z + (pad.z - from.z) * u });
        if (state.tick >= GATHER) state.stage = 'wait';
        return;
      }
      if (state.stage === 'wait') {
        if (!pose.leaving) return;
        state.stage = 'carry';
        ctx.emit({ type: 'cue', name: 'armLift' });
      }
      hold(pose.grip);
      if (!pose.arriving) return;
      // Set down, at rest (SPEC v6 5): the stroke ends here unless the ground moves it on.
      ball.body.setEnabled(true);
      ball.halt();
      state.stage = 'free';
      state.cooldown = COOLDOWN;
      ctx.emit({ type: 'cue', name: 'armRelease' });
    },
  };
  return zone;
};

/** The middle of an arm's pad, on the ground. */
export const padPoint = (def: ZoneDef): XYZ => {
  const [x, y, z] = vectorParam(def, 'pad');
  return { x, y, z };
};

/**
 * A robot arm standing at `base` with its pad at `pad`, that sets a ball down at each
 * of `drops` in turn, one trip of `period` seconds each. All three are points on the ground.
 */
export const robotArm = (
  pad: Vec3,
  base: Vec3,
  drops: readonly Vec3[],
  period: number,
  options: { phase?: number; lift?: number; radius?: number } = {},
): ZoneDef => ({
  type: 'arm',
  shape: { kind: 'sphere', center: [pad[0], pad[1] + 0.1, pad[2]], radius: options.radius ?? DEFAULT_RADIUS } satisfies ZoneShape,
  params: { pad, base, drops, period, phase: options.phase ?? 0, lift: options.lift ?? DEFAULT_LIFT },
});

/** True for a zone that is a robot arm, so the screen can show it. */
export const isArm = (zone: Zone): zone is ArmZone => 'pose' in zone && 'loaded' in zone;
