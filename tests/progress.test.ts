import { describe, expect, it } from 'vitest';
import { Progress, type StorageLike } from '../src/app/progress';
import { WORLDS } from '../src/data/worlds';
import type { Outcome } from '../src/game/session';

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

const [ice, desert] = WORLDS;

describe('progress (SPEC 2.7)', () => {
  it('unlocks holes one at a time, across worlds', () => {
    const progress = new Progress(WORLDS, memoryStorage());
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
    expect(progress.next(WORLDS.at(-1)!, 2)).toBeNull();
  });

  it('keeps the best stars and the fewest strokes separately', () => {
    const progress = new Progress(WORLDS, memoryStorage());
    progress.complete('ice-1', outcome(3, 2));
    progress.complete('ice-1', outcome(1, 4));
    expect(progress.record('ice-1')).toEqual({ stars: 3, strokes: 2 });
    progress.complete('ice-1', outcome(2, 1));
    expect(progress.record('ice-1')).toEqual({ stars: 3, strokes: 1 });
  });

  it('survives a reload through storage', () => {
    const storage = memoryStorage();
    const first = new Progress(WORLDS, storage);
    first.complete('ice-1', outcome(2, 2));
    first.setSetting('music', false);
    first.setLast('ice-2');
    const second = new Progress(WORLDS, storage);
    expect(second.record('ice-1')).toEqual({ stars: 2, strokes: 2 });
    expect(second.settings.music).toBe(false);
    expect(second.settings.sfx).toBe(true);
    expect(second.resume()).toEqual({ world: ice, index: 1 });
  });

  it('resumes at the first unfinished hole when there is nothing to go back to', () => {
    const progress = new Progress(WORLDS, memoryStorage());
    expect(progress.resume()).toEqual({ world: ice, index: 0 });
    progress.complete('ice-1', outcome(1, 4));
    expect(progress.resume()).toEqual({ world: ice, index: 1 });
  });

  it('plays on without saving when storage is missing, broken or full', () => {
    const none = new Progress(WORLDS, null);
    none.complete('ice-1', outcome(2, 2));
    expect(none.isUnlocked(ice, 1)).toBe(true);

    const garbage = new Progress(WORLDS, memoryStorage({ 'minigolf.save.v1': '{not json' }));
    expect(garbage.isUnlocked(ice, 1)).toBe(false);

    const tampered = new Progress(
      WORLDS,
      memoryStorage({
        'minigolf.save.v1': JSON.stringify({ version: 1, holes: { 'ice-1': { stars: 9, strokes: 1 }, nope: { stars: 3, strokes: 1 } } }),
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
    const stuck = new Progress(WORLDS, full);
    expect(() => stuck.complete('ice-1', outcome(2, 2))).not.toThrow();
    expect(stuck.record('ice-1')).toEqual({ stars: 2, strokes: 2 });
  });

  it('has a development switch that opens everything', () => {
    const progress = new Progress(WORLDS, null);
    progress.unlockAll = true;
    expect(progress.isUnlocked(WORLDS.at(-1)!, 2)).toBe(true);
  });
});
