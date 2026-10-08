import type { XYZ } from '../core/types';
import { xyz } from '../core/types';
import type { CupGoal, GoalDef, KnockdownGoal, PinDef } from '../level/schema';
import { Pin, tiltCosine } from '../physics/props';
import type { SurfaceMap } from '../physics/surfaces';
import type { PhysicsWorld } from '../physics/world';
import { cupAnchor, cupIsLive, cupOpenAt, cupPositionAt, type CupPose } from './cup';

const DEFAULT_TILT = 60;

/** Every cup in a goal, in the order its steps come. */
export function goalCups(goal: GoalDef): CupGoal[] {
  if (goal.type === 'cup') return [goal];
  return goal.type === 'sequence' ? goal.steps.flatMap(goalCups) : [];
}

/** Every pin in a goal, in the order its steps come. */
export function goalPins(goal: GoalDef): PinDef[] {
  if (goal.type === 'knockdown') return [...goal.pins];
  return goal.type === 'sequence' ? goal.steps.flatMap(goalPins) : [];
}

/** Middle of a group of pins. */
function pinsAnchor(pins: readonly PinDef[]): XYZ {
  const sum = pins.reduce((acc, pin) => ({ x: acc.x + pin.at[0], y: acc.y + pin.at[1], z: acc.z + pin.at[2] }), {
    x: 0,
    y: 0,
    z: 0,
  });
  const n = Math.max(1, pins.length);
  return { x: sum.x / n, y: sum.y / n, z: sum.z / n };
}

/**
 * The point a goal is at, for the camera to keep in view with the ball: the middle of
 * a cup's track, the middle of a group of pins, the first step of a sequence.
 */
export function goalAnchor(goal: GoalDef): XYZ {
  if (goal.type === 'cup') return cupAnchor(goal);
  if (goal.type === 'knockdown') return pinsAnchor(goal.pins);
  return goal.steps.length > 0 ? goalAnchor(goal.steps[0]) : { x: 0, y: 0, z: 0 };
}

/** A cup while a round is on. */
export interface CupState {
  readonly def: CupGoal;
  /** It travels or has a lid: where it is and whether it is open depend on the tick. */
  readonly live: boolean;
  pose: CupPose;
  /** False for a cup whose turn has not come in a sequence: it is not there yet. */
  active: boolean;
  /** How many balls have dropped into it. */
  sunk: number;
}

/** The pins of one knockdown goal while a round is on. */
export interface PinGroup {
  readonly def: KnockdownGoal;
  readonly pins: Pin[];
  /** Cosine of the lean past which a pin counts as down. */
  readonly cosThreshold: number;
}

type Node =
  | { kind: 'cup'; cup: CupState }
  | { kind: 'pins'; group: PinGroup }
  | { kind: 'sequence'; steps: Node[] };

/**
 * A hole's goal while a round is on (SPEC v3 2.8): which cups and pins there are, which
 * of them the player is on, and whether the whole thing is done. The session moves the
 * cups, sinks the balls and topples the pins; this keeps the score.
 */
export class Goal {
  /** Every cup and every pin of the goal, in the order its steps come. */
  readonly cups: CupState[] = [];
  readonly pins: Pin[] = [];
  readonly groups: PinGroup[] = [];
  /** True if any cup travels or has a lid, so a ball lying still can still be taken. */
  readonly live: boolean;
  private readonly root: Node;

  constructor(def: GoalDef, world: PhysicsWorld, surfaces: SurfaceMap) {
    this.root = this.build(def, world, surfaces);
    this.live = this.cups.some((cup) => cup.live);
    this.refresh();
  }

  private build(def: GoalDef, world: PhysicsWorld, surfaces: SurfaceMap): Node {
    if (def.type === 'cup') {
      const at = cupPositionAt(def, world.tick);
      const cup: CupState = {
        def,
        live: cupIsLive(def),
        pose: { prevPosition: at, position: at, open: cupOpenAt(def, world.tick) },
        active: true,
        sunk: 0,
      };
      this.cups.push(cup);
      return { kind: 'cup', cup };
    }
    if (def.type === 'knockdown') {
      const group: PinGroup = {
        def,
        pins: def.pins.map((pin) => new Pin(pin, world, surfaces)),
        cosThreshold: tiltCosine(def.tiltThreshold ?? DEFAULT_TILT),
      };
      this.groups.push(group);
      this.pins.push(...group.pins);
      return { kind: 'pins', group };
    }
    // A cup ends the round for the ball that drops in, so a step with a cup in it can
    // only be the last: after an earlier one there would be no ball left to play the
    // rest with, and no way for the round to end.
    def.steps.forEach((step, i) => {
      if (i < def.steps.length - 1 && goalCups(step).length > 0) {
        throw new Error(`A cup in a goal sequence must be in its last step, not step ${i + 1} of ${def.steps.length}`);
      }
    });
    return { kind: 'sequence', steps: def.steps.map((step) => this.build(step, world, surfaces)) };
  }

  /** True once everything the goal asks for has been done. */
  get met(): boolean {
    return done(this.root);
  }

  /** Pins still standing, over the whole goal. */
  get pinsLeft(): number {
    return this.pins.filter((pin) => !pin.down).length;
  }

  /**
   * Works out which cups are there to be played for. Call after a ball is sunk or a pin
   * goes down. Returns the cups that have just appeared.
   */
  refresh(): CupState[] {
    const appeared: CupState[] = [];
    const visit = (node: Node, active: boolean): void => {
      if (node.kind === 'cup') {
        if (active && !node.cup.active) appeared.push(node.cup);
        node.cup.active = active;
      } else if (node.kind === 'sequence') {
        let open = active;
        for (const step of node.steps) {
          visit(step, open);
          open &&= done(step);
        }
      }
    };
    visit(this.root, true);
    return appeared;
  }

  /** Where the part of the goal the player is on right now is: the first step not done yet. */
  focus(): XYZ {
    const current = (node: Node): Node => {
      if (node.kind !== 'sequence' || node.steps.length === 0) return node;
      return current(node.steps.find((step) => !done(step)) ?? node.steps[node.steps.length - 1]);
    };
    const node = current(this.root);
    if (node.kind === 'cup') return cupAnchor(node.cup.def);
    if (node.kind === 'pins') {
      const standing = node.group.pins.filter((pin) => !pin.down);
      return pinsAnchor((standing.length > 0 ? standing : node.group.pins).map((pin) => pin.def));
    }
    return xyz([0, 0, 0]);
  }
}

function done(node: Node): boolean {
  if (node.kind === 'cup') return node.cup.sunk > 0;
  if (node.kind === 'pins') return node.group.pins.every((pin) => pin.down);
  return node.steps.every(done);
}
