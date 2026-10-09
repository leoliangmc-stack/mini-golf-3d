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
  /**
   * Call every step while a part is holding a ball, so it is not judged as stopped: a
   * train with a ball aboard (SPEC v7 3.3). What `busy` is to a zone.
   */
  hold(ball: Ball): void;
  /** Call on a step where a part put a ball somewhere else by hand, so the jump is not drawn as motion. */
  snap(ball: Ball): void;
  /** Physics ticks to a beat on this hole, or null if it keeps none (SPEC v6 3.4). */
  readonly beat: number | null;
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
  /**
   * True for a part that keeps the hole's clock and nothing else: no ball can change
   * what it does (SPEC v6 3.7). A part that listens only to such parts is one too.
   */
  readonly timed?: boolean;
  /**
   * True for a part that holds a stroke open with nothing worth watching: a train on its
   * way back empty. The camera stays with the ball.
   */
  readonly discreet?: boolean;
  /** Where it is, for the lines drawn between parts and for the camera. */
  readonly anchor: XYZ;
  /** Called once, when every part exists, so one can look another up. */
  wire?(): void;
  /** Runs once per tick, before the world steps. */
  step(): void;
  /** Runs once per tick, after the world has stepped. */
  postStep?(): void;
  /**
   * A ball ran into one of this part's colliders; `speed` is how much its velocity
   * changed, in m/s, and `collider` says which, for a part that has several.
   */
  hit?(ball: Ball, speed: number, collider: number): void;
  save(): unknown;
  load(state: unknown): void;
  /** After every part has loaded: work out again whatever follows from the others, without a sound. */
  resync?(): void;
  /** True if a ball may not be left at `point` because of this part. */
  forbidsRest?(point: XYZ): boolean;
  /** Where to put a ball that may not stay where it stopped. */
  nearestRest?(point: XYZ): Vec3 | null;
}

/**
 * A part the player turns by hand between strokes (SPEC v7 3.5): a group of walls on a
 * pivot. No ball can move it, and the hole allows only so many turns.
 */
export interface Turnable extends Part {
  /** True while it is still swinging round from the last turn. No stroke can be played until it has stopped. */
  readonly turning: boolean;
  /** True if a ball lies where its arms would sweep. */
  readonly blocked: boolean;
  /** Gives it a quarter turn. */
  turn(): void;
}

const isTurnable = (part: Part): part is Turnable => typeof (part as Partial<Turnable>).turn === 'function';

/**
 * Whether the player can turn a part right now, and if not, why not. `spent`: the
 * hole's turns are used up. `blocked`: a ball is in the way. `turning`: it has not
 * finished the turn before. `none`: it is not a thing that turns, or this is no time for it.
 */
export type TurnCheck = 'ok' | 'spent' | 'blocked' | 'turning' | 'none';

/**
 * A clock of its own, kept by a part and read by the moving parts that name it (SPEC v6
 * 3.5). `at` gives its time at the hole's current tick or at the next one.
 */
export interface LocalClock {
  at(tick: number): number;
}

/** Everything a field snapshot holds. Plain data: it can be compared, copied and stored. */
export interface FieldState {
  alert: number;
  /** Turns of a wall group the player has left (SPEC v7 3.7). */
  turns: number;
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
  /** Turns of a wall group the player has left on this hole (SPEC v7 3.5). */
  turnsLeft: number;
  private readonly byId = new Map<string, Part>();
  private readonly owners = new Map<number, Part>();
  private readonly systems = new Map<string, FieldSystem>();
  /** The parts no ball can change: they keep the hole's clock, or listen only to parts that do. */
  private readonly clockwork = new Set<Part>();

  constructor(
    readonly def: FieldDef,
    readonly host: FieldHost,
  ) {
    this.grid = def.grid ? new Grid(def.grid) : null;
    this.turnsLeft = def.turns ?? 0;
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
    this.findClockwork();
    for (const part of this.parts) part.resync?.();
  }

  private findClockwork(): void {
    for (const part of this.parts) if (part.timed) this.clockwork.add(part);
    for (let grew = true; grew; ) {
      grew = false;
      for (const part of this.parts) {
        const drive = (part as Part & { drive?: Drive | null }).drive;
        if (this.clockwork.has(part) || !drive || drive.sources.length === 0) continue;
        if (!drive.sources.every((source) => this.clockwork.has(source.part))) continue;
        this.clockwork.add(part);
        grew = true;
      }
    }
  }

  /**
   * True if there is anything here for a stroke taken back to put back (SPEC v6 3.1):
   * a part the ball can change. Works that only keep time, a gate on the beat or a belt
   * that never turns, are the same after any stroke as before it.
   */
  get rewindable(): boolean {
    return this.clockwork.size < this.parts.length;
  }

  /** True for a part that keeps time and nothing else. */
  isClockwork(id: string): boolean {
    return this.clockwork.has(this.part(id));
  }

  /** The clock a part keeps, for the moving parts that run on it. */
  clock(id: string): LocalClock {
    const part = this.part(id) as Part & Partial<LocalClock>;
    if (typeof part.at !== 'function') throw new Error(`Part "${id}" keeps no clock of its own`);
    return part as Part & LocalClock;
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

  /** True while any part is on its way somewhere. One that keeps time never holds a stroke open. */
  get busy(): boolean {
    return this.parts.some((part) => part.busy && !this.clockwork.has(part));
  }

  /** The part that is on the move, for the camera to watch while the ball waits. */
  get active(): Part | null {
    return this.parts.find((part) => part.busy && !part.discreet && !this.clockwork.has(part)) ?? null;
  }

  /** Turns of a wall group the hole allows in all, and how many of them stand: one taken back with a stroke is not counted. */
  get turnsAllowed(): number {
    return this.def.turns ?? 0;
  }

  get turnsUsed(): number {
    return this.turnsAllowed - this.turnsLeft;
  }

  /** True while any wall group is swinging round. */
  get turning(): boolean {
    return this.parts.some((part) => isTurnable(part) && part.turning);
  }

  /** Whether the player can turn the part called `id` right now. */
  turnCheck(id: string): TurnCheck {
    const part = this.byId.get(id);
    if (!part || !isTurnable(part)) return 'none';
    if (this.turning) return 'turning';
    if (this.turnsLeft <= 0) return 'spent';
    return part.blocked ? 'blocked' : 'ok';
  }

  /** Turns a wall group, at the cost of one of the hole's turns. Returns false if it cannot be turned right now. */
  turn(id: string): boolean {
    if (this.turnCheck(id) !== 'ok') return false;
    this.turnsLeft--;
    (this.part(id) as Turnable).turn();
    return true;
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
    part?.hit?.(ball, speed, colliderHandle);
    return part !== undefined;
  }

  forbidsRest(point: XYZ): Part | null {
    return this.parts.find((part) => part.forbidsRest?.(point)) ?? null;
  }

  save(): FieldState {
    return { alert: this.alert, turns: this.turnsLeft, parts: this.parts.map((part) => part.save()) };
  }

  /** Puts every part back the way a snapshot has it. Nothing makes a sound. A part that keeps time is left running. */
  restore(state: FieldState): void {
    this.alert = state.alert;
    this.turnsLeft = state.turns;
    this.parts.forEach((part, i) => {
      if (!this.clockwork.has(part)) part.load(state.parts[i]);
    });
    for (const part of this.parts) part.resync?.();
    for (const system of this.systems.values()) system.reset?.();
  }
}

/** A point on the ground as a runtime vector. */
export const ground = (at: Vec3): XYZ => ({ x: at[0], y: at[1], z: at[2] });

/** Midpoint of two points on the ground at height `y`. */
export const midpoint = (a: Vec2, b: Vec2, y = 0): XYZ => ({ x: (a[0] + b[0]) / 2, y, z: (a[1] + b[1]) / 2 });
