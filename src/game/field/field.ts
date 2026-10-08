import { FIXED_DT } from '../../core/loop';
import { hypot } from '../../core/math';
import type { Vec2, Vec3, XYZ } from '../../core/types';
import type { Cell, Driven, FieldDef, GridDef, PartDef, When } from '../../level/field';
import type { Ball } from '../../physics/ball';
import type { SurfaceMap } from '../../physics/surfaces';
import type { PhysicsWorld } from '../../physics/world';

/** What the round gives the works of a hole to act with. */
export interface FieldHost {
  readonly world: PhysicsWorld;
  readonly surfaces: SurfaceMap;
  /** The balls in play. */
  balls(): readonly Ball[];
  /** A named moment, for sound and effects. */
  cue(name: string): void;
  /** A part has taken a ball off the course. */
  outOfBounds(ball: Ball): void;
  /** A part has changed what it is doing: something for the camera to show once the ball has stopped. */
  changed(part: string): void;
}

/**
 * One of the works of a hole: a plate, a gate, a stone. Every part can hand over its
 * state and take it back (SPEC v4 4.3), which is all the field snapshot is: before each
 * stroke the state of every part is kept, and an out-of-bounds or an undo puts it back.
 */
export interface Part {
  readonly id: string;
  readonly kind: string;
  readonly def: PartDef;
  /** The signal other parts listen to. What it means is the part's own business. */
  readonly on: boolean;
  /** True while the part is on its way somewhere. A stroke is not over until every part is still. */
  readonly busy: boolean;
  /** Where it is, for the lines drawn between parts and for the camera. */
  readonly anchor: XYZ;
  /** Called once, when every part exists, so one can look another up. */
  wire?(): void;
  /** Runs once per tick, before the world steps. */
  step(): void;
  /** Runs once per tick, after the world has stepped. */
  postStep?(): void;
  /** A ball ran into one of this part's colliders; `speed` is how much its velocity changed, in m/s. */
  hit?(ball: Ball, speed: number): void;
  save(): unknown;
  load(state: unknown): void;
  /** After every part has loaded: work out again whatever follows from the others, without a sound. */
  resync?(): void;
  /** True if a ball may not be left at `point` because of this part. */
  forbidsRest?(point: XYZ): boolean;
  /** Where to put a ball that may not stay where it stopped. */
  nearestRest?(point: XYZ): Vec3 | null;
}

/** Everything a field snapshot holds. Plain data: it can be compared, copied and stored. */
export interface FieldState {
  alert: number;
  parts: unknown[];
}

export type PartFactory<D extends PartDef = PartDef> = (def: D, field: Field, id: string) => Part;

const registry = new Map<string, PartFactory>();

export function registerPart<K extends PartDef['kind']>(
  kind: K,
  factory: PartFactory<Extract<PartDef, { kind: K }>>,
): void {
  registry.set(kind, factory as PartFactory);
}

/** Something that runs once per tick after the parts have, for work that spans several of them: tracing light. */
export interface FieldSystem {
  update(): void;
  /** Called when a snapshot has been put back. */
  reset?(): void;
}

/** The squares stones stand on. */
export class Grid {
  readonly cell: number;
  readonly y: number;
  private readonly blocked: Set<string>;

  constructor(readonly def: GridDef) {
    this.cell = def.cell ?? 1;
    this.y = def.y ?? 0;
    this.blocked = new Set((def.blocked ?? []).map(([col, row]) => `${col},${row}`));
  }

  /** Centre of a square, on the ground. */
  center([col, row]: Cell): XYZ {
    return { x: this.def.origin[0] + col * this.cell, y: this.y, z: this.def.origin[1] + row * this.cell };
  }

  /** True if a stone may stand on the square, other stones and gates aside. */
  open([col, row]: Cell): boolean {
    return col >= 0 && row >= 0 && col < this.def.cols && row < this.def.rows && !this.blocked.has(`${col},${row}`);
  }

  /** The square a point is on, or null if it is off the grid. */
  cellAt(x: number, z: number): Cell | null {
    const col = Math.round((x - this.def.origin[0]) / this.cell);
    const row = Math.round((z - this.def.origin[1]) / this.cell);
    return this.open([col, row]) ? [col, row] : null;
  }
}

/** How fast the glow runs along a line between two parts, in m/s. Faster than a ball at full power. */
export const SIGNAL_SPEED = 24;

interface DriveState {
  count: number;
  active: boolean;
}

/**
 * The listening half of a part that reacts to a signal: works out when the signal has
 * arrived, `delay` ticks after its sources came on, and holds on to it if the part latches.
 */
export class Drive {
  /** True once the signal has arrived, and for as long as it stays. */
  active = false;
  /** Ticks the signal has been on its way, up to `delay`. */
  private count = 0;
  private delay = 1;
  /** The parts it listens to, with the path of the line from each. `inhibit`: one that must be off. */
  readonly sources: { part: Part; inhibit: boolean; path: XYZ[] }[] = [];

  constructor(
    private readonly field: Field,
    private readonly def: Driven,
    private readonly owner: Part,
  ) {}

  /** Call from the owner's `wire`. */
  wire(): void {
    const { all, none } = normalise(this.def.when);
    const add = (id: string, inhibit: boolean) => {
      const part = this.field.part(id);
      const corners = (this.def.via ?? []).map(([x, z]) => ({ x, y: this.owner.anchor.y, z }));
      this.sources.push({ part, inhibit, path: [part.anchor, ...(this.sources.length === 0 ? corners : []), this.owner.anchor] });
    };
    for (const id of all) add(id, false);
    for (const id of none) add(id, true);
    const first = this.sources.find((source) => !source.inhibit) ?? this.sources[0];
    const length = first ? pathLength(first.path) : 0;
    this.delay = Math.max(1, this.def.delay ?? Math.round(length / SIGNAL_SPEED / FIXED_DT));
  }

  /** The signal as it is right now, before any delay. */
  get input(): boolean {
    return this.field.test(this.def.when);
  }

  /** How far the glow has got along the line, 0 to 1. */
  get progress(): number {
    return this.active ? 1 : this.count / this.delay;
  }

  /** True while the signal is still on its way. */
  get pending(): boolean {
    return !this.active && this.count > 0;
  }

  /** Advances one tick. Returns whether the signal has arrived. */
  step(): boolean {
    if (this.active && this.def.latch) return true;
    if (this.input) {
      if (this.count < this.delay) this.count++;
    } else {
      this.count = 0;
    }
    this.active = this.count >= this.delay;
    return this.active;
  }

  save(): DriveState {
    return { count: this.count, active: this.active };
  }

  load(state: DriveState): void {
    this.count = state.count;
    this.active = state.active;
  }
}

function normalise(when: When): { all: readonly string[]; none: readonly string[] } {
  return typeof when === 'string' ? { all: [when], none: [] } : { all: when.all ?? [], none: when.none ?? [] };
}

function pathLength(path: readonly XYZ[]): number {
  let length = 0;
  for (let i = 1; i < path.length; i++) length += hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
  return length;
}

/**
 * The works of one hole while a round is on (SPEC v4 4.2). It knows nothing about any
 * kind of part: it runs them, passes signals between them and keeps their state.
 */
export class Field {
  readonly parts: Part[] = [];
  readonly grid: Grid | null;
  /** How many times the ball has made a noise the dragon can hear. */
  alert = 0;
  private readonly byId = new Map<string, Part>();
  private readonly owners = new Map<number, Part>();
  private readonly systems = new Map<string, FieldSystem>();

  constructor(
    readonly def: FieldDef,
    readonly host: FieldHost,
  ) {
    this.grid = def.grid ? new Grid(def.grid) : null;
    def.parts.forEach((partDef, index) => {
      const factory = registry.get(partDef.kind);
      if (!factory) throw new Error(`Unknown part kind "${partDef.kind}"`);
      const id = partDef.id ?? `${partDef.kind}${index}`;
      if (this.byId.has(id)) throw new Error(`Two parts are called "${id}"`);
      const part = factory(partDef, this, id);
      this.parts.push(part);
      this.byId.set(id, part);
    });
    for (const part of this.parts) part.wire?.();
    for (const part of this.parts) part.resync?.();
  }

  part(id: string): Part {
    const part = this.byId.get(id);
    if (!part) throw new Error(`No part is called "${id}"`);
    return part;
  }

  /** Every part of one kind, in the order of the hole's data. */
  all<T extends Part>(kind: string): T[] {
    return this.parts.filter((part) => part.kind === kind) as T[];
  }

  /** Says that a collider belongs to a part, so the part hears when a ball runs into it. */
  own(colliderHandle: number, part: Part): void {
    this.owners.set(colliderHandle, part);
  }

  /** A shared helper that runs after the parts each tick, made the first time a part asks for it. */
  system<T extends FieldSystem>(name: string, make: () => T): T {
    let system = this.systems.get(name);
    if (!system) this.systems.set(name, (system = make()));
    return system as T;
  }

  test(when: When): boolean {
    const { all, none } = normalise(when);
    return all.every((id) => this.part(id).on) && !none.some((id) => this.part(id).on);
  }

  /** True while any part is on its way somewhere. */
  get busy(): boolean {
    return this.parts.some((part) => part.busy);
  }

  /** The part that is on the move, for the camera to watch while the ball waits. */
  get active(): Part | null {
    return this.parts.find((part) => part.busy) ?? null;
  }

  /** Call before stepping the world. */
  preStep(): void {
    for (const part of this.parts) part.step();
    for (const system of this.systems.values()) system.update();
  }

  /** Call after stepping the world. */
  postStep(): void {
    for (const part of this.parts) part.postStep?.();
  }

  /** A ball ran into a collider. Returns true if it was one of the field's. */
  hit(ball: Ball, colliderHandle: number, speed: number): boolean {
    const part = this.owners.get(colliderHandle);
    part?.hit?.(ball, speed);
    return part !== undefined;
  }

  forbidsRest(point: XYZ): Part | null {
    return this.parts.find((part) => part.forbidsRest?.(point)) ?? null;
  }

  save(): FieldState {
    return { alert: this.alert, parts: this.parts.map((part) => part.save()) };
  }

  /** Puts every part back the way a snapshot has it. Nothing makes a sound. */
  restore(state: FieldState): void {
    this.alert = state.alert;
    this.parts.forEach((part, i) => part.load(state.parts[i]));
    for (const part of this.parts) part.resync?.();
    for (const system of this.systems.values()) system.reset?.();
  }
}

/** A point on the ground as a runtime vector. */
export const ground = (at: Vec3): XYZ => ({ x: at[0], y: at[1], z: at[2] });

/** Midpoint of two points on the ground at height `y`. */
export const midpoint = (a: Vec2, b: Vec2, y = 0): XYZ => ({ x: (a[0] + b[0]) / 2, y, z: (a[1] + b[1]) / 2 });
