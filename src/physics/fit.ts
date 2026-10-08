import type { Ball } from './ball';
import { RAPIER } from './rapier';
import type { PhysicsWorld } from './world';

const NO_TURN = { x: 0, y: 0, z: 0, w: 1 };
/** A few passes: clearing one wall can push the ball into the next one, e.g. in a corner. */
const PASSES = 8;
/** The ball is left this far clear of what it was pushed out of, in metres. */
const CLEARANCE = 1e-3;

/**
 * Moves a ball that overlaps the course to the nearest spot where it fits. A ball that
 * has just grown can be part way into a wall or the ground (SPEC v3 3); left there, the
 * solver would fling it out or let it through.
 *
 * Only things that cannot give way count: ground, walls and moving parts. Crates and
 * pins are pushed aside by the solver instead.
 */
export function fitBall(world: PhysicsWorld, ball: Ball): void {
  const shape = new RAPIER.Ball(ball.props.radius);
  for (let pass = 0; pass < PASSES; pass++) {
    const at = { ...ball.body.translation() };
    let deepest = 0;
    let push = { x: 0, y: 0, z: 0 };
    world.raw.intersectionsWithShape(at, NO_TURN, shape, (collider) => {
      if (collider.parent()?.isDynamic()) return true;
      const contact = collider.contactShape(shape, at, NO_TURN, 0);
      // `normal1` points out of the collider, toward the ball.
      if (contact && contact.distance < -deepest) {
        deepest = -contact.distance;
        push = contact.normal1;
      }
      return true;
    });
    if (deepest <= 0) return;
    const d = deepest + CLEARANCE;
    ball.body.setTranslation({ x: at.x + push.x * d, y: at.y + push.y * d, z: at.z + push.z * d }, true);
  }
}
