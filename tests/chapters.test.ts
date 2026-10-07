import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/chapters';
import { allHoles, chapterOf, holeNumber, isFinale, stagesOf } from '../src/level/chapters';
import { TEST_WORLD } from '../src/data/worlds/test';

const [chapter1, chapter2] = CHAPTERS;

describe('chapters (SPEC v2 2.1)', () => {
  it('puts the finale after the worlds, as one more stage', () => {
    expect(stagesOf(chapter1)).toHaveLength(7);
    expect(stagesOf(chapter1).at(-1)).toBe(chapter1.finale);
    expect(stagesOf(chapter2).map((stage) => stage.id)).toEqual(['forest', 'city', 'moving', 'bomb', 'ch2-finale']);
  });

  it('numbers a finale as the last hole of its chapter: 19 and 13', () => {
    expect(holeNumber(chapter1, chapter1.worlds[0], 0)).toBe(1);
    expect(holeNumber(chapter1, chapter1.worlds[5], 2)).toBe(18);
    expect(holeNumber(chapter1, chapter1.finale, 0)).toBe(19);
    expect(holeNumber(chapter2, chapter2.worlds[0], 0)).toBe(1);
    expect(holeNumber(chapter2, chapter2.finale, 0)).toBe(13);
  });

  it('finds the chapter a world or a finale belongs to', () => {
    expect(chapterOf(CHAPTERS, chapter1.worlds[3])).toBe(chapter1);
    expect(chapterOf(CHAPTERS, chapter2.finale)).toBe(chapter2);
    expect(chapterOf(CHAPTERS, TEST_WORLD)).toBeNull();
    expect(isFinale(CHAPTERS, chapter1.finale)).toBe(true);
    expect(isFinale(CHAPTERS, chapter1.worlds[0])).toBe(false);
    expect(allHoles(CHAPTERS)).toHaveLength(32);
  });

  it('gives every stage its text in both languages', () => {
    for (const chapter of CHAPTERS) {
      for (const text of [chapter.name, ...stagesOf(chapter).flatMap((s) => [s.name, s.ruleCard, s.ruleTag])]) {
        expect(text.en.trim()).not.toBe('');
        expect(text.zh.trim()).not.toBe('');
      }
      for (const hole of stagesOf(chapter).flatMap((s) => s.holes)) {
        if (!hole.challenge) continue;
        expect(hole.challenge.text.en.trim()).not.toBe('');
        expect(hole.challenge.text.zh.trim()).not.toBe('');
      }
    }
  });
});
