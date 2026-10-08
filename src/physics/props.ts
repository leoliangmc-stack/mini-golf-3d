import { cos, sin } from '../core/math';
import type { XYZ } from '../core/types';
import type { CrateDef, PinDef } from '../level/schema';
import { RAPIER } from './rapier';
import { getSurface, type GroundCarrier, type SurfaceMap } from './surfaces';
import type { PhysicsWorld } from './world';

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** Where a loose object is and how it is turned. */
export interface PropPose {
  position: XYZ;
  rotation: Quaternion;
}

const RAD = Math.PI / 180;
const NO_TURN: Quaternion = { x: 0, y: 0, z: 0, w: 1 };
/** A prop moving slower than this, in m/s and rad/s, is taken to have come to rest. */
const QUIET_SPEED = 0.05;
const QUIET_SPIN = 0.3;

/**
 * A loose object the solver moves: a crate, a pin. Unlike moving parts these are not on
 * a schedule, but Rapier's deterministic build makes them just as reproducible.
 *
 * Props do not use continuous collision detection themselves. The ball does, and
 * between two bodies that both do, Rapier lets a fast ball sink deep into a crate, or
 * come out the far side of a thin one (tests/sizes.test.ts).
 */
export class Prop {
  /** Pose before and after the last physics step, for render interpolation. */
  prevPose: PropPose;
  pose: PropPose;

  constructor(
    readonly body: RAPIER.RigidBody,
    readonly collider: RAPIER.Collider,
  ) {
    this.pose = this.prevPose = this.read();
  }

  private read(): PropPose {
    return { position: { ...this.body.translation() }, rotation: { ...this.body.rotation() } };
  }

  /** Call after stepping the world. */
  postStep(): void {
    this.prevPose = this.pose;
    this.pose = this.read();
  }

  /** Takes the prop out of the simulation where it is. */
  remove(): void {
    this.body.setEnabled(false);
  }

  /** True once the prop has dropped this far below `y`: it has left the course. */
  fellBelow(y: number): boolean {
    return this.body.translation().y < y;
  }

  /** True while the prop is not going anywhere: at rest, or taken off the course. */
  quiet(): boolean {
    if (!this.body.isEnabled()) return true;
    const v = this.body.linvel();
    const w = this.body.angvel();
    return (
      v.x * v.x + v.y * v.y + v.z * v.z < QUIET_SPEED * QUIET_SPEED &&
      w.x * w.x + w.y * w.y + w.z * w.z < QUIET_SPIN * QUIET_SPIN
    );
  }
}

const DEFAULT_CRATE_MASS = 6;
/**
 * How crates grip the ground, which is what stops them. Loose objects multiply their
 * friction with the other side's: the ground's is 1, the ball's is 0, so the ball
 * still slides off them freely.
 */
const CRATE_FRICTION = 0.55;
/** A crate this far below where it stood has left the course. */
const CRATE_FALL = 3;

/** A loose box (SPEC v3 2.2). It slides; it never turns or tips. */
export class Crate extends Prop implements GroundCarrier {
  constructor(
    readonly def: CrateDef,
    world: PhysicsWorld,
    surfaces: SurfaceMap,
  ) {
    const [width, height, depth] = def.size;
    const yaw = (def.yaw ?? 0) * RAD;
    const body = world.raw.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(def.at[0], def.at[1] + height / 2, def.at[2])
        .setRotation({ x: 0, y: sin(yaw / 2), z: 0, w: cos(yaw / 2) })
        // A crate that could turn would be levered aside by a glancing hit from any
        // ball, and let it squeeze past. It slides, and that is all it does.
        .lockRotations(),
    );
    const collider = world.raw.createCollider(
      RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2)
        .setMass(def.mass ?? DEFAULT_CRATE_MASS)
        .setFriction(CRATE_FRICTION)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply)
        .setRestitution(getSurface(def.surface).restitution)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
      body,
    );
    super(body, collider);
    surfaces.setCollider(collider.handle, 'prop', def.surface);
    surfaces.setCarrier(collider.handle, this);
  }

  pointVelocity(): XYZ {
    return this.body.linvel();
  }

  /** True if the crate has dropped off the course. */
  offCourse(): boolean {
    return this.fellBelow(this.def.at[1] - CRATE_FALL);
  }
}

/**
 * What a pin is like. Mutable for tuning.
 *
 * A real pin weighs about a fifth of the ball that knocks it over; here it is the medium
 * golf ball doing the knocking, so the pin is lighter still. Its weight sits low, as in
 * a real pin, and it grips the ground, so it topples rather than skates away.
 */
export const PIN = {
  radius: 0.075,
  height: 0.44,
  /** In kilograms. The medium ball weighs 0.05. */
  mass: 0.006,
  /** Height of the centre of mass above the ground, as a share of the pin's height. */
  balance: 0.36,
  friction: 0.6,
  bounce: 0.3,
};
/**
 * How quickly a pin's spin dies away, in 1/s. A pin knocked without falling would
 * otherwise wobble round on its rim, and wander, for a very long time.
 */
const PIN_SPIN_DRAG = 2;
/** A fallen pin is slowed like this, in 1/s, so it does not roll about for long. */
const FALLEN_DRAG = 3;
/** A pin this far below where it stood has left the course, and counts as down. */
const PIN_FALL = 1;

/** A bowling pin (SPEC v3 2.5): an upright cylinder that falls over when hit. */
export class Pin extends Prop {
  /** True once the pin has been knocked down. It stays down. */
  down = false;
  private readonly startY: number;

  constructor(
    readonly def: PinDef,
    world: PhysicsWorld,
    surfaces: SurfaceMap,
  ) {
    const body = world.raw.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(def.at[0], def.at[1] + PIN.height / 2, def.at[2])
        .setAngularDamping(PIN_SPIN_DRAG),
    );
    const { radius: r, height: h, mass } = PIN;
    // A solid cylinder's resistance to turning: about a level axis, then about its own.
    const tip = (mass * (3 * r * r + h * h)) / 12;
    const spin = (mass * r * r) / 2;
    const collider = world.raw.createCollider(
      RAPIER.ColliderDesc.cylinder(h / 2, r)
        .setMassProperties(mass, { x: 0, y: (PIN.balance - 0.5) * h, z: 0 }, { x: tip, y: spin, z: tip }, NO_TURN)
        .setFriction(PIN.friction)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply)
        .setRestitution(PIN.bounce)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
      body,
    );
    super(body, collider);
    this.startY = def.at[1] + PIN.height / 2;
    surfaces.setCollider(collider.handle, 'prop', 'pin');
  }

  /**
   * True if the pin leans further from upright than the angle whose cosine is
   * `cosThreshold`, or has dropped off the course.
   */
  toppled(cosThreshold: number): boolean {
    const { x, z } = this.body.rotation();
    // The y component of the pin's own up axis: 1 upright, 0 lying flat.
    const upright = 1 - 2 * (x * x + z * z);
    return upright < cosThreshold || this.offCourse();
  }

  /** True if the pin has dropped off the course. */
  offCourse(): boolean {
    return this.fellBelow(this.startY - PIN_FALL);
  }

  /** Marks the pin as knocked down. */
  fall(): void {
    this.down = true;
    this.body.setLinearDamping(FALLEN_DRAG);
    this.body.setAngularDamping(FALLEN_DRAG);
  }
}

/** Cosine of a tilt threshold given in degrees. */
export const tiltCosine = (degrees: number): number => cos(degrees * RAD);
