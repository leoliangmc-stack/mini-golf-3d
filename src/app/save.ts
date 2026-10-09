export const QUALITIES = ['auto', 'low', 'medium', 'high'] as const;
export type Quality = (typeof QUALITIES)[number];

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

/** Version of the save format this build writes. Bump it together with a new entry in MIGRATIONS. */
export const SAVE_VERSION = 9;

export interface SaveData {
  version: typeof SAVE_VERSION;
  holes: Record<string, HoleRecord>;
  settings: Settings;
  /** Id of the hole last played, for PLAY to resume from. */
  last: string | null;
  /**
   * Set when this save was carried over from an older version and that has not been
   * reported to analytics yet: the version it came from.
   */
  migratedFrom?: number;
}

export const DEFAULT_SETTINGS: Settings = { lang: null, sfx: true, music: true, quality: 'auto' };

export const freshSave = (): SaveData => ({
  version: SAVE_VERSION,
  holes: {},
  settings: { ...DEFAULT_SETTINGS },
  last: null,
});

type Loose = Record<string, unknown>;

/**
 * One step per version: MIGRATIONS[n] turns a version-n save into a version n+1 save.
 * A save is brought up to date by running every step from its own version onward.
 * Steps only reshape data. They never drop a score.
 */
const MIGRATIONS: Record<number, (save: Loose) => Loose> = {
  // 1 -> 2, Chapter 2. Hole ids did not change, and what is unlocked is worked out from
  // the records rather than stored, so every star and best score carries over as it is.
  // The Chapter 1 finale and all of Chapter 2 have no record yet, which is what locked
  // means: the finale opens by itself for a player who had finished all 18 holes.
  1: (save) => ({ ...save, version: 2 }),
  // 2 -> 3, Chapter 3. The same again: no hole changed its id, so every record carries
  // over as it is, and Chapter 3 is locked simply because nothing in it has a record.
  // It opens by itself for a player who had finished the Chapter 2 finale.
  2: (save) => ({ ...save, version: 3 }),
  // 3 -> 4, Chapter 4. Once more nothing changes shape. Chapter 4 has no record yet, and
  // it opens with the Chapter 2 finale rather than the Chapter 3 one, so a player who
  // had finished Chapter 2 finds it open whether or not Chapter 3 is done.
  3: (save) => ({ ...save, version: 4 }),
  // 4 -> 5, Chapter 5. The same again. Chapter 5 opens with the Chapter 4 finale, so a
  // player who had finished that one finds its first hole open.
  4: (save) => ({ ...save, version: 5 }),
  // 5 -> 6, Chapter 6. And again. Chapter 6 opens with the Chapter 5 finale, so a
  // player who had finished that one finds its first hole open.
  5: (save) => ({ ...save, version: 6 }),
  // 6 -> 7, Chapter 7. Nothing changes shape this time either. Chapter 7 opens with the
  // Chapter 6 finale, so a player who had finished that one finds its first hole open.
  6: (save) => ({ ...save, version: 7 }),
  // 7 -> 8, Chapter 8. The same once more. Chapter 8 opens with the Chapter 7 finale, so
  // a player who had finished that one finds its first hole open.
  7: (save) => ({ ...save, version: 8 }),
  // 8 -> 9, Chapter 9, the last. The same once more. Chapter 9 opens with the Chapter 8
  // finale, so a player who had finished that one finds its first hole open.
  8: (save) => ({ ...save, version: 9 }),
};

export interface LoadedSave {
  data: SaveData;
  /** Version the stored save was written by, if it had to be migrated. */
  migratedFrom: number | null;
}

/**
 * Parses a stored save of any known version into the current format. Returns null for
 * anything unusable: nothing stored, broken JSON, or a version this build does not know.
 * Records for holes that do not exist, and records that make no sense, are dropped.
 */
export function readSave(raw: string | null | undefined, knownHoles: ReadonlySet<string>): LoadedSave | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  let save = parsed as Loose;
  const stored = save.version;
  if (typeof stored !== 'number' || !Number.isInteger(stored) || stored < 1 || stored > SAVE_VERSION) return null;
  for (let version = stored; version < SAVE_VERSION; version++) save = MIGRATIONS[version](save);

  const data = freshSave();
  const holes = typeof save.holes === 'object' && save.holes !== null ? (save.holes as Loose) : {};
  for (const [id, value] of Object.entries(holes)) {
    const record = value as Partial<HoleRecord> | null;
    const stars = record?.stars;
    const strokes = record?.strokes;
    const valid = (stars === 1 || stars === 2 || stars === 3) && typeof strokes === 'number' && Number.isFinite(strokes);
    if (knownHoles.has(id) && valid) data.holes[id] = { stars, strokes };
  }
  if (typeof save.settings === 'object' && save.settings !== null) {
    // Field by field: a value this build does not know (an edited store, or a save
    // written by a newer build before a rollback) falls back to the default instead
    // of reaching the renderer or the text tables, where it would stop the game from
    // starting at all, every time, with nothing ever rewriting the save.
    const stored = save.settings as Loose;
    const settings = { ...DEFAULT_SETTINGS };
    if (stored.lang === 'en' || stored.lang === 'zh') settings.lang = stored.lang;
    if (QUALITIES.includes(stored.quality as Quality)) settings.quality = stored.quality as Quality;
    if (typeof stored.sfx === 'boolean') settings.sfx = stored.sfx;
    if (typeof stored.music === 'boolean') settings.music = stored.music;
    data.settings = settings;
  }
  data.last = typeof save.last === 'string' ? save.last : null;
  if (stored < SAVE_VERSION) data.migratedFrom = stored;
  else if (typeof save.migratedFrom === 'number') data.migratedFrom = save.migratedFrom;
  return { data, migratedFrom: stored < SAVE_VERSION ? stored : null };
}
