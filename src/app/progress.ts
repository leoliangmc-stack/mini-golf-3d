import type { Outcome } from '../game/session';
import type { WorldDef } from '../level/schema';

export type Quality = 'auto' | 'low' | 'medium' | 'high';

export interface Settings {
  /** Null follows the browser language. */
  lang: 'en' | 'zh' | null;
  sfx: boolean;
  music: boolean;
  quality: Quality;
}

export interface HoleRecord {
  stars: 1 | 2 | 3;
  strokes: number;
}

interface SaveData {
  version: 1;
  holes: Record<string, HoleRecord>;
  settings: Settings;
  /** Id of the hole last played, for PLAY to resume from. */
  last: string | null;
}

/** The part of localStorage this module needs, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'minigolf.save.v1';
const DEFAULT_SETTINGS: Settings = { lang: null, sfx: true, music: true, quality: 'auto' };

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
  /** Every hole of every world, in play order. */
  private readonly order: HoleRef[];

  constructor(
    private readonly worlds: readonly WorldDef[],
    private readonly storage: StorageLike | null,
  ) {
    this.order = worlds.flatMap((world) => world.holes.map((_, index) => ({ world, index })));
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

  /** Linear unlock (SPEC 2.7): a hole opens when the one before it has been finished. */
  isUnlocked(world: WorldDef, index: number): boolean {
    if (this.unlockAll) return true;
    const position = this.order.findIndex((ref) => ref.world === world && ref.index === index);
    // The first hole is always open, and so is anything outside the play order (the dev sandbox).
    if (position <= 0) return true;
    const before = this.order[position - 1];
    return this.record(before.world.holes[before.index].id) !== null;
  }

  worldStars(world: WorldDef): number {
    return world.holes.reduce((sum, hole) => sum + (this.record(hole.id)?.stars ?? 0), 0);
  }

  /** The hole after this one in play order, or null after the very last. */
  next(world: WorldDef, index: number): HoleRef | null {
    const position = this.order.findIndex((ref) => ref.world === world && ref.index === index);
    return this.order[position + 1] ?? null;
  }

  /** Where PLAY goes: the last hole played if it is still open, else the first unfinished one. */
  resume(): HoleRef {
    const last = this.order.find((ref) => ref.world.holes[ref.index].id === this.data.last);
    if (last && this.isUnlocked(last.world, last.index)) return last;
    return (
      this.order.find((ref) => this.record(ref.world.holes[ref.index].id) === null) ??
      this.order[this.order.length - 1]
    );
  }

  private load(): SaveData {
    const fresh: SaveData = { version: 1, holes: {}, settings: { ...DEFAULT_SETTINGS }, last: null };
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return fresh;
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (parsed.version !== 1) return fresh;
      const known = new Set(this.worlds.flatMap((world) => world.holes.map((hole) => hole.id)));
      for (const [id, record] of Object.entries(parsed.holes ?? {})) {
        const stars = record?.stars;
        const valid = (stars === 1 || stars === 2 || stars === 3) && Number.isFinite(record.strokes);
        if (known.has(id) && valid) fresh.holes[id] = { stars, strokes: record.strokes };
      }
      fresh.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
      fresh.last = typeof parsed.last === 'string' ? parsed.last : null;
      return fresh;
    } catch {
      return fresh;
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Storage full or blocked: keep playing with what is in memory.
    }
  }
}
