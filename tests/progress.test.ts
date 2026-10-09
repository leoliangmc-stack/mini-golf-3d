import { describe, expect, it } from 'vitest';
import { Progress, type StorageLike } from '../src/app/progress';
import { CHAPTERS } from '../src/data/chapters';
import type { Outcome } from '../src/game/session';
import { allHoles } from '../src/level/chapters';

const outcome = (stars: 1 | 2 | 3, strokes: number): Outcome => ({
  holed: true,
  strokes,
  stars,
  challengeMet: stars === 3,
  ticks: 100,
});

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

const [chapter1, chapter2, chapter3, chapter4, chapter5, chapter6] = CHAPTERS;
const [ice, desert] = chapter1.worlds;
const KEY = 'minigolf.save.v6';

/** A progress with every hole of the first `count` in play order finished. */
function played(count: number, storage: StorageLike | null = memoryStorage()): Progress {
  const progress = new Progress(CHAPTERS, storage);
  for (const hole of allHoles(CHAPTERS).slice(0, count)) progress.complete(hole.id, outcome(2, hole.par));
  return progress;
}

describe('progress (SPEC 2.7)', () => {
  it('unlocks holes one at a time, across worlds', () => {
    const progress = new Progress(CHAPTERS, memoryStorage());
    expect(progress.isUnlocked(ice, 0)).toBe(true);
    expect(progress.isUnlocked(ice, 1)).toBe(false);
    expect(progress.isUnlocked(desert, 0)).toBe(false);
    progress.complete('ice-1', outcome(1, 4));
    expect(progress.isUnlocked(ice, 1)).toBe(true);
    expect(progress.isUnlocked(ice, 2)).toBe(false);
    progress.complete('ice-2', outcome(2, 2));
    progress.complete('ice-3', outcome(3, 2));
    expect(progress.isUnlocked(desert, 0)).toBe(true);
    expect(progress.worldStars(ice)).toBe(6);
    expect(progress.next(ice, 2)).toEqual({ world: desert, index: 0 });
  });

  it('runs through a chapter into its finale, and from the finale into the next chapter (v2 2.8)', () => {
    const gravity = chapter1.worlds.at(-1)!;
    expect(new Progress(CHAPTERS, null).next(gravity, 2)).toEqual({ world: chapter1.finale, index: 0 });
    expect(new Progress(CHAPTERS, null).next(chapter1.finale, 0)).toEqual({ world: chapter2.worlds[0], index: 0 });
    expect(new Progress(CHAPTERS, null).next(chapter2.finale, 0)).toEqual({ world: chapter3.worlds[0], index: 0 });
    expect(new Progress(CHAPTERS, null).next(chapter3.finale, 0)).toEqual({ world: chapter4.worlds[0], index: 0 });
    expect(new Progress(CHAPTERS, null).next(chapter4.finale, 0)).toEqual({ world: chapter5.worlds[0], index: 0 });
    expect(new Progress(CHAPTERS, null).next(chapter5.finale, 0)).toEqual({ world: chapter6.worlds[0], index: 0 });
    expect(new Progress(CHAPTERS, null).next(chapter6.finale, 0)).toBeNull();

    // All 18 holes of Chapter 1 open its finale, but not Chapter 2.
    const progress = played(18);
    expect(progress.isUnlocked(chapter1.finale, 0)).toBe(true);
    expect(progress.chapterUnlocked(chapter2)).toBe(false);
    expect(progress.isUnlocked(chapter2.worlds[0], 0)).toBe(false);
    expect(progress.isUnlocked(chapter2.finale, 0)).toBe(false);
    // Only finishing the finale does.
    progress.complete(chapter1.finale.holes[0].id, outcome(1, 10));
    expect(progress.chapterUnlocked(chapter2)).toBe(true);
    expect(progress.isUnlocked(chapter2.worlds[0], 0)).toBe(true);
    expect(progress.isUnlocked(chapter2.worlds[0], 1)).toBe(false);
    expect(progress.worldStars(chapter1.finale)).toBe(1);
  });

  it('keeps the best stars and the fewest strokes separately', () => {
    const progress = new Progress(CHAPTERS, memoryStorage());
    progress.complete('ice-1', outcome(3, 2));
    progress.complete('ice-1', outcome(1, 4));
    expect(progress.record('ice-1')).toEqual({ stars: 3, strokes: 2 });
    progress.complete('ice-1', outcome(2, 1));
    expect(progress.record('ice-1')).toEqual({ stars: 3, strokes: 1 });
  });

  it('survives a reload through storage', () => {
    const storage = memoryStorage();
    const first = new Progress(CHAPTERS, storage);
    first.complete('ice-1', outcome(2, 2));
    first.setSetting('music', false);
    first.setLast('ice-2');
    const second = new Progress(CHAPTERS, storage);
    expect(second.record('ice-1')).toEqual({ stars: 2, strokes: 2 });
    expect(second.settings.music).toBe(false);
    expect(second.settings.sfx).toBe(true);
    expect(second.resume()).toEqual({ world: ice, index: 1 });
  });

  it('resumes at the first unfinished hole when there is nothing to go back to', () => {
    const progress = new Progress(CHAPTERS, memoryStorage());
    expect(progress.resume()).toEqual({ world: ice, index: 0 });
    progress.complete('ice-1', outcome(1, 4));
    expect(progress.resume()).toEqual({ world: ice, index: 1 });
  });

  it('sends a returning player to what is new rather than to a hole already finished', () => {
    // Finished all 18 holes; the last one played was the last one of the old game.
    const progress = played(18);
    progress.setLast('gravity-3');
    expect(progress.resume()).toEqual({ world: chapter1.finale, index: 0 });
    // Went back to an old hole for a better score and left: PLAY still leads onward.
    progress.setLast('ice-2');
    expect(progress.resume()).toEqual({ world: chapter1.finale, index: 0 });
    // In the middle of a hole that is not finished yet: PLAY goes back to it.
    progress.complete(chapter1.finale.holes[0].id, outcome(2, 5));
    progress.setLast('forest-1');
    expect(progress.resume()).toEqual({ world: chapter2.worlds[0], index: 0 });
    // Everything finished: back to wherever the player last was.
    const all = played(allHoles(CHAPTERS).length);
    all.setLast('desert-2');
    expect(all.resume()).toEqual({ world: desert, index: 1 });
  });

  it('plays on without saving when storage is missing, broken or full', () => {
    const none = new Progress(CHAPTERS, null);
    none.complete('ice-1', outcome(2, 2));
    expect(none.isUnlocked(ice, 1)).toBe(true);

    const garbage = new Progress(CHAPTERS, memoryStorage({ [KEY]: '{not json' }));
    expect(garbage.isUnlocked(ice, 1)).toBe(false);

    const tampered = new Progress(
      CHAPTERS,
      memoryStorage({
        [KEY]: JSON.stringify({ version: 2, holes: { 'ice-1': { stars: 9, strokes: 1 }, nope: { stars: 3, strokes: 1 } } }),
      }),
    );
    expect(tampered.record('ice-1')).toBeNull();
    expect(tampered.record('nope')).toBeNull();

    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const stuck = new Progress(CHAPTERS, full);
    expect(() => stuck.complete('ice-1', outcome(2, 2))).not.toThrow();
    expect(stuck.record('ice-1')).toEqual({ stars: 2, strokes: 2 });
  });

  it('does not throw away a hole finished in another tab', () => {
    const storage = memoryStorage();
    const first = new Progress(CHAPTERS, storage);
    const second = new Progress(CHAPTERS, storage);
    first.complete('ice-1', outcome(3, 2));
    first.complete('ice-2', outcome(1, 6));
    second.complete('ice-2', outcome(2, 4));
    // The second tab never saw ice-1, and had a worse ice-2 in memory than the first.
    second.setLast('ice-2');
    const written = new Progress(CHAPTERS, storage);
    expect(written.record('ice-1')).toEqual({ stars: 3, strokes: 2 });
    expect(written.record('ice-2')).toEqual({ stars: 2, strokes: 4 });
    expect(written.isUnlocked(ice, 2)).toBe(true);
  });

  it('opens Chapter 3 and Chapter 4 together, each from the Chapter 2 finale (SPEC v4 3.1)', () => {
    const progress = played(31);
    expect(progress.opener(chapter1)).toBeNull();
    expect(progress.opener(chapter3)).toBe(chapter2);
    expect(progress.opener(chapter4)).toBe(chapter2);
    expect(progress.opener(chapter5)).toBe(chapter4);
    expect(progress.opener(chapter6)).toBe(chapter5);
    expect(progress.chapterUnlocked(chapter3)).toBe(false);
    expect(progress.chapterUnlocked(chapter4)).toBe(false);
    progress.complete(chapter2.finale.holes[0].id, outcome(1, 9));
    expect(progress.chapterUnlocked(chapter3)).toBe(true);
    expect(progress.chapterUnlocked(chapter4)).toBe(true);
    // Finishing a hole of one does nothing for the other.
    progress.complete(chapter4.worlds[0].holes[0].id, outcome(2, 2));
    expect(progress.isUnlocked(chapter4.worlds[0], 1)).toBe(true);
    expect(progress.isUnlocked(chapter3.worlds[0], 0)).toBe(true);
    expect(progress.isUnlocked(chapter3.worlds[0], 1)).toBe(false);
    // PLAY goes to the first hole in play order that is open and has no score.
    expect(progress.resume()).toEqual({ world: chapter3.worlds[0], index: 0 });
    progress.setLast(chapter4.worlds[0].holes[1].id);
    expect(progress.resume()).toEqual({ world: chapter4.worlds[0], index: 1 });
  });

  it('knows the game is finished only when every hole has a score', () => {
    const all = played(allHoles(CHAPTERS).length - 1);
    expect(all.allComplete).toBe(false);
    all.complete(chapter6.finale.holes[0].id, outcome(1, 12));
    expect(all.allComplete).toBe(true);
  });

  it('has a development switch that opens everything', () => {
    const progress = new Progress(CHAPTERS, null);
    progress.unlockAll = true;
    expect(progress.isUnlocked(chapter2.finale, 0)).toBe(true);
    expect(progress.chapterUnlocked(chapter2)).toBe(true);
  });
});
