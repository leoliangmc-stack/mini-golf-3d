import { FIXED_DT } from '../../core/loop';
import { halfAngle, hypot } from '../../core/math';
import type { XYZ } from '../../core/types';
import type { Cell, GateDef, PlateDef, StoneDef } from '../../level/field';
import type { Ball } from '../../physics/ball';
import { RAPIER } from '../../physics/rapier';
import { getSurface } from '../../physics/surfaces';
import { Drive, ground, midpoint, type Field, type Part } from './field';

/**
 * True if the ball is within `radius` of a point on the ground, now or at any moment of
 * the coming step: a fast ball must not skip over something small. A ball in the air
 * above the point is too high to touch it.
 */
export function ballNear(ball: Ball, at: XYZ, radius: number, reach = 0.25): boolean {
  if (!ball.body.isEnabled()) return false;
  const p = ball.position();
  if (Math.abs(p.y - ball.props.radius - at.y) > reach) return false;
  const v = ball.velocity();
  for (const t of [0, 0.5, 1]) {
    if (hypot(p.x + v.x * FIXED_DT * t - at.x, p.z + v.z * FIXED_DT * t - at.z) <= radius) return true;
  }
  return false;
}

const PLATE_RADIUS = 0.45;

/**
 * A plate in the ground (SPEC v4 3.3). Its signal: for a `hold` plate, something is on
 * it right now; for a `latch` plate, something has been.
 */
export class Plate implements Part {
  readonly kind = 'plate';
  readonly anchor: XYZ;
  readonly radius: number;
  readonly busy = false;
  /** Something is standing on it right now. */
  pressed = false;
  private latched = false;

  constructor(
    readonly def: PlateDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.anchor = ground(def.at);
    this.radius = def.radius ?? PLATE_RADIUS;
  }

  get on(): boolean {
    return this.def.mode === 'latch' ? this.latched : this.pressed;
  }

  step(): void {
    const now = this.loaded();
    if (now !== this.pressed) this.field.host.cue(now ? 'plateDown' : 'plateUp');
    this.pressed = now;
    if (now) this.latched = true;
  }

  private loaded(): boolean {
    for (const stone of this.field.all<Stone>('stone')) {
      if (stone.sliding) continue;
      // Where the stone stands, on the ground.
      const at = stone.anchor;
      if (Math.abs(at.y - this.anchor.y) < 0.1 && hypot(at.x - this.anchor.x, at.z - this.anchor.z) <= this.radius) return true;
    }
    return this.field.host.balls().some((ball) => ballNear(ball, this.anchor, this.radius));
  }

  save(): boolean {
    return this.latched;
  }

  load(state: unknown): void {
    this.latched = state as boolean;
  }

  resync(): void {
    this.pressed = this.loaded();
  }
}

const GATE_HEIGHT = 0.8;
const GATE_THICKNESS = 0.24;
/** Ticks a gate takes to sink into the ground or rise out of it: what the eye sees. */
const GATE_TICKS = 14;
/** Room kept between a shutting gate and a ball, on top of the ball's own radius. */
const GATE_CLEARANCE = 0.06;

interface GateState {
  drive: ReturnType<Drive['save']>;
  open: boolean;
}

/**
 * A slab across a doorway (SPEC v4 3.3). It opens the moment its signal arrives and
 * shuts the moment the signal goes, both at once as far as the ball is concerned; the
 * picture follows over a few ticks. It never shuts on a ball or a stone: it waits until
 * the doorway is empty. Its signal: it has done what was asked and has finished moving.
 */
export class Gate implements Part {
  readonly kind = 'gate';
  readonly anchor: XYZ;
  readonly drive: Drive;
  /** Nothing in the doorway: a ball can pass. */
  open: boolean;
  /** How far the slab has sunk, in ticks, from 0 (shut) to GATE_TICKS (open). */
  private travel: number;
  private readonly collider: RAPIER.Collider;
  private readonly halfLength: number;
  private readonly halfThickness: number;
  private readonly along: { x: number; z: number };

  constructor(
    readonly def: GateDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    const y = def.y ?? 0;
    const height = def.height ?? GATE_HEIGHT;
    const dx = def.to[0] - def.from[0];
    const dz = def.to[1] - def.from[1];
    const length = hypot(dx, dz);
    if (length < 1e-6) throw new Error(`Gate "${id}" has zero length`);
    this.along = { x: dx / length, z: dz / length };
    this.halfLength = length / 2;
    this.halfThickness = (def.thickness ?? GATE_THICKNESS) / 2;
    this.anchor = midpoint(def.from, def.to, y);
    this.drive = new Drive(field, def, this);
    this.open = def.trap ?? false;
    this.travel = this.open ? GATE_TICKS : 0;

    // Local +X runs along the doorway, as for a wall (level/compile.ts).
    const turn = halfAngle(-this.along.z, this.along.x);
    const surface = def.surface ?? 'gate';
    this.collider = field.host.world.raw.createCollider(
      RAPIER.ColliderDesc.cuboid(this.halfLength, height / 2 + 0.15, this.halfThickness)
        .setTranslation(this.anchor.x, y + height / 2 - 0.15, this.anchor.z)
        .setRotation({ x: 0, y: turn.sin, z: 0, w: turn.cos })
        .setFriction(0)
        .setRestitution(getSurface(surface).restitution)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
    );
    this.collider.setEnabled(!this.open);
    field.host.surfaces.setCollider(this.collider.handle, 'wall', surface);
    field.own(this.collider.handle, this);
  }

  wire(): void {
    this.drive.wire();
  }

  /** How far open the slab looks, from 0 to 1. */
  get openness(): number {
    return this.travel / GATE_TICKS;
  }

  private get moved(): boolean {
    return this.open !== (this.def.trap ?? false);
  }

  get on(): boolean {
    return this.moved && this.travel === (this.open ? GATE_TICKS : 0);
  }

  get busy(): boolean {
    return this.drive.pending || this.travel !== (this.open ? GATE_TICKS : 0);
  }

  step(): void {
    const active = this.drive.step();
    const want = this.def.trap ? !active : active;
    if (want && !this.open) this.set(true);
    else if (!want && this.open && this.doorwayEmpty()) this.set(false);
    if (this.open && this.travel < GATE_TICKS) this.travel++;
    else if (!this.open && this.travel > 0) this.travel--;
  }

  private set(open: boolean): void {
    this.open = open;
    this.collider.setEnabled(!open);
    this.field.host.cue(open ? 'gateOpen' : 'gateShut');
    this.field.host.changed(this.id);
  }

  /** How far a point is from the middle of the doorway, along it and across it. */
  private local(x: number, z: number): { along: number; across: number } {
    const dx = x - this.anchor.x;
    const dz = z - this.anchor.z;
    return {
      along: Math.abs(dx * this.along.x + dz * this.along.z),
      across: Math.abs(dx * this.along.z - dz * this.along.x),
    };
  }

  /** True if a square of ground, `half` to each side of its centre, reaches into the doorway. */
  covers(x: number, z: number, half: number): boolean {
    const at = this.local(x, z);
    return at.along < this.halfLength + half && at.across < this.halfThickness + half;
  }

  /** True if the gate is shut and stands on that square: a stone cannot be pushed there. */
  blocks(x: number, z: number, half: number): boolean {
    return !this.open && this.covers(x, z, half);
  }

  private doorwayEmpty(): boolean {
    for (const ball of this.field.host.balls()) {
      if (!ball.body.isEnabled()) continue;
      const p = ball.position();
      if (this.covers(p.x, p.z, ball.props.radius + GATE_CLEARANCE)) return false;
    }
    return !this.field.all<Stone>('stone').some((stone) => {
      const at = stone.center;
      return this.covers(at.x, at.z, stone.half) || this.covers(stone.goal.x, stone.goal.z, stone.half);
    });
  }

  save(): GateState {
    return { drive: this.drive.save(), open: this.open };
  }

  load(state: unknown): void {
    const { drive, open } = state as GateState;
    this.drive.load(drive);
    this.open = open;
    this.travel = open ? GATE_TICKS : 0;
    this.collider.setEnabled(!open);
  }
}

/** A ball has to change its velocity by this much against a stone, in m/s, to shove it: the knock you can hear. */
const PUSH_SPEED = 0.3;
/** Ticks a stone takes to slide one square. */
const SLIDE_TICKS = 14;
/** A stone's width and height, as shares of a square. */
const STONE_WIDTH = 0.9;
const STONE_HEIGHT = 0.6;

/**
 * A block of stone on the grid (SPEC v4 3.3, 4.4). It is not a loose body: it stands on
 * a square, and a ball that runs into one of its four sides sends it one square the
 * other way. It cannot turn, tip, stop half way or be nudged off line, so where it ends
 * up is the same every time. A wall, the edge of the grid, another stone or a shut gate
 * in the way and it does not move at all.
 */
export class Stone implements Part {
  readonly kind = 'stone';
  readonly on = false;
  readonly half: number;
  cell: Cell;
  /** Centre before and after the last physics step, for the picture. */
  prev: XYZ;
  center: XYZ;
  /** Centre of the square it stands on or is sliding to. */
  goal: XYZ;
  private start: XYZ;
  /** Ticks left of the slide; 0 when standing. */
  private left = 0;
  private readonly body: RAPIER.RigidBody;
  private readonly height: number;

  constructor(
    readonly def: StoneDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    const grid = field.grid;
    if (!grid) throw new Error(`Stone "${id}" needs the hole to have a grid`);
    if (!grid.open(def.cell)) throw new Error(`Stone "${id}" starts off the grid`);
    this.cell = def.cell;
    this.half = (grid.cell * STONE_WIDTH) / 2;
    this.height = grid.cell * STONE_HEIGHT;
    this.center = this.prev = this.goal = this.start = this.centerOf(def.cell);
    const { world, surfaces } = field.host;
    this.body = world.raw.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.center.x, this.center.y, this.center.z),
    );
    const collider = world.raw.createCollider(
      RAPIER.ColliderDesc.cuboid(this.half, this.height / 2, this.half)
        .setFriction(0)
        .setRestitution(getSurface('block').restitution)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
      this.body,
    );
    surfaces.setCollider(collider.handle, 'prop', 'block');
    field.own(collider.handle, this);
  }

  get anchor(): XYZ {
    return { x: this.goal.x, y: this.goal.y - this.height / 2, z: this.goal.z };
  }

  get sliding(): boolean {
    return this.left > 0;
  }

  get busy(): boolean {
    return this.sliding;
  }

  private centerOf(cell: Cell): XYZ {
    const at = this.field.grid!.center(cell);
    return { x: at.x, y: at.y + this.height / 2, z: at.z };
  }

  hit(ball: Ball, speed: number): void {
    if (this.sliding || speed < PUSH_SPEED) return;
    // Which side was struck: the ball is beyond that side, so it is further from the
    // centre along that axis than along the other.
    const p = ball.position();
    const dx = p.x - this.center.x;
    const dz = p.z - this.center.z;
    const step: Cell = Math.abs(dx) > Math.abs(dz) ? [dx > 0 ? -1 : 1, 0] : [0, dz > 0 ? -1 : 1];
    const target: Cell = [this.cell[0] + step[0], this.cell[1] + step[1]];
    if (!this.free(target)) {
      this.field.host.cue('stoneBlocked');
      return;
    }
    this.cell = target;
    this.start = this.center;
    this.goal = this.centerOf(target);
    this.left = SLIDE_TICKS;
    this.field.host.cue('stoneSlide');
  }

  private free(target: Cell): boolean {
    const grid = this.field.grid!;
    if (!grid.open(target)) return false;
    const at = grid.center(target);
    const taken = this.field
      .all<Stone>('stone')
      .some((other) => other !== this && other.cell[0] === target[0] && other.cell[1] === target[1]);
    return !taken && !this.field.all<Gate>('gate').some((gate) => gate.blocks(at.x, at.z, this.half));
  }

  step(): void {
    if (this.left === 0) return;
    this.left--;
    const u = 1 - this.left / SLIDE_TICKS;
    // Eases in and out, and lands exactly on the square.
    const s = u * u * (3 - 2 * u);
    const { start, goal } = this;
    const next =
      this.left === 0
        ? goal
        : { x: start.x + (goal.x - start.x) * s, y: goal.y, z: start.z + (goal.z - start.z) * s };
    this.body.setNextKinematicTranslation(next);
    if (this.left === 0) this.field.host.cue('stoneLand');
  }

  postStep(): void {
    this.prev = this.center;
    this.center = { ...this.body.translation() };
  }

  save(): Cell {
    return [this.cell[0], this.cell[1]];
  }

  load(state: unknown): void {
    const [col, row] = state as Cell;
    this.cell = [col, row];
    this.left = 0;
    this.center = this.prev = this.goal = this.start = this.centerOf(this.cell);
    this.body.setTranslation(this.center, true);
  }
}
