import { describe, expect, it } from 'vitest';
import { Progress, type StorageLike } from '../src/app/progress';
import { readSave, SAVE_VERSION, type HoleRecord } from '../src/app/save';
import { CHAPTERS } from '../src/data/chapters';
import { allHoles } from '../src/level/chapters';

const V1_KEY = 'minigolf.save.v1';
const V2_KEY = 'minigolf.save';
const KEY = 'minigolf.save.v3';
const [chapter1, chapter2, chapter3] = CHAPTERS;
const known = new Set(allHoles(CHAPTERS).map((hole) => hole.id));
/** The 18 holes version 1 shipped with, in play order. */
const v1Holes = chapter1.worlds.flatMap((world) => world.holes);

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

/** A save exactly as version 1 wrote it. */
function v1Save(holes: Record<string, HoleRecord>, last: string | null = null): string {
  return JSON.stringify({
    version: 1,
    holes,
    settings: { lang: 'zh', sfx: false, music: true, quality: 'low' },
    last,
  });
}

/** The 32 holes version 2 shipped with, in play order: Chapter 1 with its finale, then Chapter 2 with its own. */
const v2Holes = [...chapter1.worlds, chapter1.finale, ...chapter2.worlds, chapter2.finale].flatMap((world) => world.holes);

/** A save exactly as version 2 wrote it. */
function v2Save(holes: Record<string, HoleRecord>, last: string | null = null, extra: object = {}): string {
  return JSON.stringify({
    version: 2,
    holes,
    settings: { lang: 'en', sfx: true, music: false, quality: 'high' },
    last,
    ...extra,
  });
}

/** Scores for the first `count` holes of version 2, all different so a mix-up would show. */
function v2Scores(count: number): Record<string, HoleRecord> {
  return Object.fromEntries(
    v2Holes.slice(0, count).map((hole, i) => [hole.id, { stars: ((i % 3) + 1) as 1 | 2 | 3, strokes: (i % 7) + 1 }]),
  );
}

/** Scores for the first `count` holes of version 1, all different so a mix-up would show. */
function scores(count: number): Record<string, HoleRecord> {
  return Object.fromEntries(
    v1Holes.slice(0, count).map((hole, i) => [hole.id, { stars: ((i % 3) + 1) as 1 | 2 | 3, strokes: (i % 5) + 1 }]),
  );
}

describe('save migration (SPEC v2 2.11)', () => {
  it('starts fresh when nothing is stored', () => {
    expect(readSave(null, known)).toBeNull();
    expect(readSave('', known)).toBeNull();
    const progress = new Progress(CHAPTERS, memoryStorage());
    expect(progress.completedHoles).toBe(0);
    expect(progress.migratedFrom).toBeNull();
    expect(progress.isUnlocked(chapter1.worlds[0], 0)).toBe(true);
    expect(progress.isUnlocked(chapter1.worlds[0], 1)).toBe(false);
    expect(progress.chapterUnlocked(chapter2)).toBe(false);
  });

  it('carries over a version 1 save with nothing finished', () => {
    const loaded = readSave(v1Save({}), known)!;
    expect(loaded.migratedFrom).toBe(1);
    expect(loaded.data).toEqual({
      version: SAVE_VERSION,
      holes: {},
      settings: { lang: 'zh', sfx: false, music: true, quality: 'low' },
      last: null,
      migratedFrom: 1,
    });
  });

  it('keeps every star and best score of a partly finished version 1 save', () => {
    const before = scores(7);
    const loaded = readSave(v1Save(before, 'sky-2'), known)!;
    expect(loaded.migratedFrom).toBe(1);
    expect(loaded.data.version).toBe(SAVE_VERSION);
    expect(loaded.data.holes).toEqual(before);
    expect(loaded.data.last).toBe('sky-2');
    expect(loaded.data.settings).toEqual({ lang: 'zh', sfx: false, music: true, quality: 'low' });

    const progress = new Progress(CHAPTERS, memoryStorage({ [V1_KEY]: v1Save(before, 'sky-2') }));
    for (const [id, record] of Object.entries(before)) expect(progress.record(id)).toEqual(record);
    expect(progress.completedHoles).toBe(7);
    // Unlocks follow from the scores, as before: the eighth hole is open, the ninth is not.
    const sky = chapter1.worlds[2];
    expect(progress.isUnlocked(sky, 1)).toBe(true);
    expect(progress.isUnlocked(sky, 2)).toBe(false);
    // Nothing new is open yet.
    expect(progress.isUnlocked(chapter1.finale, 0)).toBe(false);
    expect(progress.chapterUnlocked(chapter2)).toBe(false);
    expect(progress.resume()).toEqual({ world: sky, index: 1 });
  });

  it('opens the Chapter 1 finale, and only that, for a player who finished all 18 holes', () => {
    const before = scores(18);
    const progress = new Progress(CHAPTERS, memoryStorage({ [V1_KEY]: v1Save(before, 'gravity-3') }));
    for (const hole of v1Holes) expect(progress.record(hole.id)).toEqual(before[hole.id]);
    expect(progress.completedHoles).toBe(18);
    expect(progress.isUnlocked(chapter1.finale, 0)).toBe(true);
    expect(progress.record(chapter1.finale.holes[0].id)).toBeNull();
    // Chapter 2 exists and is locked until the finale is played.
    expect(progress.chapterUnlocked(chapter2)).toBe(false);
    for (const world of [...chapter2.worlds, chapter2.finale]) {
      for (const [index, hole] of world.holes.entries()) {
        expect(progress.record(hole.id)).toBeNull();
        expect(progress.isUnlocked(world, index)).toBe(false);
      }
    }
    // PLAY takes the returning player straight to the new hole.
    expect(progress.resume()).toEqual({ world: chapter1.finale, index: 0 });
  });

  it('treats a damaged save as no save', () => {
    for (const raw of [
      '{not json',
      'null',
      '[]',
      '"a string"',
      '42',
      JSON.stringify({ holes: { 'ice-1': { stars: 3, strokes: 1 } } }),
      JSON.stringify({ version: '1', holes: {} }),
      JSON.stringify({ version: 0, holes: {} }),
      JSON.stringify({ version: 1.5, holes: {} }),
      JSON.stringify({ version: SAVE_VERSION + 1, holes: {} }),
    ]) {
      expect(readSave(raw, known)).toBeNull();
      const progress = new Progress(CHAPTERS, memoryStorage({ [V1_KEY]: raw }));
      expect(progress.completedHoles).toBe(0);
      expect(progress.migratedFrom).toBeNull();
    }
  });

  it('keeps what is sound in a save that is only partly damaged', () => {
    const raw = JSON.stringify({
      version: 1,
      holes: {
        'ice-1': { stars: 3, strokes: 2 },
        'ice-2': { stars: 7, strokes: 2 },
        'ice-3': { stars: 2, strokes: 'two' },
        'desert-1': null,
        'no-such-hole': { stars: 3, strokes: 1 },
      },
      settings: 'loud',
      last: 12,
    });
    const { data } = readSave(raw, known)!;
    expect(data.holes).toEqual({ 'ice-1': { stars: 3, strokes: 2 } });
    expect(data.settings).toEqual({ lang: null, sfx: true, music: true, quality: 'auto' });
    expect(data.last).toBeNull();
  });
});

describe('migrating once', () => {
  it('writes the new save at once and leaves the version 1 save untouched', () => {
    const original = v1Save(scores(18), 'gravity-3');
    const storage = memoryStorage({ [V1_KEY]: original });
    new Progress(CHAPTERS, storage);
    expect(storage.data[V1_KEY]).toBe(original);
    const written = JSON.parse(storage.data[KEY]);
    expect(written.version).toBe(SAVE_VERSION);
    expect(written.holes).toEqual(scores(18));
  });

  it('prefers the new save once there is one', () => {
    const storage = memoryStorage({ [V1_KEY]: v1Save(scores(3)) });
    const first = new Progress(CHAPTERS, storage);
    first.complete('desert-1', { holed: true, strokes: 1, stars: 3, challengeMet: true, ticks: 10 });
    // The old save is never read again, whatever it says.
    storage.data[V1_KEY] = v1Save(scores(18));
    const second = new Progress(CHAPTERS, storage);
    expect(second.completedHoles).toBe(4);
    expect(second.record('desert-1')).toEqual({ stars: 3, strokes: 1 });
  });

  it('falls back to the version 1 save if the new one is unreadable', () => {
    const storage = memoryStorage({ [KEY]: '{broken', [V1_KEY]: v1Save(scores(5)) });
    expect(new Progress(CHAPTERS, storage).completedHoles).toBe(5);
  });

  it('remembers that the migration is still to be reported, until it has been', () => {
    const storage = memoryStorage({ [V1_KEY]: v1Save(scores(18)) });
    const first = new Progress(CHAPTERS, storage);
    expect(first.migratedFrom).toBe(1);
    // No analytics provider took the event: the next visit still knows.
    const second = new Progress(CHAPTERS, storage);
    expect(second.migratedFrom).toBe(1);
    second.migrationReported();
    expect(second.migratedFrom).toBeNull();
    // Reported: never again.
    const third = new Progress(CHAPTERS, storage);
    expect(third.migratedFrom).toBeNull();
    expect(third.completedHoles).toBe(18);
  });

  it('does not count a brand-new player as migrated', () => {
    const storage = memoryStorage();
    const progress = new Progress(CHAPTERS, storage);
    progress.complete('ice-1', { holed: true, strokes: 2, stars: 2, challengeMet: false, ticks: 10 });
    expect(new Progress(CHAPTERS, storage).migratedFrom).toBeNull();
  });
});

describe('save migration, version 2 to 3 (SPEC v3 2.10)', () => {
  it('keeps every score of a version 2 save exactly as it was (SPEC v3 5.3 #10)', () => {
    for (const count of [0, 1, 19, 25, 32]) {
      const before = v2Scores(count);
      const loaded = readSave(v2Save(before, 'city-2'), known)!;
      expect(loaded.migratedFrom).toBe(2);
      expect(loaded.data.version).toBe(3);
      expect(loaded.data.holes).toEqual(before);
      expect(loaded.data.last).toBe('city-2');
      expect(loaded.data.settings).toEqual({ lang: 'en', sfx: true, music: false, quality: 'high' });

      const progress = new Progress(CHAPTERS, memoryStorage({ [V2_KEY]: v2Save(before, 'city-2') }));
      expect(progress.completedHoles).toBe(count);
      for (const [id, record] of Object.entries(before)) expect(progress.record(id)).toEqual(record);
      // Nothing in Chapter 3 has a score, whatever came before.
      for (const world of [...chapter3.worlds, chapter3.finale]) {
        for (const hole of world.holes) expect(progress.record(hole.id)).toBeNull();
      }
    }
  });

  it('adds Chapter 3 locked, and opens it for a player who finished the Chapter 2 finale', () => {
    const almost = new Progress(CHAPTERS, memoryStorage({ [V2_KEY]: v2Save(v2Scores(31), 'bomb-3') }));
    expect(almost.chapterUnlocked(chapter3)).toBe(false);
    for (const world of [...chapter3.worlds, chapter3.finale]) {
      world.holes.forEach((_, index) => expect(almost.isUnlocked(world, index)).toBe(false));
    }
    expect(almost.resume()).toEqual({ world: chapter2.finale, index: 0 });

    const done = new Progress(CHAPTERS, memoryStorage({ [V2_KEY]: v2Save(v2Scores(32), 'ch2-finale') }));
    expect(done.chapterUnlocked(chapter3)).toBe(true);
    expect(done.isUnlocked(chapter3.worlds[0], 0)).toBe(true);
    // Only the first hole: Chapter 3 unlocks in order, like the others.
    expect(done.isUnlocked(chapter3.worlds[0], 1)).toBe(false);
    expect(done.isUnlocked(chapter3.finale, 0)).toBe(false);
    // PLAY takes the returning player straight to the new chapter.
    expect(done.resume()).toEqual({ world: chapter3.worlds[0], index: 0 });
  });

  it('writes the new save under a new key and leaves the version 2 save untouched', () => {
    // If this build is rolled back, the version 2 build finds its own save as it left it.
    const original = v2Save(v2Scores(32), 'ch2-finale');
    const storage = memoryStorage({ [V2_KEY]: original, [V1_KEY]: v1Save(scores(18)) });
    const progress = new Progress(CHAPTERS, storage);
    progress.complete('grow-1', { holed: true, strokes: 1, stars: 3, challengeMet: true, ticks: 10 });
    expect(storage.data[V2_KEY]).toBe(original);
    const written = JSON.parse(storage.data[KEY]);
    expect(written.version).toBe(3);
    expect(Object.keys(written.holes)).toHaveLength(33);
  });

  it('takes the version 2 save over the version 1 save when both are there', () => {
    const storage = memoryStorage({ [V2_KEY]: v2Save(v2Scores(25)), [V1_KEY]: v1Save(scores(4)) });
    expect(new Progress(CHAPTERS, storage).completedHoles).toBe(25);
  });

  it('still carries a version 1 save all the way over', () => {
    const progress = new Progress(CHAPTERS, memoryStorage({ [V1_KEY]: v1Save(scores(18), 'gravity-3') }));
    expect(progress.completedHoles).toBe(18);
    expect(progress.migratedFrom).toBe(1);
    expect(progress.chapterUnlocked(chapter3)).toBe(false);
  });

  it('reports the return once, as coming from version 2', () => {
    // This save was itself carried over from version 1, and that was never reported.
    const storage = memoryStorage({ [V2_KEY]: v2Save(v2Scores(20), null, { migratedFrom: 1 }) });
    const first = new Progress(CHAPTERS, storage);
    expect(first.migratedFrom).toBe(2);
    first.migrationReported();
    expect(new Progress(CHAPTERS, storage).migratedFrom).toBeNull();
  });
});
