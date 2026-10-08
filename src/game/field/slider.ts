import type { XYZ } from '../../core/types';
import type { SliderDef } from '../../level/field';
import { Mover, type MoverPose } from '../../physics/movers';
import { Drive, type Field, type Part } from './field';

const DEFAULT_TICKS = 60;

interface SliderState {
  drive: ReturnType<Drive['save']>;
  travelled: number;
}

/**
 * A block that makes one journey when its signal arrives and stays where it ends up
 * (SPEC v4 3.5): a bridge rising out of a pit, a boulder rolling across. It is a moving
 * part like any other (physics/movers.ts), only on a signal instead of a schedule, so a
 * ball rides its top and is carried by it exactly as on a platform. Its signal: it has
 * arrived. That is what lets one part start the next, and so a chain.
 */
export class Slider implements Part {
  readonly kind = 'slider';
  readonly anchor: XYZ;
  readonly drive: Drive;
  readonly mover: Mover;
  private readonly ticks: number;
  /** Ticks of the journey done. */
  private travelled = 0;

  constructor(
    readonly def: SliderDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.ticks = Math.max(1, def.ticks ?? DEFAULT_TICKS);
    this.anchor = { x: def.to[0], y: def.to[1] + def.size[1] / 2, z: def.to[2] };
    this.drive = new Drive(field, { ...def, latch: def.latch ?? true }, this);
    const { world, surfaces } = field.host;
    this.mover = new Mover(
      // The motion is never read: the schedule below replaces it.
      { role: def.role, size: def.size, position: def.from, surface: def.surface, motion: { type: 'slide', offset: [0, 0, 0], period: 1 } },
      world,
      surfaces,
      () => this.pose(),
    );
  }

  wire(): void {
    this.drive.wire();
  }

  /** How much of the journey is done, 0 to 1. */
  get progress(): number {
    return this.travelled / this.ticks;
  }

  get on(): boolean {
    return this.travelled === this.ticks;
  }

  get busy(): boolean {
    return this.drive.pending || (this.travelled > 0 && this.travelled < this.ticks);
  }

  private pose(): MoverPose {
    const u = this.travelled / this.ticks;
    const s = u * u * (3 - 2 * u);
    const { from, to } = this.def;
    return {
      position: {
        x: from[0] + (to[0] - from[0]) * s,
        y: from[1] + (to[1] - from[1]) * s,
        z: from[2] + (to[2] - from[2]) * s,
      },
      yaw: 0,
    };
  }

  step(): void {
    const active = this.drive.step();
    const { host } = this.field;
    if (active && this.travelled < this.ticks) {
      if (this.travelled === 0) {
        host.cue('sliderStart');
        host.changed(this.id);
      }
      this.travelled++;
      if (this.travelled === this.ticks) host.cue('sliderStop');
    } else if (!active && this.travelled > 0) {
      this.travelled--;
    }
    this.mover.preStep(host.world, host.balls());
  }

  postStep(): void {
    this.mover.postStep();
  }

  save(): SliderState {
    return { drive: this.drive.save(), travelled: this.travelled };
  }

  load(state: unknown): void {
    const { drive, travelled } = state as SliderState;
    this.drive.load(drive);
    this.travelled = travelled;
    this.mover.snap(this.field.host.world);
  }
}
