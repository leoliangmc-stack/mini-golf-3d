import { FIXED_DT } from '../core/loop';
import { cos, hypot, sin } from '../core/math';
import type { Vec3, XYZ } from '../core/types';
import type { CycleDef, MotionDef, MoverDef } from '../level/schema';
import type { Ball } from './ball';
import { RAPIER } from './rapier';
import { getSurface, type GroundCarrier, type SurfaceMap } from './surfaces';
import type { PhysicsWorld } from './world';
import { shapeContains } from './zones/shape';

export interface MoverPose {
  position: XYZ;
  /** Rotation about +Y, in radians. */
  yaw: number;
}

const RAD = Math.PI / 180;
/** Collides with everything / with nothing. */
const SOLID = 0xffffffff;
const GHOST = 0x00020000;

/** Position within a cycle, 0..1, at a given tick. Periods are whole ticks so cycles repeat exactly. */
export function cyclePhase(tick: number, period: number, phase = 0): number {
  const ticks = Math.max(2, Math.round(period / FIXED_DT));
  const u = (tick % ticks) / ticks + phase;
  return u - Math.floor(u);
}

/** How far along its travel a back-and-forth mover is at a given tick: 0 at the start, 1 at the far end. */
export function cycleValue(tick: number, def: CycleDef): number {
  const u = cyclePhase(tick, def.period, def.phase);
  const [holdStart, holdEnd] = def.hold ?? [0, 0];
  const move = (1 - holdStart - holdEnd) / 2;
  const ease = (x: number) => 0.5 - 0.5 * cos(Math.PI * x);
  if (u < holdStart) return 0;
  if (u < holdStart + move) return ease((u - holdStart) / move);
  if (u < holdStart + move + holdEnd) return 1;
  return ease((1 - u) / move);
}

/**
 * Where something that starts at `position`, turned by `yaw` radians, has got to at a
 * given tick. A pure function of the tick: this is what makes timing reproducible, and
 * it is the one schedule every moving thing in the game runs on (moving parts, the cup).
 */
export function motionPose(position: Vec3, yaw: number, motion: MotionDef, tick: number): MoverPose {
  const [x, y, z] = position;
  if (motion.type === 'slide') {
    const s = cycleValue(tick, motion);
    return {
      position: { x: x + motion.offset[0] * s, y: y + motion.offset[1] * s, z: z + motion.offset[2] * s },
      yaw,
    };
  }
  const angle =
    motion.type === 'swing'
      ? motion.angle * RAD * cycleValue(tick, motion)
      : 2 * Math.PI * cyclePhase(tick, motion.period, motion.phase);
  const [px, pz] = motion.pivot;
  const dx = x - px;
  const dz = z - pz;
  const c = cos(angle);
  const s = sin(angle);
  return {
    position: { x: px + dx * c + dz * s, y, z: pz - dx * s + dz * c },
    yaw: yaw + angle,
  };
}

/** Where a mover is at a given tick. */
export function moverPose(def: MoverDef, tick: number): MoverPose {
  return motionPose(def.position, (def.yaw ?? 0) * RAD, def.motion, tick);
}

/** Maps a point fixed to the mover in one pose to where it is in another pose. */
function carry(point: XYZ, from: MoverPose, to: MoverPose): XYZ {
  const dx = point.x - from.position.x;
  const dz = point.z - from.position.z;
  const turn = to.yaw - from.yaw;
  const c = cos(turn);
  const s = sin(turn);
  return {
    x: to.position.x + dx * c + dz * s,
    y: point.y + to.position.y - from.position.y,
    z: to.position.z - dx * s + dz * c,
  };
}

/** A moving part in the physics world. */
export class Mover implements GroundCarrier {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  /** Pose before and after the last physics step, for render interpolation. */
  prevPose: MoverPose;
  pose: MoverPose;
  private nextPose: MoverPose;
  private readonly poseAt: (tick: number) => MoverPose;

  constructor(
    readonly def: MoverDef,
    world: PhysicsWorld,
    surfaces: SurfaceMap,
    /**
     * Where the part is at a tick, for a part that is not on the fixed schedule of its
     * `motion`: one that waits for a signal (see game/field/slider.ts).
     */
    schedule?: (tick: number) => MoverPose,
  ) {
    this.poseAt = schedule ?? ((tick) => moverPose(def, tick));
    this.pose = this.prevPose = this.poseAt(world.tick);
    this.nextPose = this.poseAt(world.tick + 1);
    const { position, yaw } = this.pose;
    this.body = world.raw.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(position.x, position.y, position.z)
        .setRotation(yawRotation(yaw)),
    );
    this.collider = world.raw.createCollider(
      RAPIER.ColliderDesc.cuboid(def.size[0] / 2, def.size[1] / 2, def.size[2] / 2)
        .setFriction(0)
        .setRestitution(getSurface(def.surface).restitution)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
      this.body,
    );
    surfaces.setCollider(this.collider.handle, 'mover', def.surface);
    surfaces.setCarrier(this.collider.handle, this);
  }

  /** Schedules the move for the coming step. Call before stepping the world. */
  preStep(world: PhysicsWorld, balls: readonly Ball[]): void {
    this.nextPose = this.poseAt(world.tick + 1);
    this.body.setNextKinematicTranslation(this.nextPose.position);
    this.body.setNextKinematicRotation(yawRotation(this.nextPose.yaw));
    if (this.def.role === 'platform') {
      // A platform only exists for a ball that is above its top. A ball rolling up to it
      // from level ground would otherwise trip on its edge (see tests/seams.test.ts).
      // One collider cannot be solid for one ball and absent for another: with several
      // balls about, it is there as soon as any of them is over it.
      this.collider.setCollisionGroups(balls.some((ball) => this.isUnder(ball.position())) ? SOLID : GHOST);
    }
  }

  /** Call after stepping the world. */
  postStep(): void {
    this.prevPose = this.pose;
    this.pose = this.nextPose;
  }

  /** Puts the part where its schedule has it right now, at once: after a state was put back. */
  snap(world: PhysicsWorld): void {
    this.pose = this.prevPose = this.nextPose = this.poseAt(world.tick);
    this.body.setTranslation(this.pose.position, true);
    this.body.setRotation(yawRotation(this.pose.yaw), true);
  }

  /** True when `point` is over the top face of the box. */
  isUnder(point: XYZ): boolean {
    const { position, yaw } = this.pose;
    const dx = point.x - position.x;
    const dz = point.z - position.z;
    const c = cos(yaw);
    const s = sin(yaw);
    const localX = dx * c - dz * s;
    const localZ = dx * s + dz * c;
    const [width, height, depth] = this.def.size;
    return Math.abs(localX) <= width / 2 && Math.abs(localZ) <= depth / 2 && point.y >= position.y + height / 2;
  }

  pointVelocity(point: XYZ): XYZ {
    const next = carry(point, this.pose, this.nextPose);
    return {
      x: (next.x - point.x) / FIXED_DT,
      y: (next.y - point.y) / FIXED_DT,
      z: (next.z - point.z) / FIXED_DT,
    };
  }

  /** True if a ball may not be left at `point` because of this mover. */
  forbidsRest(point: XYZ): boolean {
    return this.def.sweep !== undefined && shapeContains(this.def.sweep, point);
  }

  /** The safe spot nearest to `point`, if the hole data lists any. */
  nearestRest(point: XYZ): Vec3 | null {
    let best: Vec3 | null = null;
    let bestDistance = Infinity;
    for (const rest of this.def.rest ?? []) {
      const d = hypot(rest[0] - point.x, rest[1] - point.y, rest[2] - point.z);
      if (d < bestDistance) {
        bestDistance = d;
        best = rest;
      }
    }
    return best;
  }
}

function yawRotation(yaw: number): { x: number; y: number; z: number; w: number } {
  return { x: 0, y: sin(yaw / 2), z: 0, w: cos(yaw / 2) };
}
