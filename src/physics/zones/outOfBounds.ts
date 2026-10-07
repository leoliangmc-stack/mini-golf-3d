import type { ZoneFactory } from './index';
import { shapeContains } from './shape';

/** Reports the ball as out of bounds while its center is inside the zone. */
export const outOfBounds: ZoneFactory = (def) => ({
  preStep(ctx) {
    if (shapeContains(def.shape, ctx.ball.position())) ctx.emit({ type: 'outOfBounds' });
  },
});
