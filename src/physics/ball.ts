import type { Vec3, XYZ } from '../core/types';
import { length } from '../core/types';
import { RAPIER } from './rapier';
import type { PhysicsWorld } from './world';

/** Ball layer: properties that belong to the ball itself, not to the ground or a zone. */
export interface BallProps {
  radius: number;
  mass: number;
  /** Multiplier applied to the restitution of whatever surface the ball lands on. */
  bounciness: number;
}

export const DEFAULT_BALL: BallProps = { radius: 0.1, mass: 0.05, bounciness: 1 };

export class Ball {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;

  constructor(
    world: PhysicsWorld,
    readonly props: BallProps,
    position: Vec3,
  ) {
    this.body = world.raw.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position[0], position[1], position[2])
        .setCcdEnabled(true)
        // The ball is simulated as a frictionless, non-rotating sphere: how it slows
        // down is decided by the Surface layer, not by solver friction. Rapier caps
        // angular velocity at 45 degrees per step, so a physically spinning ball this
        // size starts skidding above ~4.7 m/s and loses speed unpredictably.
        .lockRotations()
        // Stop detection is a game rule (see game/rules.ts), not a solver decision.
        .setCanSleep(false),
    );
    // Restitution is overwritten every step from the surface under the ball; see
    // level/physicsBuilder.ts for how it combines with floors and walls.
    this.collider = world.raw.createCollider(
      RAPIER.ColliderDesc.ball(props.radius)
        .setMass(props.mass)
        .setFriction(0)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setRestitution(0)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Average)
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
    const len = Math.hypot(dir.x, dir.z);
    if (len < 1e-6) return false;
    this.body.setLinvel({ x: (dir.x / len) * speed, y: 0, z: (dir.z / len) * speed }, true);
    return true;
  }
}
