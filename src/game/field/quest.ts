import { FIXED_DT } from '../../core/loop';
import { cos, halfAngle, hypot, sin } from '../../core/math';
import type { Vec2, XYZ } from '../../core/types';
import type { BossDef, Cell, DoorDef, KeyDef, MonsterDef, RealmDef, RealmFloorDef, RealmWallDef } from '../../level/field';
import type { Ball } from '../../physics/ball';
import { Mover } from '../../physics/movers';
import { RAPIER } from '../../physics/rapier';
import { getSurface } from '../../physics/surfaces';
import { ground, midpoint, type Field, type Part } from './field';
import { ballNear, type Gate } from './tomb';

const RAD = Math.PI / 180;

// --- The haunted house: two worlds in one place -----------------------------------

const REALM_WALL_HEIGHT = 0.35;
const REALM_WALL_THICKNESS = 0.2;
/** Room kept between a wall that is coming back and a ball, on top of the ball's own radius. */
const WALL_CLEARANCE = 0.06;
export const REALM_FLOOR_THICKNESS = 0.3;
/** A floor's top stands this far above the ground it joins, like any platform's. */
const FLOOR_LIFT = 0.004;

export type Layer = 'real' | 'ghost';

/** One wall of a layer, as a collider that is there or not. */
export class RealmWall {
  readonly anchor: XYZ;
  /** It is there: a ball meets it. */
  solid = false;
  private readonly collider: RAPIER.Collider;
  private readonly halfLength: number;
  private readonly halfThickness: number;
  private readonly along: { x: number; z: number };

  constructor(
    readonly def: RealmWallDef,
    readonly layer: Layer,
    field: Field,
    owner: Part,
  ) {
    const y = def.y ?? 0;
    const height = def.height ?? REALM_WALL_HEIGHT;
    const dx = def.to[0] - def.from[0];
    const dz = def.to[1] - def.from[1];
    const length = hypot(dx, dz);
    if (length < 1e-6) throw new Error(`A wall of "${owner.id}" has zero length`);
    this.along = { x: dx / length, z: dz / length };
    this.halfLength = length / 2;
    this.halfThickness = (def.thickness ?? REALM_WALL_THICKNESS) / 2;
    this.anchor = midpoint(def.from, def.to, y);
    const turn = halfAngle(-this.along.z, this.along.x);
    const surface = def.surface ?? 'rail';
    this.collider = field.host.world.raw.createCollider(
      RAPIER.ColliderDesc.cuboid(this.halfLength, height / 2 + 0.15, this.halfThickness)
        .setTranslation(this.anchor.x, y + height / 2 - 0.15, this.anchor.z)
        .setRotation({ x: 0, y: turn.sin, z: 0, w: turn.cos })
        .setFriction(0)
        .setRestitution(getSurface(surface).restitution)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
    );
    this.collider.setEnabled(false);
    field.host.surfaces.setCollider(this.collider.handle, 'wall', surface);
    field.own(this.collider.handle, owner);
  }

  /** True if a square of ground, `half` to each side of its centre, reaches into the wall. */
  covers(x: number, z: number, half: number): boolean {
    const dx = x - this.anchor.x;
    const dz = z - this.anchor.z;
    const along = Math.abs(dx * this.along.x + dz * this.along.z);
    const across = Math.abs(dx * this.along.z - dz * this.along.x);
    return along < this.halfLength + half && across < this.halfThickness + half;
  }

  /** Makes it solid, unless a ball is in its place; or takes it away. Returns whether it changed. */
  set(solid: boolean, balls: readonly Ball[]): boolean {
    if (solid === this.solid) return false;
    if (solid) {
      for (const ball of balls) {
        if (!ball.body.isEnabled()) continue;
        const p = ball.position();
        if (Math.abs(p.y - ball.props.radius - this.anchor.y) < 0.6 && this.covers(p.x, p.z, ball.props.radius + WALL_CLEARANCE)) return false;
      }
    }
    this.solid = solid;
    this.collider.setEnabled(solid);
    return true;
  }
}

/** One floor of a layer: a platform (physics/movers.ts) that is there or not. */
export class RealmFloor {
  readonly mover: Mover;
  solid = false;

  constructor(
    readonly def: RealmFloorDef,
    readonly layer: Layer,
    field: Field,
  ) {
    const y = def.y ?? 0;
    const { world, surfaces } = field.host;
    this.mover = new Mover(
      {
        role: 'platform',
        size: [def.max[0] - def.min[0], REALM_FLOOR_THICKNESS, def.max[1] - def.min[1]],
        position: [(def.min[0] + def.max[0]) / 2, y + FLOOR_LIFT - REALM_FLOOR_THICKNESS / 2, (def.min[1] + def.max[1]) / 2],
        surface: def.surface ?? 'slab',
        // It goes nowhere: all it does is come and go.
        motion: { type: 'slide', offset: [0, 0, 0], period: 1 },
      },
      world,
      surfaces,
    );
    this.mover.present = false;
    this.mover.collider.setEnabled(false);
  }

  set(solid: boolean, balls: readonly Ball[]): boolean {
    if (solid === this.solid) return false;
    if (solid && balls.some((ball) => this.mover.engulfs(ball))) return false;
    this.solid = solid;
    this.mover.present = solid;
    this.mover.collider.setEnabled(solid);
    return true;
  }
}

/**
 * Two worlds in one place (SPEC v9 3.3): the real one and the ghost one, and only one
 * of them solid at a time. Which is solid follows from the levers: the ghost world
 * while an odd number of them are on. Nothing of its own is in the snapshot; the
 * levers are, and the worlds are worked out from them again.
 *
 * Its signal: the ghost world is the solid one.
 */
export class Realm implements Part {
  readonly kind = 'realm';
  readonly anchor: XYZ;
  readonly busy = false;
  readonly walls: RealmWall[];
  readonly floors: RealmFloor[];
  /** The ghost world is the solid one. */
  ghost = false;

  constructor(
    readonly def: RealmDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    if (def.levers.length === 0) throw new Error(`Realm "${id}" has no lever to swap it`);
    this.walls = [
      ...(def.real.walls ?? []).map((wall) => new RealmWall(wall, 'real', field, this)),
      ...(def.ghost.walls ?? []).map((wall) => new RealmWall(wall, 'ghost', field, this)),
    ];
    this.floors = [
      ...(def.real.floors ?? []).map((floor) => new RealmFloor(floor, 'real', field)),
      ...(def.ghost.floors ?? []).map((floor) => new RealmFloor(floor, 'ghost', field)),
    ];
    const first = this.walls[0]?.anchor ?? this.floors[0]?.mover.pose.position;
    this.anchor = first ? { x: first.x, y: 0, z: first.z } : { x: 0, y: 0, z: 0 };
    this.apply();
  }

  get on(): boolean {
    return this.ghost;
  }

  /** The world that is solid. */
  get solid(): Layer {
    return this.ghost ? 'ghost' : 'real';
  }

  private wanted(): boolean {
    let on = 0;
    for (const id of this.def.levers) if (this.field.part(id).on) on++;
    return on % 2 === 1;
  }

  /** Brings every wall and floor into line with which world is solid, as far as the balls allow. */
  private apply(): void {
    const balls = this.field.host.balls();
    for (const wall of this.walls) wall.set((wall.layer === 'ghost') === this.ghost, balls);
    for (const floor of this.floors) floor.set((floor.layer === 'ghost') === this.ghost, balls);
  }

  step(): void {
    const { host } = this.field;
    const ghost = this.wanted();
    if (ghost !== this.ghost) {
      this.ghost = ghost;
      host.cue(ghost ? 'realmGhost' : 'realmReal');
      host.changed(this.id);
    }
    this.apply();
    for (const floor of this.floors) floor.mover.preStep(host.world, host.balls());
  }

  postStep(): void {
    for (const floor of this.floors) floor.mover.postStep();
  }

  save(): null {
    return null;
  }

  load(): void {}

  resync(): void {
    this.ghost = this.wanted();
    this.apply();
    for (const floor of this.floors) floor.mover.snap(this.field.host.world);
  }
}

// --- The grid, as monsters walk it ---------------------------------------------------

/**
 * How much of a cell a monster's body fills, and how tall it stands. Less than the
 * cell by more than a ball's width, so that a monster walking a cell never shoves a
 * ball whose middle is in the next one.
 */
export const MONSTER_FOOT = 0.76;
export const MONSTER_HEIGHT = 0.7;
/** Ticks a monster takes to walk one cell, and a boss to turn a quarter. */
export const STEP_TICKS = 18;
export const TURN_TICKS = 12;

/** Something that stands on cells of the grid, and will stand on them after its move. */
interface Stander {
  readonly cells: readonly Cell[];
}

const same = (a: Cell, b: Cell): boolean => a[0] === b[0] && a[1] === b[1];

/**
 * True if a monster may not step onto a cell: it is off the grid or walled, another
 * monster stands on it or is on its way there, a cup lies on it, or a shut door or
 * gate stands on it or across the way to it from `from` (SPEC v9 3.2).
 */
export function taken(field: Field, cell: Cell, self: Part, from?: Cell): boolean {
  const grid = field.grid!;
  if (!grid.open(cell)) return true;
  for (const part of field.parts) {
    if (part === self) continue;
    const cells = (part as Partial<Stander>).cells;
    if (cells?.some((other) => same(other, cell))) return true;
  }
  const at = grid.center(cell);
  for (const cup of field.host.cups()) {
    const on = grid.cellAt(cup.x, cup.z);
    if (on && same(on, cell)) return true;
  }
  // The cell itself, and the line between the two cells, which a door across it lies on.
  const half = (grid.cell * MONSTER_FOOT) / 2;
  const points = [{ x: at.x, z: at.z, half }];
  if (from) {
    const was = grid.center(from);
    points.push({ x: (at.x + was.x) / 2, z: (at.z + was.z) / 2, half: half * 0.5 });
  }
  if (field.all<Door>('door').some((door) => points.some((p) => door.blocks(p.x, p.z, p.half)))) return true;
  return field.all<Gate>('gate').some((gate) => points.some((p) => gate.blocks(p.x, p.z, p.half)));
}

/**
 * The step a chasing thing takes toward a cell (SPEC v9 3.4): along the axis it is
 * further off on, or across if it is as far off both ways; the other axis if that is
 * blocked; nowhere if both are. `dx` and `dz` are how far the target is, in cells,
 * and need not be whole for a thing that stands on several cells.
 */
export function chaseStep(dx: number, dz: number, free: (step: Cell) => boolean): Cell | null {
  const x: Cell = [dx > 0 ? 1 : -1, 0];
  const z: Cell = [0, dz > 0 ? 1 : -1];
  const order = Math.abs(dx) >= Math.abs(dz) ? [dx !== 0 ? x : null, dz !== 0 ? z : null] : [dz !== 0 ? z : null, dx !== 0 ? x : null];
  for (const step of order) if (step && free(step)) return step;
  return null;
}

/** The cell a ball is on, if it is on the grid and on the ground there. */
function ballCell(field: Field, ball: Ball): Cell | null {
  if (!ball.body.isEnabled()) return null;
  const p = ball.position();
  if (Math.abs(p.y - ball.props.radius - field.grid!.y) > 0.6) return null;
  return field.grid!.cellAt(p.x, p.z);
}

/** The compass heading from one cell to the next: 0 is -Z, 90 is +X. */
const headingOf = (from: Cell, to: Cell): number => (to[0] > from[0] ? 90 : to[0] < from[0] ? 270 : to[1] < from[1] ? 0 : 180);

interface MonsterState {
  cell: Cell;
  index: number;
  dir: 1 | -1;
  facing: number;
}

/**
 * A monster (SPEC v9 3.4). It stands on one cell, a wall to a rolling ball, and takes
 * one step each time the ball has stopped. A step onto the ball's cell catches the
 * ball: the stroke is taken back, as after an out-of-bounds, at the cost of a stroke.
 * Where it is, which way it faces and how far along its path it is are in the snapshot.
 */
export class Monster implements Part, Stander {
  readonly kind = 'monster';
  readonly on = false;
  cell: Cell;
  /** Compass heading it faces: the way it last walked. For the picture. */
  facing = 180;
  /** Centre before and after the last physics step, for the picture. */
  prev: XYZ;
  center: XYZ;
  private goal: XYZ;
  private start: XYZ;
  /** Ticks left of the step; 0 when standing. */
  private left = 0;
  /** Where a patrol monster is along its path, and which way it is walking it. */
  private index = 0;
  private dir: 1 | -1 = 1;
  /** The ball it is stepping onto, if any: it walks over the ball, not into it, and catches it on arrival. */
  private victim: Ball | null = null;
  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly half: number;

  constructor(
    readonly def: MonsterDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    const grid = field.grid;
    if (!grid) throw new Error(`Monster "${id}" needs the hole to have a grid`);
    if (def.mode === 'patrol' && (def.path?.length ?? 0) < 2) throw new Error(`Monster "${id}" patrols a path of fewer than two cells`);
    const start = def.mode === 'patrol' ? def.path![0] : def.cell;
    if (!start) throw new Error(`Monster "${id}" has nowhere to start`);
    if (!grid.open(start)) throw new Error(`Monster "${id}" starts off the grid`);
    for (const cell of def.path ?? []) if (!grid.open(cell)) throw new Error(`Monster "${id}" patrols a cell off the grid`);
    this.cell = start;
    this.half = (grid.cell * MONSTER_FOOT) / 2;
    this.center = this.prev = this.goal = this.start = this.centerOf(start);
    const { world, surfaces } = field.host;
    this.body = world.raw.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.center.x, this.center.y, this.center.z),
    );
    this.collider = world.raw.createCollider(
      RAPIER.ColliderDesc.cuboid(this.half, MONSTER_HEIGHT / 2, this.half)
        .setFriction(0)
        .setRestitution(getSurface('monster').restitution)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
      this.body,
    );
    surfaces.setCollider(this.collider.handle, 'prop', 'monster');
    field.own(this.collider.handle, this);
  }

  get cells(): readonly Cell[] {
    return [this.cell];
  }

  get anchor(): XYZ {
    return { x: this.goal.x, y: this.goal.y - MONSTER_HEIGHT / 2, z: this.goal.z };
  }

  get busy(): boolean {
    return this.left > 0;
  }

  /** How far through its step it is, 0 to 1; 1 while standing. */
  get stride(): number {
    return 1 - this.left / STEP_TICKS;
  }

  private centerOf(cell: Cell): XYZ {
    const at = this.field.grid!.center(cell);
    return { x: at.x, y: at.y + MONSTER_HEIGHT / 2, z: at.z };
  }

  /** The cell it will step to for a ball on `target`, or null to stand still. The ball's own cell is a cell like any other. */
  private plan(target: Cell | null): Cell | null {
    if (this.def.mode === 'patrol') {
      const path = this.def.path!;
      let index = this.index + this.dir;
      if (index < 0 || index >= path.length) index = this.index - this.dir;
      const next = path[index];
      return taken(this.field, next, this, this.cell) ? null : next;
    }
    if (!target) return null;
    const step = chaseStep(target[0] - this.cell[0], target[1] - this.cell[1], (by) => !taken(this.field, [this.cell[0] + by[0], this.cell[1] + by[1]], this, this.cell));
    return step ? [this.cell[0] + step[0], this.cell[1] + step[1]] : null;
  }

  /** The ball a chasing monster goes for: the first on the grid. */
  private target(): Cell | null {
    for (const ball of this.field.host.balls()) {
      const cell = ballCell(this.field, ball);
      if (cell) return cell;
    }
    return null;
  }

  /** Where it would step if the ball stopped where it is now: what the arrow over it shows. Null to stay. */
  preview(): Cell | null {
    return this.plan(this.target());
  }

  /** A ball lying on one of its own cells is caught where it stands (SPEC v9 3.2): it stamps, and the stroke goes back. */
  private stamp(): boolean {
    const victim = this.field.host.balls().find((ball) => {
      const cell = ballCell(this.field, ball);
      return cell !== null && this.cells.some((mine) => same(mine, cell));
    });
    if (!victim) return false;
    this.victim = victim;
    this.start = this.goal = this.center;
    this.left = STEP_TICKS;
    this.collider.setEnabled(false);
    this.field.host.cue('monsterStep');
    return true;
  }

  stopped(): void {
    if (this.stamp()) return;
    const next = this.plan(this.target());
    if (!next) return;
    if (this.def.mode === 'patrol') {
      const path = this.def.path!;
      let index = this.index + this.dir;
      if (index < 0 || index >= path.length) {
        this.dir = -this.dir as 1 | -1;
        index = this.index + this.dir;
      }
      this.index = index;
    }
    this.facing = headingOf(this.cell, next);
    this.cell = next;
    this.start = this.center;
    this.goal = this.centerOf(next);
    this.left = STEP_TICKS;
    // Stepping onto a ball, it passes over it, so as not to shove it out of the cell on the way.
    this.victim = this.field.host.balls().find((ball) => {
      const cell = ballCell(this.field, ball);
      return cell !== null && same(cell, next);
    }) ?? null;
    if (this.victim) this.collider.setEnabled(false);
    this.field.host.cue('monsterStep');
  }

  step(): void {
    if (this.left === 0) return;
    this.left--;
    const u = 1 - this.left / STEP_TICKS;
    const s = u * u * (3 - 2 * u);
    const { start, goal } = this;
    const next = this.left === 0 ? goal : { x: start.x + (goal.x - start.x) * s, y: goal.y, z: start.z + (goal.z - start.z) * s };
    this.body.setNextKinematicTranslation(next);
    if (this.left === 0) this.arrive();
  }

  /** Arrived: the ball it stepped onto is caught. */
  private arrive(): void {
    const { host } = this.field;
    const victim = this.victim;
    this.victim = null;
    this.collider.setEnabled(true);
    if (!victim) return;
    host.cue('caught');
    host.caught(victim);
  }

  postStep(): void {
    this.prev = this.center;
    this.center = { ...this.body.translation() };
  }

  save(): MonsterState {
    return { cell: [this.cell[0], this.cell[1]], index: this.index, dir: this.dir, facing: this.facing };
  }

  load(state: unknown): void {
    const { cell, index, dir, facing } = state as MonsterState;
    this.cell = [cell[0], cell[1]];
    this.index = index;
    this.dir = dir;
    this.facing = facing;
    this.left = 0;
    this.victim = null;
    this.collider.setEnabled(true);
    this.center = this.prev = this.goal = this.start = this.centerOf(this.cell);
    this.body.setTranslation(this.center, true);
  }
}

// --- Keys and doors ------------------------------------------------------------------

const KEY_REACH = 0.4;

interface KeyState {
  held: boolean;
  used: boolean;
}

/**
 * A key (SPEC v9 3.5). A ball that rolls over it takes it, and keeps it until a door
 * of its colour spends it. Both are in the snapshot: a stroke taken back puts the key
 * back on the ground. Its signal: it has been taken.
 */
export class Key implements Part {
  readonly kind = 'key';
  readonly anchor: XYZ;
  readonly busy = false;
  held = false;
  used = false;

  constructor(
    readonly def: KeyDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.anchor = ground(def.at);
  }

  get on(): boolean {
    return this.held;
  }

  /** In hand and not yet spent. */
  get carried(): boolean {
    return this.held && !this.used;
  }

  step(): void {
    if (this.held) return;
    if (!this.field.host.balls().some((ball) => ballNear(ball, this.anchor, KEY_REACH, 0.6))) return;
    this.held = true;
    this.field.host.cue('keyTake');
  }

  save(): KeyState {
    return { held: this.held, used: this.used };
  }

  load(state: unknown): void {
    const { held, used } = state as KeyState;
    this.held = held;
    this.used = used;
  }
}

const DOOR_HEIGHT = 0.8;
const DOOR_THICKNESS = 0.24;
/** Ticks the door takes to swing out of the way: what the eye sees. */
export const DOOR_TICKS = 14;
/** Room kept between a shut door and a ball, on top of the ball's own radius. */
const DOOR_CLEARANCE = 0.06;
/** How many steps ahead a door looks for a ball with its key. */
const DOOR_LOOKAHEAD = 3;

/**
 * A locked door (SPEC v9 3.5). It looks a few steps ahead for a ball that carries a key
 * of its colour and opens before the ball gets there, so that to the ball it is open
 * at once; the picture takes a moment. The key is spent. To a ball without one, and
 * to a monster, it is a wall. Its signal: it is open.
 */
export class Door implements Part {
  readonly kind = 'door';
  readonly anchor: XYZ;
  open = false;
  /** How far it has swung, in ticks, from 0 (shut) to DOOR_TICKS (open). */
  private travel = 0;
  private readonly collider: RAPIER.Collider;
  private readonly halfLength: number;
  private readonly halfThickness: number;
  private readonly along: { x: number; z: number };

  constructor(
    readonly def: DoorDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    const y = def.y ?? 0;
    const height = def.height ?? DOOR_HEIGHT;
    const dx = def.to[0] - def.from[0];
    const dz = def.to[1] - def.from[1];
    const length = hypot(dx, dz);
    if (length < 1e-6) throw new Error(`Door "${id}" has zero length`);
    this.along = { x: dx / length, z: dz / length };
    this.halfLength = length / 2;
    this.halfThickness = (def.thickness ?? DOOR_THICKNESS) / 2;
    this.anchor = midpoint(def.from, def.to, y);
    const turn = halfAngle(-this.along.z, this.along.x);
    this.collider = field.host.world.raw.createCollider(
      RAPIER.ColliderDesc.cuboid(this.halfLength, height / 2 + 0.15, this.halfThickness)
        .setTranslation(this.anchor.x, y + height / 2 - 0.15, this.anchor.z)
        .setRotation({ x: 0, y: turn.sin, z: 0, w: turn.cos })
        .setFriction(0)
        .setRestitution(getSurface('gate').restitution)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
    );
    field.host.surfaces.setCollider(this.collider.handle, 'wall', 'gate');
    field.own(this.collider.handle, this);
  }

  get on(): boolean {
    return this.open && this.travel === DOOR_TICKS;
  }

  get busy(): boolean {
    return this.open && this.travel < DOOR_TICKS;
  }

  /** How far open it looks, 0 to 1. */
  get openness(): number {
    return this.travel / DOOR_TICKS;
  }

  /** True if a square of ground, `half` to each side of its centre, reaches into the doorway. */
  covers(x: number, z: number, half: number): boolean {
    const dx = x - this.anchor.x;
    const dz = z - this.anchor.z;
    const along = Math.abs(dx * this.along.x + dz * this.along.z);
    const across = Math.abs(dx * this.along.z - dz * this.along.x);
    return along < this.halfLength + half && across < this.halfThickness + half;
  }

  /** True if the door is shut and stands on that square: a monster cannot step there. */
  blocks(x: number, z: number, half: number): boolean {
    return !this.open && this.covers(x, z, half);
  }

  /** True if the ball is about to be in the doorway. */
  private arriving(ball: Ball): boolean {
    if (!ball.body.isEnabled()) return false;
    const p = ball.position();
    if (Math.abs(p.y - ball.props.radius - this.anchor.y) > 0.6) return false;
    const v = ball.velocity();
    for (let k = 0; k <= DOOR_LOOKAHEAD; k++) {
      if (this.covers(p.x + v.x * FIXED_DT * k, p.z + v.z * FIXED_DT * k, ball.props.radius + DOOR_CLEARANCE)) return true;
    }
    return false;
  }

  step(): void {
    if (!this.open) {
      const keys = this.field.all<Key>('key');
      for (const ball of this.field.host.balls()) {
        if (!this.arriving(ball)) continue;
        const key = keys.find((candidate) => candidate.def.color === this.def.color && candidate.carried);
        if (!key) continue;
        key.used = true;
        this.open = true;
        this.collider.setEnabled(false);
        this.field.host.cue('doorOpen');
        this.field.host.changed(this.id);
        break;
      }
    }
    if (this.open && this.travel < DOOR_TICKS) this.travel++;
  }

  save(): boolean {
    return this.open;
  }

  load(state: unknown): void {
    this.open = state as boolean;
    this.travel = this.open ? DOOR_TICKS : 0;
    this.collider.setEnabled(!this.open);
  }
}

// --- The boss --------------------------------------------------------------------------

export const BOSS_HEIGHT = 1.2;
/** The body's radius, as a share of the cell: round, so that turning sweeps nothing, and short of its cells by a ball's width. */
const BOSS_BODY = 0.85;
/** The weak spot on its back: how far behind the middle it sits, and its half-size. */
export const WEAK_OUT = 1.02;
export const WEAK_HALF = { x: 0.3, y: 0.3, z: 0.12 };
export const SHIELD_HALF = { x: 0.42, y: 0.4, z: 0.2 };
const DEFAULT_HIT_SPEED = 1.5;
/** Rotation about +Y that points local -Z along each compass heading, a quarter at a time: exact, so every turn lands square. */
const FACINGS: Record<number, { x: number; y: number; z: number; w: number }> = {
  0: { x: 0, y: 0, z: 0, w: 1 },
  90: { x: 0, y: -Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
  180: { x: 0, y: 1, z: 0, w: 0 },
  270: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
};

interface BossState {
  cell: Cell;
  facing: number;
  hits: number;
  shielded: boolean;
}

/**
 * A boss (SPEC v9 3.6). It stands on four cells, round, with its weak spot sticking out
 * of its back. Each time the ball has stopped it turns to face the ball; from its
 * second phase on it first takes a step toward the ball, as a chasing monster does,
 * and a step onto the ball's cell catches the ball. In a turn in which it was struck it
 * only turns (SPEC v9 3.6): a catch would take the strike back with the stroke.
 *
 * From its third phase on a shield covers the weak spot, which a ball carrying the
 * right key opens, spending the key. Its signal: it is beaten.
 */
export class Boss implements Part, Stander {
  readonly kind = 'boss';
  cell: Cell;
  /** Compass heading it faces: 0 is -Z, 90 is +X. */
  facing: number;
  /** Times it has been struck. */
  hits = 0;
  shielded = false;
  /** Yaw before and after the last physics step, for the picture. */
  prevYaw: number;
  yaw: number;
  prev: XYZ;
  center: XYZ;
  private hitThisStroke = false;
  private start: XYZ;
  private goal: XYZ;
  private fromYaw: number;
  private toYaw: number;
  /** Ticks left of the step, then of the turn. */
  private stepLeft = 0;
  private turnLeft = 0;
  /** The ball it is stepping onto, if any: it passes over the ball and catches it on arrival. */
  private victim: Ball | null = null;
  private readonly body: RAPIER.RigidBody;
  private readonly trunk: RAPIER.Collider;
  private readonly weak: RAPIER.Collider;
  private readonly shield: RAPIER.Collider;
  private readonly hitSpeed: number;

  constructor(
    readonly def: BossDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    const grid = field.grid;
    if (!grid) throw new Error(`Boss "${id}" needs the hole to have a grid`);
    if (!(def.hp >= 1)) throw new Error(`Boss "${id}" needs some health`);
    this.cell = def.cell;
    for (const cell of this.cells) if (!grid.open(cell)) throw new Error(`Boss "${id}" starts off the grid`);
    this.facing = def.facing ?? 180;
    if (!(this.facing in FACINGS)) throw new Error(`Boss "${id}" faces ${this.facing}, which is not a quarter`);
    this.hitSpeed = def.hitSpeed ?? DEFAULT_HIT_SPEED;
    this.center = this.prev = this.start = this.goal = this.centerOf(this.cell);
    this.yaw = this.prevYaw = this.fromYaw = this.toYaw = -this.facing * RAD;
    const { world, surfaces } = field.host;
    this.body = world.raw.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(this.center.x, this.center.y, this.center.z)
        .setRotation(FACINGS[this.facing]),
    );
    const part = (desc: RAPIER.ColliderDesc, surface: string): RAPIER.Collider => {
      const collider = world.raw.createCollider(
        desc.setFriction(0).setRestitution(getSurface(surface).restitution).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
        this.body,
      );
      surfaces.setCollider(collider.handle, 'prop', surface);
      field.own(collider.handle, this);
      return collider;
    };
    const scale = grid.cell;
    this.trunk = part(RAPIER.ColliderDesc.cylinder(BOSS_HEIGHT / 2, BOSS_BODY * scale), 'monster');
    // Local -Z is the way it faces: the weak spot and the shield are behind it, at +Z.
    this.weak = part(RAPIER.ColliderDesc.cuboid(WEAK_HALF.x, WEAK_HALF.y, WEAK_HALF.z).setTranslation(0, WEAK_HALF.y - BOSS_HEIGHT / 2 + 0.1, WEAK_OUT * scale), 'weakSpot');
    this.shield = part(
      RAPIER.ColliderDesc.cuboid(SHIELD_HALF.x, SHIELD_HALF.y, SHIELD_HALF.z).setTranslation(0, SHIELD_HALF.y - BOSS_HEIGHT / 2 + 0.05, WEAK_OUT * scale),
      'shield',
    );
    this.shield.setEnabled(false);
  }

  /** The four cells it stands on. */
  get cells(): readonly Cell[] {
    const [c, r] = this.cell;
    return [
      [c, r],
      [c + 1, r],
      [c, r + 1],
      [c + 1, r + 1],
    ];
  }

  get hp(): number {
    return Math.max(0, this.def.hp - this.hits);
  }

  /** 1 until it is struck, 2 after the first strike, 3 after the second. */
  get phase(): 1 | 2 | 3 {
    return Math.min(3, this.hits + 1) as 1 | 2 | 3;
  }

  get on(): boolean {
    return this.hp === 0;
  }

  get busy(): boolean {
    return this.stepLeft > 0 || this.turnLeft > 0;
  }

  get anchor(): XYZ {
    return { x: this.goal.x, y: this.goal.y - BOSS_HEIGHT / 2, z: this.goal.z };
  }

  /** Where the weak spot is right now, on the ground: for the picture and for keeping it clear of a ball. */
  get weakSpot(): XYZ {
    const scale = this.field.grid!.cell;
    return { x: this.center.x + sin(this.yaw) * WEAK_OUT * scale, y: this.center.y - BOSS_HEIGHT / 2, z: this.center.z + cos(this.yaw) * WEAK_OUT * scale };
  }

  private centerOf(cell: Cell): XYZ {
    const grid = this.field.grid!;
    const at = grid.center(cell);
    return { x: at.x + grid.cell / 2, y: at.y + BOSS_HEIGHT / 2, z: at.z + grid.cell / 2 };
  }

  /** The heading it would turn to for a ball at a point: the axis the ball is further off on, across if equal. */
  private facingToward(p: XYZ): number {
    const dx = p.x - this.goal.x;
    const dz = p.z - this.goal.z;
    if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 90 : 270;
    return dz < 0 ? 0 : 180;
  }

  /** Where it would turn to if the ball stopped where it is now: what the arrow over it shows. */
  preview(): number {
    const ball = this.field.host.balls().find((candidate) => candidate.body.isEnabled());
    return ball ? this.facingToward(ball.position()) : this.facing;
  }

  struck(): void {
    this.hitThisStroke = false;
  }

  hit(_ball: Ball, speed: number, collider: number): void {
    const { host } = this.field;
    if (collider === this.shield.handle) {
      if (!this.shielded) return;
      const key = this.field.all<Key>('key').find((candidate) => candidate.def.color === this.def.shield && candidate.carried);
      if (!key) {
        host.cue('shieldHit');
        return;
      }
      key.used = true;
      this.shielded = false;
      this.shield.setEnabled(false);
      host.cue('shieldOpen');
      host.changed(this.id);
      return;
    }
    if (collider !== this.weak.handle || this.hitThisStroke || this.shielded || this.hp === 0 || speed < this.hitSpeed) return;
    this.hits++;
    this.hitThisStroke = true;
    host.cue(this.hp === 0 ? 'bossDown' : 'bossHit');
    host.changed(this.id);
    // The shield itself comes once the ball that struck has gone (see `step`).
    if (this.phase === 3 && this.def.shield && this.hp > 0) this.shielded = true;
  }

  stopped(): void {
    if (this.hp === 0) return;
    const ball = this.field.host.balls().find((candidate) => candidate.body.isEnabled());
    if (!ball) return;
    // Struck this stroke, it only turns (SPEC v9 3.6). Otherwise, from its second phase on, a step first.
    if (!this.hitThisStroke && this.phase >= 2) {
      const target = ballCell(this.field, ball);
      // A ball lying on one of its own cells, in a corner its round body leaves, is caught where it stands.
      if (target && this.cells.some((mine) => same(mine, target))) {
        this.victim = ball;
        this.start = this.goal = this.center;
        this.stepLeft = STEP_TICKS;
        this.trunk.setEnabled(false);
        this.field.host.cue('bossStep');
      } else if (target) {
        const [c, r] = this.cell;
        const free = (by: Cell): boolean => {
          // The two cells it would step onto, each from the cell of its own it steps out of.
          const lead: [Cell, Cell][] =
            by[0] !== 0
              ? [[[c + (by[0] > 0 ? 2 : -1), r], [c + (by[0] > 0 ? 1 : 0), r]], [[c + (by[0] > 0 ? 2 : -1), r + 1], [c + (by[0] > 0 ? 1 : 0), r + 1]]]
              : [[[c, r + (by[1] > 0 ? 2 : -1)], [c, r + (by[1] > 0 ? 1 : 0)]], [[c + 1, r + (by[1] > 0 ? 2 : -1)], [c + 1, r + (by[1] > 0 ? 1 : 0)]]];
          return lead.every(([cell, from]) => !taken(this.field, cell, this, from));
        };
        const step = chaseStep(target[0] - (c + 0.5), target[1] - (r + 0.5), free);
        if (step) {
          this.cell = [c + step[0], r + step[1]];
          this.start = this.center;
          this.goal = this.centerOf(this.cell);
          this.stepLeft = STEP_TICKS;
          // Stepping onto a ball, it passes over it, so as not to shove it out of the cell on the way.
          this.victim = this.cells.some((mine) => same(mine, target)) ? ball : null;
          if (this.victim) this.trunk.setEnabled(false);
          this.field.host.cue('bossStep');
        }
      }
    }
    const facing = this.facingToward(ball.position());
    if (facing !== this.facing) {
      this.facing = facing;
      this.fromYaw = this.yaw;
      // The short way round.
      let turn = -facing * RAD - this.fromYaw;
      while (turn > Math.PI) turn -= 2 * Math.PI;
      while (turn < -Math.PI) turn += 2 * Math.PI;
      this.toYaw = this.fromYaw + turn;
      this.turnLeft = TURN_TICKS;
      this.field.host.cue('bossTurn');
    }
  }

  step(): void {
    const { host } = this.field;
    // Neither the weak spot nor the shield is there while it moves, and neither comes
    // back where a ball lies: it waits for the ball to have gone, as a wall does.
    const moving = this.stepLeft > 0 || this.turnLeft > 0;
    const place = (collider: RAPIER.Collider, wanted: boolean): void => {
      if (wanted === collider.isEnabled()) return;
      if (wanted && host.balls().some((ball) => ball.body.isEnabled() && this.overlapsWeak(ball))) return;
      collider.setEnabled(wanted);
    };
    place(this.weak, !moving && !this.shielded && this.hp > 0);
    place(this.shield, !moving && this.shielded);
    if (this.stepLeft > 0) {
      this.stepLeft--;
      const u = 1 - this.stepLeft / STEP_TICKS;
      const s = u * u * (3 - 2 * u);
      const { start, goal } = this;
      const next = this.stepLeft === 0 ? goal : { x: start.x + (goal.x - start.x) * s, y: goal.y, z: start.z + (goal.z - start.z) * s };
      this.body.setNextKinematicTranslation(next);
      if (this.stepLeft === 0) this.arrive();
      return;
    }
    if (this.turnLeft > 0) {
      this.turnLeft--;
      const u = 1 - this.turnLeft / TURN_TICKS;
      const s = u * u * (3 - 2 * u);
      const yaw = this.fromYaw + (this.toYaw - this.fromYaw) * s;
      this.body.setNextKinematicRotation(this.turnLeft === 0 ? FACINGS[this.facing] : { x: 0, y: sin(yaw / 2), z: 0, w: cos(yaw / 2) });
    }
  }

  private overlapsWeak(ball: Ball): boolean {
    const spot = this.weakSpot;
    const p = ball.position();
    return hypot(p.x - spot.x, p.z - spot.z) < Math.max(SHIELD_HALF.x, SHIELD_HALF.z) + ball.props.radius + 0.05 && Math.abs(p.y - ball.props.radius - spot.y) < 0.8;
  }

  private arrive(): void {
    const { host } = this.field;
    const victim = this.victim;
    this.victim = null;
    this.trunk.setEnabled(true);
    if (!victim) return;
    host.cue('caught');
    host.caught(victim);
  }

  postStep(): void {
    this.prev = this.center;
    this.center = { ...this.body.translation() };
    this.prevYaw = this.yaw;
    if (this.turnLeft === 0) this.yaw = this.toYaw = -this.facing * RAD;
    else {
      const u = 1 - this.turnLeft / TURN_TICKS;
      const s = u * u * (3 - 2 * u);
      this.yaw = this.fromYaw + (this.toYaw - this.fromYaw) * s;
    }
  }

  save(): BossState {
    return { cell: [this.cell[0], this.cell[1]], facing: this.facing, hits: this.hits, shielded: this.shielded };
  }

  load(state: unknown): void {
    const { cell, facing, hits, shielded } = state as BossState;
    this.cell = [cell[0], cell[1]];
    this.facing = facing;
    this.hits = hits;
    this.shielded = shielded;
    this.hitThisStroke = false;
    this.stepLeft = this.turnLeft = 0;
    this.victim = null;
    this.trunk.setEnabled(true);
    this.center = this.prev = this.start = this.goal = this.centerOf(this.cell);
    this.yaw = this.prevYaw = this.fromYaw = this.toYaw = -facing * RAD;
    this.body.setTranslation(this.center, true);
    this.body.setRotation(FACINGS[facing], true);
    this.weak.setEnabled(!shielded && this.hp > 0);
    this.shield.setEnabled(shielded);
  }
}

/** Where a boss stands as its data has it: the middle of its four cells, on the ground. */
export function bossStartPoint(def: BossDef, origin: Vec2, cell: number, y = 0): XYZ {
  return { x: origin[0] + (def.cell[0] + 0.5) * cell, y, z: origin[1] + (def.cell[1] + 0.5) * cell };
}
