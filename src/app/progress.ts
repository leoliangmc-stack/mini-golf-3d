import type { Outcome } from '../game/session';
import { allHoles, stagesOf } from '../level/chapters';
import type { ChapterDef, WorldDef } from '../level/schema';
import { freshSave, readSave, type HoleRecord, type SaveData, type Settings } from './save';

export type { HoleRecord, Quality, Settings } from './save';

/** The part of localStorage this module needs, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'minigolf.save.v3';
/**
 * Where versions 2 and 1 kept their saves, newest first. An older save is read once, to
 * carry the scores over, and never written again: an older build does not understand a
 * newer save and would start the player from nothing, so if this build is ever rolled
 * back, the save that build wrote is still there for it.
 */
const LEGACY_KEYS = ['minigolf.save', 'minigolf.save.v1'];

/** localStorage if it works here, otherwise null: private browsing may block it. */
export function safeStorage(): StorageLike | null {
  try {
    const storage = window.localStorage;
    storage.setItem(`${KEY}.probe`, '1');
    storage.removeItem(`${KEY}.probe`);
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
   * Linear unlock (SPEC 2.7, v2 2.8): a hole opens when the one before it has been
   * finished. The order runs through each chapter's worlds, then its finale, then on
   * into the next chapter.
   */
  isUnlocked(world: WorldDef, index: number): boolean {
    if (this.unlockAll) return true;
    const position = this.order.findIndex((ref) => ref.world === world && ref.index === index);
    // The first hole is always open, and so is anything outside the play order (the dev sandbox).
    if (position <= 0) return true;
    const before = this.order[position - 1];
    return this.record(before.world.holes[before.index].id) !== null;
  }

  /** A chapter is open once the finale of the chapter before it has been finished. */
  chapterUnlocked(chapter: ChapterDef): boolean {
    return this.isUnlocked(chapter.worlds[0] ?? chapter.finale, 0);
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
    const frontier = this.order.find((ref) => this.record(id(ref)) === null);
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
      this.storage?.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Storage full or blocked: keep playing with what is in memory.
    }
  }
}
