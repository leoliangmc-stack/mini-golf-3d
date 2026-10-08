import { cos, sin } from '../../core/math';
import type { XYZ } from '../../core/types';
import type { CrystalDef, EmitterDef, ReceiverDef } from '../../level/field';
import type { Ball } from '../../physics/ball';
import { RAPIER } from '../../physics/rapier';
import { getSurface } from '../../physics/surfaces';
import { Drive, ground, type Field, type FieldSystem, type Part } from './field';

const RAD = Math.PI / 180;
/** Height of a beam above the ground: over the walls, the gates and the stones. */
export const BEAM_HEIGHT = 1.05;
/** A beam that meets nothing is drawn this far and no further. */
const BEAM_RANGE = 40;
/**
 * The most stretches one beam can have (SPEC v4 4.5). Crystals pointing at each other
 * would otherwise pass the light round for ever.
 */
export const MAX_BEAM_SEGMENTS = 8;
/** How near a crystal's centre a beam has to pass to be caught. */
const CRYSTAL_CATCH = 0.3;
const RECEIVER_CATCH = 0.35;
/** A ball has to change its velocity by this much against a crystal, in m/s, to turn it. */
const TURN_SPEED = 0.3;
/** Ticks after a turn in which a crystal does not turn again: one knock is one turn. */
const TURN_COOLDOWN = 20;

/** Radius of the pedestal a ball bounces off. */
export const CRYSTAL_RADIUS = 0.28;
/** Radius of the post an emitter or a receiver stands on. */
export const POST_RADIUS = 0.2;

/** A post standing on the ground, for a ball to bounce off rather than roll through. */
function post(field: Field, at: readonly [number, number, number], radius: number): RAPIER.Collider {
  const collider = field.host.world.raw.createCollider(
    RAPIER.ColliderDesc.cylinder(0.5, radius)
      .setTranslation(at[0], at[1] + 0.5, at[2])
      .setFriction(0)
      .setRestitution(getSurface('crystal').restitution)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
  );
  field.host.surfaces.setCollider(collider.handle, 'prop', 'crystal');
  return collider;
}

/** Unit vector on the ground for a compass heading in degrees: 0 is -Z, 90 is +X. */
export function headingVector(heading: number): { x: number; z: number } {
  return { x: sin(heading * RAD), z: -cos(heading * RAD) };
}

/** One beam: the points it runs through, and whether it ends on a receiver. */
export interface Beam {
  points: XYZ[];
  home: boolean;
}

/**
 * Traces every beam of the hole (SPEC v4 4.5). Light is worked out again only when
 * something that bends it has changed, not every tick: nothing about a beam depends on
 * time. A ball neither blocks a beam nor feels it.
 */
export class Light implements FieldSystem {
  beams: Beam[] = [];
  /** Goes up each time the beams are traced, so a picture knows when to redraw. */
  version = 0;
  private stale = true;

  constructor(private readonly field: Field) {}

  /** Call when a crystal has turned or an emitter has come on or gone off. */
  changed(): void {
    this.stale = true;
  }

  reset(): void {
    this.stale = true;
    this.update();
  }

  update(): void {
    if (!this.stale) return;
    this.stale = false;
    this.version++;
    const crystals = this.field.all<Crystal>('crystal');
    const receivers = this.field.all<Receiver>('receiver');
    for (const crystal of crystals) crystal.lit = false;
    for (const receiver of receivers) receiver.lit = false;
    this.beams = this.field
      .all<Emitter>('emitter')
      .filter((emitter) => emitter.on)
      .map((emitter) => this.trace(emitter, crystals, receivers));
  }

  private trace(emitter: Emitter, crystals: readonly Crystal[], receivers: readonly Receiver[]): Beam {
    let from = emitter.anchor;
    let dir = headingVector(emitter.def.heading);
    let leaving: Crystal | null = null;
    const seen = new Set<Crystal>();
    const lift = (p: XYZ): XYZ => ({ x: p.x, y: p.y + BEAM_HEIGHT, z: p.z });
    const points = [lift(from)];

    for (let segment = 0; segment < MAX_BEAM_SEGMENTS; segment++) {
      // The nearest thing the ray passes close enough to.
      let nearest = BEAM_RANGE;
      let crystal: Crystal | null = null;
      let receiver: Receiver | null = null;
      const consider = (at: XYZ, radius: number): boolean => {
        const dx = at.x - from.x;
        const dz = at.z - from.z;
        const along = dx * dir.x + dz * dir.z;
        if (along <= 1e-6 || along >= nearest) return false;
        if (dx * dx + dz * dz - along * along > radius * radius) return false;
        nearest = along;
        return true;
      };
      for (const candidate of crystals) {
        if (candidate !== leaving && consider(candidate.anchor, CRYSTAL_CATCH)) {
          crystal = candidate;
          receiver = null;
        }
      }
      for (const candidate of receivers) {
        if (consider(candidate.anchor, candidate.radius)) {
          receiver = candidate;
          crystal = null;
        }
      }

      if (receiver) {
        receiver.lit = true;
        points.push(lift(receiver.anchor));
        return { points, home: true };
      }
      if (!crystal) {
        points.push(lift({ x: from.x + dir.x * BEAM_RANGE, y: from.y, z: from.z + dir.z * BEAM_RANGE }));
        return { points, home: false };
      }
      crystal.lit = true;
      points.push(lift(crystal.anchor));
      // Back at a crystal it has been through: the light is going round in circles.
      if (seen.has(crystal)) break;
      seen.add(crystal);
      from = crystal.anchor;
      dir = headingVector(crystal.facing);
      leaving = crystal;
    }
    return { points, home: false };
  }
}

const light = (field: Field): Light => field.system('light', () => new Light(field));

/** Where a beam starts (SPEC v4 3.4). Its signal: it is shining. */
export class Emitter implements Part {
  readonly kind = 'emitter';
  readonly anchor: XYZ;
  readonly busy = false;
  on: boolean;
  private readonly drive: Drive | null;

  constructor(
    readonly def: EmitterDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.anchor = ground(def.at);
    this.drive = def.when === undefined ? null : new Drive(field, { ...def, when: def.when }, this);
    this.on = this.drive === null;
    post(field, def.at, POST_RADIUS);
    light(field);
  }

  wire(): void {
    this.drive?.wire();
  }

  step(): void {
    if (!this.drive) return;
    const on = this.drive.step();
    if (on === this.on) return;
    this.on = on;
    light(this.field).changed();
  }

  save(): unknown {
    return this.drive?.save() ?? null;
  }

  load(state: unknown): void {
    if (!this.drive) return;
    this.drive.load(state as ReturnType<Drive['save']>);
    this.on = this.drive.active;
  }
}

/**
 * A crystal (SPEC v4 3.4). Light that reaches it leaves the way it points; a ball that
 * runs into it turns it to its next facing. Its signal: light is passing through it.
 */
export class Crystal implements Part {
  readonly kind = 'crystal';
  readonly anchor: XYZ;
  readonly busy = false;
  /** Which of its facings it points along. */
  index: number;
  /** Light is passing through it. Set by the tracer. */
  lit = false;
  private cooldown = 0;

  constructor(
    readonly def: CrystalDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    if (def.facings.length < 2) throw new Error(`Crystal "${id}" needs at least two facings`);
    this.anchor = ground(def.at);
    this.index = def.start ?? 0;
    field.own(post(field, def.at, CRYSTAL_RADIUS).handle, this);
    light(field);
  }

  get on(): boolean {
    return this.lit;
  }

  /** Compass heading it points along, in degrees. */
  get facing(): number {
    return this.def.facings[this.index];
  }

  /** The heading the next knock will turn it to. */
  get nextFacing(): number {
    return this.def.facings[(this.index + 1) % this.def.facings.length];
  }

  hit(_ball: Ball, speed: number): void {
    if (this.cooldown > 0 || speed < TURN_SPEED) return;
    this.index = (this.index + 1) % this.def.facings.length;
    this.cooldown = TURN_COOLDOWN;
    this.field.host.cue('crystalTurn');
    light(this.field).changed();
  }

  step(): void {
    if (this.cooldown > 0) this.cooldown--;
  }

  save(): number {
    return this.index;
  }

  load(state: unknown): void {
    this.index = state as number;
    this.cooldown = 0;
  }
}

/**
 * What a beam is aimed at (SPEC v4 3.4). Its signal comes on when light first reaches
 * it and stays on: the gate it opens is open for good.
 */
export class Receiver implements Part {
  readonly kind = 'receiver';
  readonly anchor: XYZ;
  readonly radius: number;
  readonly busy = false;
  /** Light is on it right now. Set by the tracer. */
  lit = false;
  private latched = false;

  constructor(
    readonly def: ReceiverDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.anchor = ground(def.at);
    this.radius = def.radius ?? RECEIVER_CATCH;
    post(field, def.at, POST_RADIUS);
    light(field);
  }

  get on(): boolean {
    return this.latched;
  }

  step(): void {
    if (!this.lit || this.latched) return;
    this.latched = true;
    this.field.host.cue('beamLock');
    this.field.host.changed(this.id);
  }

  save(): boolean {
    return this.latched;
  }

  load(state: unknown): void {
    this.latched = state as boolean;
  }
}
