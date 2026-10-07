import { vectorParam, type ZoneFactory } from './index';
import { shapeContains } from './shape';

/**
 * While the ball is inside, gravity points along `gravity` (a vector in m/s^2) instead
 * of straight down. Outside, normal gravity returns by itself: the game resets it
 * before the zones run each step.
 */
export const gravity: ZoneFactory = (def) => {
  const pull = vectorParam(def, 'gravity');
  return {
    preStep({ world, ball }) {
      if (shapeContains(def.shape, ball.position())) world.setGravity(pull);
    },
  };
};
