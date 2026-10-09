import { cos, halfAngle, hypot, sin } from '../../core/math';
import type { XYZ } from '../../core/types';
import type { RotorDef } from '../../level/field';
import { RAPIER } from '../../physics/rapier';
import { getSurface } from '../../physics/surfaces';
import { ground, type Field, type Turnable } from './field';

const RAD = Math.PI / 180;
export const ROTOR_HEIGHT = 0.5;
export const ROTOR_THICKNESS = 0.22;
/** Ticks a group takes to swing through its quarter turn: what the eye sees, and how long no stroke can be played. */
export const ROTOR_TICKS = 14;
/** Room kept between the sweep of its arms and a ball, on top of the ball's own radius. */
const ROTOR_CLEARANCE = 0.08;
/** How far above the ground it stands on, or below it, a ball's underside may be and still be in the way. */
const ROTOR_REACH = { up: ROTOR_HEIGHT + 0.2, down: 0.3 };

/** Rotation about +Y for each number of quarter turns clockwise, seen from above. Exact, so every turn lands square. */
const QUARTERS = [
  { x: 0, y: 0, z: 0, w: 1 },
  { x: 0, y: -Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
  { x: 0, y: 1, z: 0, w: 0 },
  { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
];

/**
 * A group of walls on a pivot (SPEC v7 3.5). The player gives it a quarter turn at a
 * touch; nothing a ball does moves it. To a ball it is a wall like any other, and it is
 * in its new place the moment it is turned: only the picture takes time, as with a gate.
 * That is safe because it cannot be turned while a ball lies anywhere its arms sweep,
 * and no stroke can be played until the picture has caught up.
 *
 * Its signal: it stands some other way than it started.
 */
export class Rotor implements Turnable {
  readonly kind = 'rotor';
  readonly anchor: XYZ;
  /** Quarter turns clockwise from how its data draws it, 0 to 3. */
  quarter: number;
  private readonly start: number;
  /** Ticks left of the swing; 0 when it stands. */
  private left = 0;
  private readonly body: RAPIER.RigidBody;

  constructor(
    readonly def: RotorDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    if (def.arms.length === 0) throw new Error(`Rotor "${id}" has no arms`);
    if (!(def.length > 0)) throw new Error(`Rotor "${id}" needs arms of some length`);
    this.anchor = ground(def.at);
    this.start = this.quarter = (((def.start ?? 0) % 4) + 4) % 4;
    const height = def.height ?? ROTOR_HEIGHT;
    const half = (def.thickness ?? ROTOR_THICKNESS) / 2;
    const surface = def.surface ?? 'rotor';
    const { world, surfaces } = field.host;
    this.body = world.raw.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(def.at[0], def.at[1], def.at[2])
        .setRotation(QUARTERS[this.quarter]),
    );
    for (const heading of def.arms) {
      // An arm starts half a thickness behind the pivot, so that arms meeting there
      // leave no notch between them for a ball to catch in.
      const dir = { x: sin(heading * RAD), z: -cos(heading * RAD) };
      const middle = (def.length - half) / 2;
      // Local -Z runs along the arm.
      const turn = halfAngle(-dir.x, -dir.z);
      const collider = world.raw.createCollider(
        RAPIER.ColliderDesc.cuboid(half, height / 2 + 0.15, (def.length + half) / 2)
          .setTranslation(dir.x * middle, height / 2 - 0.15, dir.z * middle)
          .setRotation({ x: 0, y: turn.sin, z: 0, w: turn.cos })
          .setFriction(0)
          .setRestitution(getSurface(surface).restitution)
          .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
        this.body,
      );
      surfaces.setCollider(collider.handle, 'wall', surface);
      field.own(collider.handle, this);
    }
  }

  get on(): boolean {
    return this.quarter !== this.start;
  }

  get turning(): boolean {
    return this.left > 0;
  }

  get busy(): boolean {
    return this.left > 0;
  }

  /** How far through its swing it is, 0 to 1: for the picture. */
  get swing(): number {
    return 1 - this.left / ROTOR_TICKS;
  }

  /** What a tap on it would come to, for the picture: a turn, nothing because a ball is in the way, or nothing because the hole's turns are used up. */
  get state(): 'ready' | 'blocked' | 'spent' {
    if (this.field.turnsLeft <= 0) return 'spent';
    return this.blocked ? 'blocked' : 'ready';
  }

  /** Compass headings its arms reach out along as it stands now. */
  get headings(): number[] {
    return this.def.arms.map((heading) => (heading + this.quarter * 90) % 360);
  }

  /** True if a ball lies anywhere the arms pass over in a turn: within their reach of the pivot. */
  get blocked(): boolean {
    const { at, length } = this.def;
    for (const ball of this.field.host.balls()) {
      if (!ball.body.isEnabled()) continue;
      const p = ball.position();
      const height = p.y - ball.props.radius - at[1];
      if (height > ROTOR_REACH.up || height < -ROTOR_REACH.down) continue;
      if (hypot(p.x - at[0], p.z - at[2]) <= length + ball.props.radius + ROTOR_CLEARANCE) return true;
    }
    return false;
  }

  turn(): void {
    this.quarter = (this.quarter + 1) % 4;
    this.left = ROTOR_TICKS;
    this.body.setRotation(QUARTERS[this.quarter], true);
    this.field.host.cue('rotorTurn');
  }

  step(): void {
    if (this.left > 0 && --this.left === 0) this.field.host.cue('rotorStop');
  }

  save(): number {
    return this.quarter;
  }

  load(state: unknown): void {
    this.quarter = state as number;
    this.left = 0;
    this.body.setRotation(QUARTERS[this.quarter], true);
  }
}
