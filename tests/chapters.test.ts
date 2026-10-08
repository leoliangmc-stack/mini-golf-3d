import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/chapters';
import { allHoles, chapterOf, holeNumber, isFinale, stagesOf } from '../src/level/chapters';
import { TEST_WORLD } from '../src/data/worlds/test';

const [chapter1, chapter2, chapter3, chapter4] = CHAPTERS;

describe('chapters (SPEC v2 2.1)', () => {
  it('puts the finale after the worlds, as one more stage', () => {
    expect(stagesOf(chapter1)).toHaveLength(7);
    expect(stagesOf(chapter1).at(-1)).toBe(chapter1.finale);
    expect(stagesOf(chapter2).map((stage) => stage.id)).toEqual(['forest', 'city', 'moving', 'bomb', 'ch2-finale']);
    expect(stagesOf(chapter3).map((stage) => stage.id)).toEqual(['grow', 'freeze', 'clone', 'bowl', 'ch3-finale']);
    expect(stagesOf(chapter4).map((stage) => stage.id)).toEqual(['tomb', 'cavern', 'jungle', 'hoard', 'ch4-finale']);
  });

  it('numbers a finale as the last hole of its chapter: 19, then 13 each', () => {
    expect(holeNumber(chapter1, chapter1.worlds[0], 0)).toBe(1);
    expect(holeNumber(chapter1, chapter1.worlds[5], 2)).toBe(18);
    expect(holeNumber(chapter1, chapter1.finale, 0)).toBe(19);
    expect(holeNumber(chapter2, chapter2.worlds[0], 0)).toBe(1);
    expect(holeNumber(chapter2, chapter2.finale, 0)).toBe(13);
    expect(holeNumber(chapter3, chapter3.finale, 0)).toBe(13);
    expect(holeNumber(chapter4, chapter4.finale, 0)).toBe(13);
  });

  it('finds the chapter a world or a finale belongs to', () => {
    expect(chapterOf(CHAPTERS, chapter1.worlds[3])).toBe(chapter1);
    expect(chapterOf(CHAPTERS, chapter2.finale)).toBe(chapter2);
    expect(chapterOf(CHAPTERS, TEST_WORLD)).toBeNull();
    expect(isFinale(CHAPTERS, chapter1.finale)).toBe(true);
    expect(isFinale(CHAPTERS, chapter1.worlds[0])).toBe(false);
    expect(chapterOf(CHAPTERS, chapter3.worlds[0])).toBe(chapter3);
    expect(chapterOf(CHAPTERS, chapter4.finale)).toBe(chapter4);
    expect(allHoles(CHAPTERS)).toHaveLength(58);
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
