import type { CompiledHole } from '../../level/compile';
import type { HoleDef, WorldDef } from '../../level/schema';
import type { Stage } from '../scene';
import { buildDesignSet, designName, type DesignSet } from './designSet';
import { roomLight } from './library';
import { placeScenery, type SceneryView } from './sceneryView';

type DesignModule = typeof import('./design.js');

/**
 * The scenery round the course: each world's scene from the design project, set round
 * whichever of its holes is being played. The scene code is a download of its own, made
 * once and kept; a world's scene is built the first time one of its holes is shown,
 * and kept while the player stays in that world.
 */
export class Scenery {
  private module: Promise<DesignModule> | null = null;
  private built: { key: string; set: DesignSet | null } | null = null;
  private shown: SceneryView | null = null;
  /** Counts the holes asked for: a scene that is ready after the player has moved on is not shown. */
  private asked = 0;

  constructor(private readonly stage: Stage) {}

  /** The scenery round the hole now, once it is there. */
  get view(): SceneryView | null {
    return this.shown;
  }

  /** Starts fetching the scene code, ahead of the first hole that needs it. */
  preload(): void {
    this.design().catch(() => {});
  }

  /**
   * Puts a world's scenery round a hole, in place of what was there. Straight away if the
   * world's scene is built; else the hole shows first, and its scenery as soon as it is ready.
   */
  show(world: WorldDef, compiled: CompiledHole, hole: HoleDef, number: number): void {
    const ask = ++this.asked;
    this.clear();
    const quality = this.stage.quality;
    const name = designName(world.id);
    const key = `${name}|${JSON.stringify(quality.scenery)}`;
    const place = (set: DesignSet | null) => {
      if (ask !== this.asked || !set) return;
      this.shown = placeScenery(set, compiled, hole, number, {
        shadows: quality.shadows,
        shadowMapSize: quality.shadowMapSize,
        lamps: quality.scenery.lamps,
      });
      this.stage.setScenery(this.shown);
    };
    if (this.built?.key === key) {
      place(this.built.set);
      return;
    }
    this.design()
      .then((design) => {
        if (ask !== this.asked) return;
        // In a task of its own, so that the hole is drawn before the scene is built.
        setTimeout(() => {
          if (ask !== this.asked) return;
          this.built?.set?.dispose();
          const set = buildDesignSet(design.build, name, roomLight(this.stage.renderer), quality.scenery);
          this.built = { key, set };
          place(set);
        }, 0);
      })
      .catch((error: unknown) => console.error('The scenery could not be loaded', error));
  }

  /** Takes the scenery away. */
  clear(): void {
    if (!this.shown) return;
    this.stage.setScenery(null);
    this.shown.dispose();
    this.shown = null;
  }

  private design(): Promise<DesignModule> {
    // A download that failed is tried again at the next hole.
    this.module ??= import('./design.js').catch((error: unknown) => {
      this.module = null;
      throw error;
    });
    return this.module;
  }
}
