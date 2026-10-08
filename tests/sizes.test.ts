import { beforeAll, describe, expect, it } from 'vitest';
import { playReplay } from '../src/game/replay';
import { Session } from '../src/game/session';
import type { HoleDef, PieceDef } from '../src/level/schema';
import { BALL_SIZES, DEFAULT_BALL, sizedProps } from '../src/physics/ball';
import { growPad, shrinkPad } from '../src/physics/zones/pads';
import { boxHole, runUntilSettled, setupEngine, stepTicks } from './helpers';

beforeAll(setupEngine);

const FALL = boxHole().zones[0];
const CUP = { radius: 0.22, captureSpeed: 3.5 };
const radius = (size: 'small' | 'medium' | 'large') => sizedProps(DEFAULT_BALL, size).radius;

/** A long walled lane along -Z, tee at z = 5. */
function lane(extra: Partial<HoleDef> = {}, more: PieceDef[] = []): HoleDef {
  return {
    ...boxHole({ tee: [0, 0, 5] }),
    pieces: [
      { type: 'floor', min: [-2, -10], max: [2, 7], surface: 'grass' },
      { type: 'wall', from: [-2, 7], to: [2, 7], surface: 'rail' },
      { type: 'wall', from: [2, 7], to: [2, -10], surface: 'rail' },
      { type: 'wall', from: [2, -10], to: [-2, -10], surface: 'rail' },
      { type: 'wall', from: [-2, -10], to: [-2, 7], surface: 'rail' },
      ...more,
    ],
    ...extra,
  };
}

/** A wall across the lane at z = 0 with an opening `width` metres wide in the middle. */
const gate = (width: number): PieceDef[] => [
  // A wall reaches half its thickness past each end, hence the 0.1.
  { type: 'wall', from: [-2, 0], to: [-width / 2 - 0.1, 0], surface: 'rail' },
  { type: 'wall', from: [width / 2 + 0.1, 0], to: [2, 0], surface: 'rail' },
];

const putt = (session: Session, power: number, x = 0) => {
  stepTicks(session, 10);
  expect(session.shoot({ x, y: 0, z: -1 }, power)).toBe(true);
  runUntilSettled(session);
};

describe('growing ball (SPEC v3 2.2)', () => {
  it('has three sizes: small is light and bouncy, large is wide and heavy', () => {
    expect(radius('small')).toBeLessThan(radius('medium'));
    expect(radius('large')).toBeGreaterThan(radius('medium'));
    expect(BALL_SIZES.small.mass).toBeLessThan(1);
    expect(BALL_SIZES.large.mass).toBeGreaterThan(10);
    expect(BALL_SIZES.small.bounciness).toBeGreaterThan(1);
    const session = new Session(lane());
    expect(session.ball.state.size).toBe('medium');
    expect(session.ball.props).toEqual(DEFAULT_BALL);
    session.dispose();
  });

  it('grows one size per pad and stops at large', () => {
    const session = new Session(lane({ zones: [FALL, growPad([0, 0, 3]), growPad([0, 0, 1]), growPad([0, 0, -1])] }));
    const sizes: string[] = [];
    session.on((event) => event.type === 'resized' && sizes.push(event.size));
    putt(session, 0.6);
    expect(sizes).toEqual(['large']);
    expect(session.ball.state.size).toBe('large');
    expect(session.ball.props.radius).toBeCloseTo(radius('large'), 9);
    expect(session.stats.cues.grow).toBe(1);
    session.dispose();
  });

  it('shrinks one size per pad and stops at small', () => {
    const session = new Session(lane({ zones: [FALL, shrinkPad([0, 0, 3]), shrinkPad([0, 0, 1])] }));
    putt(session, 0.6);
    expect(session.ball.state.size).toBe('small');
    expect(session.stats.cues.shrink).toBe(1);
    session.dispose();
  });

  it('stays on the ground while its size changes: no sinking in, no hop', () => {
    const session = new Session(
      lane({ zones: [FALL, growPad([0, 0, 3]), shrinkPad([0, 0, 1]), shrinkPad([0, 0, -1]), growPad([0, 0, -3])] }),
    );
    stepTicks(session, 10);
    session.shoot({ x: 0, y: 0, z: -1 }, 0.6);
    while (session.phase === 'rolling') {
      session.step();
      const underside = session.ball.position().y - session.ball.props.radius;
      expect(Math.abs(underside)).toBeLessThan(0.01);
    }
    expect(session.stats.cues).toMatchObject({ grow: 2, shrink: 2 });
    session.dispose();
  });

  it('works again only after the ball has left the pad and come back', () => {
    // The ball stops on the pad: it grew once on the way in, and resting there does nothing more.
    const session = new Session(lane({ zones: [FALL, shrinkPad([0, 0, 3.4])] }));
    putt(session, 0.13);
    expect(Math.abs(session.ball.position().z - 3.4)).toBeLessThan(0.45);
    expect(session.ball.state.size).toBe('small');
    stepTicks(session, 120);
    expect(session.stats.cues.shrink).toBe(1);
    // Struck off the pad and bounced back over it off the far wall, it would shrink again if it could.
    session.dispose();

    const back = new Session(lane({ zones: [FALL, growPad([0, 0, 3])] }, gate(0)));
    putt(back, 0.9);
    // Out over the pad, off the wall at z = 0, back over the pad.
    expect(back.stats.cues.grow).toBe(1);
    expect(back.ball.state.size).toBe('large');
    back.dispose();
  });

  it('lets only the small ball through a narrow gap', () => {
    const through = (zones: HoleDef['zones'], width: number) => {
      const session = new Session(lane({ zones: [FALL, ...zones] }, gate(width)));
      putt(session, 0.5);
      const passed = session.ball.position().z < 0;
      session.dispose();
      return passed;
    };
    expect(through([shrinkPad([0, 0, 3.5])], 0.16)).toBe(true);
    expect(through([], 0.16)).toBe(false);
    expect(through([growPad([0, 0, 3.5])], 0.16)).toBe(false);
    // A wider gap takes the medium ball too, but never the large one.
    expect(through([], 0.26)).toBe(true);
    expect(through([growPad([0, 0, 3.5])], 0.26)).toBe(false);
  });

  it('lets only the small ball under a low bar, however hard the others are hit', () => {
    const under = (zones: HoleDef['zones'], clearance: number, power: number) => {
      const bar: PieceDef = { type: 'beam', from: [-2, 0], to: [2, 0], clearance, surface: 'rail' };
      const session = new Session(lane({ zones: [FALL, ...zones] }, [bar]));
      putt(session, power, 0.1);
      const passed = session.ball.position().z < 0;
      session.dispose();
      return passed;
    };
    for (const power of [0.4, 0.7, 1]) {
      expect(under([shrinkPad([0, 0, 3.5], 1.5)], 0.16, power)).toBe(true);
      expect(under([], 0.16, power)).toBe(false);
      expect(under([], 0.26, power)).toBe(true);
      expect(under([growPad([0, 0, 3.5], 1.5)], 0.26, power)).toBe(false);
    }
  });

  it('a crate corked into a doorway cannot be squeezed past, only pushed through', () => {
    const jamb = 0.62;
    const door: PieceDef[] = [
      { type: 'wall', from: [-2, 0], to: [-jamb, 0], surface: 'rail' },
      { type: 'wall', from: [jamb, 0], to: [2, 0], surface: 'rail' },
      { type: 'wall', from: [-jamb, 0.6], to: [-jamb, -0.6], surface: 'rail' },
      { type: 'wall', from: [jamb, 0.6], to: [jamb, -0.6], surface: 'rail' },
    ];
    const crates = [{ size: [1, 0.5, 0.6] as const, at: [0, 0, 0] as const, mass: 4, surface: 'crate' }];
    // The medium ball, hard and from every angle that reaches the doorway.
    for (let x = -0.4; x <= 0.4; x += 0.05) {
      const session = new Session(lane({ crates }, door));
      putt(session, 1, x);
      expect(session.ball.position().z).toBeGreaterThan(0);
      expect(Math.abs(session.crates[0].pose.position.z)).toBeLessThan(0.05);
      session.dispose();
    }
    const large = new Session(lane({ crates, zones: [FALL, growPad([0, 0, 3.5], 1.5)] }, door));
    putt(large, 1);
    expect(large.crates[0].pose.position.z).toBeLessThan(-1);
    large.dispose();
  });

  it('lets only the large ball shove a crate', () => {
    const shove = (zones: HoleDef['zones']) => {
      const session = new Session(
        lane({ zones: [FALL, ...zones], crates: [{ size: [0.9, 0.5, 0.9], at: [0, 0, 0], surface: 'crate' }] }),
      );
      putt(session, 1);
      const moved = -session.crates[0].pose.position.z;
      // The stroke is not over until the crate has stopped.
      expect(session.crates[0].quiet()).toBe(true);
      session.dispose();
      return moved;
    };
    expect(shove([])).toBeLessThan(0.02);
    expect(shove([shrinkPad([0, 0, 3.5])])).toBeLessThan(0.02);
    expect(shove([growPad([0, 0, 3.5])])).toBeGreaterThan(1);
  });

  it('a cup with a size takes only that size', () => {
    const hole = (zones: HoleDef['zones'], acceptSize: 'small' | 'large' | 'any') =>
      lane({ zones: [FALL, ...zones], goal: { type: 'cup', position: [0, 0, -2], ...CUP, acceptSize } });
    const holed = (def: HoleDef) => {
      const session = new Session(def);
      putt(session, 0.42);
      const result = session.outcome?.holed ?? false;
      session.dispose();
      return result;
    };
    expect(holed(hole([], 'any'))).toBe(true);
    expect(holed(hole([], 'small'))).toBe(false);
    expect(holed(hole([shrinkPad([0, 0, 3.5])], 'small'))).toBe(true);
    expect(holed(hole([shrinkPad([0, 0, 3.5])], 'large'))).toBe(false);
    expect(holed(hole([growPad([0, 0, 3.5])], 'large'))).toBe(true);
  });

  it('is pushed clear of a wall it grows into (SPEC v3 5.3 #4)', () => {
    // The pad lies against the side rail: the ball rolls along the rail and grows there.
    const session = new Session(lane({ tee: [1.75, 0, 5], zones: [FALL, growPad([1.6, 0, 2], 0.6)] }));
    stepTicks(session, 10);
    session.shoot({ x: 0, y: 0, z: -1 }, 0.5);
    let grown = false;
    while (session.phase === 'rolling') {
      session.step();
      const p = session.ball.position();
      const r = session.ball.props.radius;
      grown ||= session.ball.state.size === 'large';
      // The rail's face is at x = 1.9. The ball is never inside it, nor under the floor.
      expect(p.x + r).toBeLessThan(1.9 + 0.005);
      expect(p.y - r).toBeGreaterThan(-0.01);
      expect(Math.abs(session.ball.velocity().x)).toBeLessThan(3);
    }
    expect(grown).toBe(true);
    expect(session.stats.outOfBounds).toBe(0);
    session.dispose();
  });

  it('comes back at the size it was struck at after going out of bounds', () => {
    // No back wall: a hard stroke over the grow pad runs off the end of the lane.
    const open: HoleDef = {
      ...boxHole({ tee: [0, 0, 5] }),
      pieces: [{ type: 'floor', min: [-2, -4], max: [2, 7], surface: 'grass' }],
      zones: [FALL, growPad([0, 0, 3])],
    };
    const session = new Session(open);
    stepTicks(session, 10);
    session.shoot({ x: 0, y: 0, z: -1 }, 1);
    let large = false;
    while (session.phase === 'rolling') {
      session.step();
      large ||= session.ball.state.size === 'large';
    }
    expect(large).toBe(true);
    expect(session.stats.outOfBounds).toBe(1);
    expect(session.strokes).toBe(2);
    expect(session.ball.state.size).toBe('medium');
    expect(session.ball.position().y).toBeCloseTo(radius('medium'), 3);
    session.dispose();
  });

  it('replays exactly', () => {
    const hole = lane({
      zones: [FALL, growPad([0, 0, 3]), shrinkPad([0.5, 0, -3])],
      crates: [{ size: [0.9, 0.5, 0.9], at: [0, 0, 0], surface: 'crate' }],
      goal: { type: 'cup', position: [1, 0, -8], ...CUP },
    });
    const session = new Session(hole);
    putt(session, 0.9);
    stepTicks(session, 20);
    session.shoot({ x: 0.4, y: 0, z: -1 }, 0.5);
    runUntilSettled(session);
    const inputs = session.inputs;
    const first = playReplay(hole, inputs) ?? session.ball.position();
    expect(playReplay(hole, inputs) ?? session.ball.position()).toStrictEqual(first);
    session.dispose();
  });
});
