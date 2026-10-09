import type { Outcome } from '../game/session';
import { allHoles, chapterOf, stagesOf } from '../level/chapters';
import type { ChapterDef, WorldDef } from '../level/schema';
import { freshSave, readSave, type HoleRecord, type SaveData, type Settings } from './save';

export type { HoleRecord, Quality, Settings } from './save';

/** The part of localStorage this module needs, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'minigolf.save.v8';
/**
 * Where versions 7, 6, 5, 4, 3, 2 and 1 kept their saves, newest first. An older save is read once, to
 * carry the scores over, and never written again: an older build does not understand a
 * newer save and would start the player from nothing, so if this build is ever rolled
 * back, the save that build wrote is still there for it.
 */
const LEGACY_KEYS = [
  'minigolf.save.v7',
  'minigolf.save.v6',
  'minigolf.save.v5',
  'minigolf.save.v4',
  'minigolf.save.v3',
  'minigolf.save',
  'minigolf.save.v1',
];

/**
 * localStorage if it can be read here, otherwise null: private browsing may block it.
 * Only reading is probed. A store that is full can still hand back the save it holds,
 * and `save` already copes with a write that fails.
 */
export function safeStorage(): StorageLike | null {
  try {
    const storage = window.localStorage;
    storage.getItem(KEY);
    return storage;
  } catch {
    return null;
  }
}

/** A hole, as the world (or finale) it is in and its place there. */
export interface HoleRef {
  world: WorldDef;
  index: number;
}

/**
 * Best scores, unlocks and settings. Everything is kept in memory and mirrored to
 * storage when storage is available; without it the game plays the same, unsaved.
 */
export class Progress {
  /** Development switch: treats every hole as unlocked. */
  unlockAll = false;
  private data: SaveData;
  /** Every hole of every chapter, in play order. */
  private readonly order: HoleRef[];

  constructor(
    readonly chapters: readonly ChapterDef[],
    private readonly storage: StorageLike | null,
  ) {
    this.order = chapters.flatMap((chapter) =>
      stagesOf(chapter).flatMap((world) => world.holes.map((_, index) => ({ world, index }))),
    );
    this.data = this.load();
  }

  get settings(): Readonly<Settings> {
    return this.data.settings;
  }

  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.data.settings[key] = value;
    this.save();
  }

  record(holeId: string): HoleRecord | null {
    return this.data.holes[holeId] ?? null;
  }

  /** Number of holes with a score. */
  get completedHoles(): number {
    return Object.keys(this.data.holes).length;
  }

  /**
   * The save version this player's scores were carried over from, until that has been
   * reported (see `migrationReported`). Null for everyone else.
   */
  get migratedFrom(): number | null {
    return this.data.migratedFrom ?? null;
  }

  /** Call once analytics has taken the migration event, so it is sent exactly once. */
  migrationReported(): void {
    if (this.data.migratedFrom === undefined) return;
    delete this.data.migratedFrom;
    this.save();
  }

  /** Stores a finished hole, keeping the best stars and the fewest strokes seen. */
  complete(holeId: string, outcome: Outcome): void {
    const previous = this.data.holes[holeId];
    this.data.holes[holeId] = {
      stars: Math.max(outcome.stars, previous?.stars ?? 1) as 1 | 2 | 3,
      strokes: Math.min(outcome.strokes, previous?.strokes ?? Infinity),
    };
    this.save();
  }

  setLast(holeId: string): void {
    this.data.last = holeId;
    this.save();
  }

  /**
   * Linear unlock (SPEC 2.7, v2 2.8): within a chapter a hole opens when the one before
   * it has been finished, through the chapter's worlds and then its finale. The first
   * hole of a chapter opens with the finale of the chapter that leads to it, which is
   * the one before it unless the chapter says otherwise (SPEC v4 3.1).
   */
  isUnlocked(world: WorldDef, index: number): boolean {
    if (this.unlockAll) return true;
    const chapter = chapterOf(this.chapters, world);
    // Anything outside the play order (the dev sandbox) is always open.
    if (!chapter) return true;
    const stages = stagesOf(chapter);
    const stage = stages.indexOf(world);
    if (index === 0 && stage === 0) {
      const opener = this.opener(chapter);
      return opener === null || this.record(opener.finale.holes[0].id) !== null;
    }
    const before = index > 0 ? world.holes[index - 1] : stages[stage - 1].holes.at(-1)!;
    return this.record(before.id) !== null;
  }

  /** The chapter whose finale opens this one, or null for a chapter that is open from the start. */
  opener(chapter: ChapterDef): ChapterDef | null {
    if (chapter.after !== undefined) {
      const named = this.chapters.find((other) => other.id === chapter.after);
      if (!named) throw new Error(`Chapter "${chapter.id}" opens after "${chapter.after}", which does not exist`);
      return named;
    }
    return this.chapters[this.chapters.indexOf(chapter) - 1] ?? null;
  }

  chapterUnlocked(chapter: ChapterDef): boolean {
    return this.isUnlocked(chapter.worlds[0] ?? chapter.finale, 0);
  }

  /** True once every hole of the game has a score. */
  get allComplete(): boolean {
    return this.order.every((ref) => this.record(ref.world.holes[ref.index].id) !== null);
  }

  worldStars(world: WorldDef): number {
    return world.holes.reduce((sum, hole) => sum + (this.record(hole.id)?.stars ?? 0), 0);
  }

  /** The hole after this one in play order, or null after the very last. */
  next(world: WorldDef, index: number): HoleRef | null {
    const position = this.order.findIndex((ref) => ref.world === world && ref.index === index);
    return this.order[position + 1] ?? null;
  }

  /**
   * Where PLAY goes. Back to the hole last played if it is still unfinished; otherwise
   * on to the first hole without a score, which is where new content shows up for a
   * returning player; and once everything is finished, back to the hole last played.
   */
  resume(): HoleRef {
    const id = (ref: HoleRef) => ref.world.holes[ref.index].id;
    const last = this.order.find((ref) => id(ref) === this.data.last);
    const open = last !== undefined && this.isUnlocked(last.world, last.index);
    if (last && open && this.record(id(last)) === null) return last;
    // With two chapters open side by side, the first hole without a score may be in one
    // the player cannot enter yet: the frontier is the first that is open.
    const frontier = this.order.find((ref) => this.record(id(ref)) === null && this.isUnlocked(ref.world, ref.index));
    if (frontier) return frontier;
    return last && open ? last : this.order[this.order.length - 1];
  }

  private load(): SaveData {
    const known = new Set(allHoles(this.chapters).map((hole) => hole.id));
    const read = (key: string) => {
      try {
        return readSave(this.storage?.getItem(key), known);
      } catch {
        return null;
      }
    };
    const current = read(KEY);
    if (current) return current.data;
    for (const key of LEGACY_KEYS) {
      const legacy = read(key);
      if (!legacy) continue;
      this.data = legacy.data;
      // Written at once under the new key, so the migration happens exactly one time.
      this.save();
      return legacy.data;
    }
    return freshSave();
  }

  private save(): void {
    try {
      this.absorbStored();
      this.storage?.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Storage full or blocked: keep playing with what is in memory.
    }
  }

  /**
   * Takes in any score written to the store by another tab since this one loaded,
   * keeping the better of the two for each hole, so that writing the whole save back
   * cannot throw away a hole finished elsewhere. Settings and the hole last played
   * are this tab's own.
   */
  private absorbStored(): void {
    if (!this.storage) return;
    const known = new Set(allHoles(this.chapters).map((hole) => hole.id));
    const stored = readSave(this.storage.getItem(KEY), known);
    if (!stored) return;
    for (const [id, record] of Object.entries(stored.data.holes)) {
      const mine = this.data.holes[id];
      if (!mine) this.data.holes[id] = record;
      else if (record.stars > mine.stars || record.strokes < mine.strokes) {
        this.data.holes[id] = {
          stars: Math.max(record.stars, mine.stars) as 1 | 2 | 3,
          strokes: Math.min(record.strokes, mine.strokes),
        };
      }
    }
  }
}
