import { hypot } from '../core/math';
import type { Vec3, XYZ } from '../core/types';
import { length } from '../core/types';
import type { BallSize } from '../level/schema';
import { RAPIER } from './rapier';
import type { PhysicsWorld } from './world';

/** Ball layer: properties that belong to the ball itself, not to the ground or a zone. */
export interface BallProps {
  radius: number;
  mass: number;
  /** Multiplier applied to the restitution of whatever surface the ball lands on. */
  bounciness: number;
}

/** The medium ball: the one every hole starts with. */
export const DEFAULT_BALL: BallProps = { radius: 0.1, mass: 0.05, bounciness: 1 };

/**
 * How each size differs from the medium ball, as multipliers (SPEC v3 2.2). A small
 * ball fits through gaps, is thrown about by anything that hits it and bounces higher;
 * a large one is too wide for them and heavy enough to shove crates. Mutable for tuning.
 */
export const BALL_SIZES: Record<BallSize, BallProps> = {
  small: { radius: 0.6, mass: 0.3, bounciness: 1.4 },
  medium: { radius: 1, mass: 1, bounciness: 1 },
  large: { radius: 1.7, mass: 40, bounciness: 0.75 },
};

/** Sizes in order, for growing and shrinking one step at a time. */
export const SIZE_ORDER: readonly BallSize[] = ['small', 'medium', 'large'];

export function sizedProps(base: BallProps, size: BallSize): BallProps {
  const scale = BALL_SIZES[size];
  return {
    radius: base.radius * scale.radius,
    mass: base.mass * scale.mass,
    bounciness: base.bounciness * scale.bounciness,
  };
}

/** State that travels with one ball (SPEC v3 2.8). Later mechanics add their fields here. */
export interface BallState {
  size: BallSize;
}

/** Ball position at the last two physics steps, for render interpolation. */
export interface BallPose {
  prevPosition: XYZ;
  position: XYZ;
}

/** Balls are in a collision group of their own and do not collide with each other. */
const BALL_GROUPS = 0x0001fffe;

export class Ball {
  readonly body: RAPIER.RigidBody;
  /** Replaced whenever the ball changes size: look it up afresh, never keep it. */
  collider: RAPIER.Collider;
  /** What the ball is like at its current size. */
  props: BallProps;
  state: BallState;
  pose: BallPose;

  constructor(
    private readonly world: PhysicsWorld,
    /** The medium ball this one is a size of. */
    readonly base: BallProps,
    position: Vec3 | XYZ,
    /** Tells balls of one round apart; stable for as long as the ball exists. */
    readonly id = 0,
    size: BallSize = 'medium',
  ) {
    const at = Array.isArray(position) ? { x: position[0], y: position[1], z: position[2] } : (position as XYZ);
    this.state = { size };
    this.props = sizedProps(base, size);
    this.body = world.raw.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(at.x, at.y, at.z)
        .setCcdEnabled(true)
        // The ball is simulated as a frictionless, non-rotating sphere: how it slows
        // down is decided by the Surface layer, not by solver friction. Rapier caps
        // angular velocity at 45 degrees per step, so a physically spinning ball this
        // size starts skidding above ~4.7 m/s and loses speed unpredictably.
        .lockRotations()
        // Stop detection is a game rule (see game/rules.ts), not a solver decision.
        .setCanSleep(false),
    );
    this.collider = this.createCollider();
    const start = { x: at.x, y: at.y, z: at.z };
    this.pose = { prevPosition: start, position: start };
  }

  // Restitution is overwritten every step from the surface under the ball; see
  // level/physicsBuilder.ts for how it combines with floors and walls.
  private createCollider(): RAPIER.Collider {
    return this.world.raw.createCollider(
      RAPIER.ColliderDesc.ball(this.props.radius)
        .setMass(this.props.mass)
        .setFriction(0)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setRestitution(0)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Average)
        .setCollisionGroups(BALL_GROUPS)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.body,
    );
  }

  position(): XYZ {
    return this.body.translation();
  }

  velocity(): XYZ {
    return this.body.linvel();
  }

  speed(): number {
    return length(this.body.linvel());
  }

  halt(): void {
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  teleport(position: XYZ): void {
    this.body.setTranslation(position, true);
    this.halt();
  }

  /** Starts the ball rolling along `dir`, flattened onto the (always level) course floor. */
  launch(dir: XYZ, speed: number): boolean {
    const len = hypot(dir.x, dir.z);
    if (len < 1e-6) return false;
    this.body.setLinvel({ x: (dir.x / len) * speed, y: 0, z: (dir.z / len) * speed }, true);
    return true;
  }

  /**
   * Makes the ball a different size: a new collider with the new radius and mass. The
   * ball's underside stays where it was, `up` being the way away from the ground. It may
   * now overlap a wall; `fitBall` (physics/fit.ts) moves it clear. Returns false if it
   * already is that size.
   */
  setSize(size: BallSize, up: XYZ): boolean {
    if (size === this.state.size) return false;
    const before = this.props.radius;
    const restitution = this.collider.restitution();
    this.state = { ...this.state, size };
    this.props = sizedProps(this.base, size);
    this.world.raw.removeCollider(this.collider, false);
    this.collider = this.createCollider();
    this.collider.setRestitution(restitution);
    const lift = this.props.radius - before;
    const p = this.body.translation();
    this.body.setTranslation({ x: p.x + up.x * lift, y: p.y + up.y * lift, z: p.z + up.z * lift }, true);
    return true;
  }

  /** Call after every physics step. `snap` keeps a jump from being drawn as motion. */
  recordPose(snap: boolean): void {
    const position = { ...this.body.translation() };
    this.pose = { prevPosition: snap ? position : this.pose.position, position };
  }
}
