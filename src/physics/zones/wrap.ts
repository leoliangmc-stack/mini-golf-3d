import type { Vec2 } from '../../core/types';
import type { ZoneDef, ZoneFactory } from './index';

/**
 * How far the ground has to go on beyond an edge that is joined to the one across from
 * it, in metres. A ball is taken across on the first step after its middle has passed
 * the line, and until then it must have something to roll on.
 */
export const WRAP_APRON = 0.6;
/**
 * How far the pale ground beyond a joined edge usually goes on. A ball needs only
 * `WRAP_APRON` of it; the rest is where the picture of the other side is drawn.
 */
export const WRAP_SKIRT = 2.5;
/** How far above or below the hall's floor a ball's underside may be and still be in the hall. */
const WRAP_REACH = 0.6;

/** A hall whose edges are joined in pairs (SPEC v8 3.3), as its zone's data describes it. */
export interface Hall {
  min: Vec2;
  max: Vec2;
  /** Height of its floor. */
  y: number;
  /** The edges at `min[0]` and `max[0]` are one and the same: out of one, in by the other. */
  x: boolean;
  /** And the edges at `min[1]` and `max[1]`. */
  z: boolean;
  /** How far beyond a joined edge the other side is drawn. Drawing only. */
  skirt: number;
}

/**
 * Hole data for a hall with joined edges. A ball that rolls out over a joined edge
 * comes in over the one across from it, as fast as it went and no further along.
 *
 * The ground must go on for `WRAP_APRON` beyond each joined edge, at the hall's own
 * height, and nothing may stand within that distance of it on the inside either: what
 * a ball meets just before the line has to be what it meets just after.
 */
export function hall(min: Vec2, max: Vec2, joined: { x?: boolean; z?: boolean }, y = 0, skirt = WRAP_SKIRT): ZoneDef {
  return {
    type: 'wrap',
    shape: {
      kind: 'box',
      center: [(min[0] + max[0]) / 2, y + 0.5, (min[1] + max[1]) / 2],
      halfExtents: [(max[0] - min[0]) / 2, 0.5, (max[1] - min[1]) / 2],
    },
    params: { y, x: joined.x ?? false, z: joined.z ?? false, skirt },
  };
}

export function hallOf(def: ZoneDef): Hall {
  if (def.shape.kind !== 'box') throw new Error('A hall is a box');
  const [cx, , cz] = def.shape.center;
  const [hx, , hz] = def.shape.halfExtents;
  const y = def.params?.y;
  const skirt = def.params?.skirt;
  return {
    min: [cx - hx, cz - hz],
    max: [cx + hx, cz + hz],
    y: typeof y === 'number' ? y : 0,
    x: def.params?.x === true,
    z: def.params?.z === true,
    skirt: typeof skirt === 'number' ? skirt : WRAP_SKIRT,
  };
}

/** Where along one axis a ball that has just crossed a joined edge is put: `shift` is added to its place. */
function crossing(at: number, speed: number, min: number, max: number): number {
  // Only a ball going out over the line, and only just over it: one further off is
  // somewhere else on the course altogether.
  if (at > max && at <= max + WRAP_APRON && speed > 0) return min - max;
  if (at < min && at >= min - WRAP_APRON && speed < 0) return max - min;
  return 0;
}

/**
 * A hall with joined edges (SPEC v8 3.3). It has nothing to remember: where a ball is
 * and which way it is going say all there is to say, so the hall is in no snapshot.
 *
 * No pause follows a crossing. A ball is taken across only while it is going out over
 * the line, and it arrives going in, so nothing sends it straight back; a pause would
 * only let a fast ball in a small hall run off the far edge with nobody to catch it.
 */
export const wrap: ZoneFactory = (def) => {
  const { min, max, y, x, z } = hallOf(def);
  return {
    preStep(ctx) {
      const { ball } = ctx;
      if (!ball.body.isEnabled()) return;
      const p = ball.position();
      if (Math.abs(p.y - ball.props.radius - y) > WRAP_REACH) return;
      const v = ball.velocity();
      // Each pair is asked about by itself, so a ball that leaves by a corner crosses twice at once.
      const withinX = p.x >= min[0] - WRAP_APRON && p.x <= max[0] + WRAP_APRON;
      const withinZ = p.z >= min[1] - WRAP_APRON && p.z <= max[1] + WRAP_APRON;
      const dx = x && withinZ ? crossing(p.x, v.x, min[0], max[0]) : 0;
      const dz = z && withinX ? crossing(p.z, v.z, min[1], max[1]) : 0;
      if (dx === 0 && dz === 0) return;
      // Its speed is not touched, nor its place along the edge: only which side it is on.
      ball.body.setTranslation({ x: p.x + dx, y: p.y, z: p.z + dz }, true);
      ctx.snap();
      ctx.emit({ type: 'cue', name: 'wrap' });
    },
  };
};
