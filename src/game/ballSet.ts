import type { Vec3, XYZ } from '../core/types';
import type { BallSize } from '../level/schema';
import { Ball, type BallProps } from '../physics/ball';
import type { PhysicsWorld } from '../physics/world';

/**
 * The balls of one round (SPEC v3 2.8). There is one until a split; any of them can
 * finish the hole, and the player picks which to play on with.
 */
export class BallSet {
  /** Balls in play, oldest first. */
  readonly live: Ball[] = [];
  /** Balls that dropped into a cup. They stay in the world, switched off, where they went in. */
  readonly sunk: Ball[] = [];
  /** The ball the next stroke is played with; after the last ball is sunk, that ball. */
  selected: Ball;
  private nextId = 0;

  constructor(
    private readonly world: PhysicsWorld,
    private readonly base: BallProps,
    tee: Vec3,
  ) {
    this.selected = this.add(tee);
  }

  /** Puts a new ball on the course. */
  add(position: Vec3 | XYZ, size: BallSize = 'medium'): Ball {
    const ball = new Ball(this.world, this.base, position, this.nextId++, size);
    this.live.push(ball);
    return ball;
  }

  /** The ball a collider belongs to, if it is one in play. */
  owner(colliderHandle: number): Ball | undefined {
    return this.live.find((ball) => ball.collider.handle === colliderHandle);
  }

  /** A ball dropped into a cup: it is out of play but stays where it is. */
  sink(ball: Ball): void {
    this.leave(ball);
    ball.body.setEnabled(false);
    this.sunk.push(ball);
  }

  /** Takes a ball off the course for good. Do not touch its body afterwards. */
  remove(ball: Ball): void {
    this.leave(ball);
    this.world.raw.removeRigidBody(ball.body);
  }

  private leave(ball: Ball): void {
    const at = this.live.indexOf(ball);
    if (at >= 0) this.live.splice(at, 1);
    if (this.selected === ball && this.live.length > 0) this.selected = this.live[0];
  }
}
