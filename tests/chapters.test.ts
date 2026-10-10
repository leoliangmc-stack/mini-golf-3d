import { describe, expect, it } from 'vitest';
import indexHtml from '../index.html?raw';
import { CHAPTERS } from '../src/data/chapters';
import { allHoles, chapterOf, holeNumber, isFinale, stagesOf } from '../src/level/chapters';
import { TEST_WORLD } from '../src/data/worlds/test';

const [chapter1, chapter2, chapter3, chapter4, chapter5, chapter6, chapter7, chapter8, chapter9] = CHAPTERS;

describe('chapters (SPEC v2 2.1)', () => {
  it('puts the finale after the worlds, as one more stage', () => {
    expect(stagesOf(chapter1)).toHaveLength(7);
    expect(stagesOf(chapter1).at(-1)).toBe(chapter1.finale);
    expect(stagesOf(chapter2).map((stage) => stage.id)).toEqual(['forest', 'city', 'moving', 'bomb', 'ch2-finale']);
    expect(stagesOf(chapter3).map((stage) => stage.id)).toEqual(['grow', 'freeze', 'clone', 'bowl', 'ch3-finale']);
    expect(stagesOf(chapter4).map((stage) => stage.id)).toEqual(['tomb', 'cavern', 'jungle', 'hoard', 'ch4-finale']);
    expect(stagesOf(chapter5).map((stage) => stage.id)).toEqual(['reef', 'polar', 'dam', 'canyon', 'ch5-finale']);
    expect(stagesOf(chapter6).map((stage) => stage.id)).toEqual(['toy', 'assembly', 'music', 'clock', 'ch6-finale']);
    expect(stagesOf(chapter7).map((stage) => stage.id)).toEqual(['subway', 'rail', 'fair', 'maze', 'ch7-finale']);
    expect(stagesOf(chapter8).map((stage) => stage.id)).toEqual(['phantom', 'hall', 'mirror', 'echo', 'ch8-finale']);
    expect(stagesOf(chapter9).map((stage) => stage.id)).toEqual(['haunted', 'den', 'dungeon', 'lair', 'ch9-finale']);
  });

  it('numbers a finale as the last hole of its chapter: 19, then 13 each', () => {
    expect(holeNumber(chapter1, chapter1.worlds[0], 0)).toBe(1);
    expect(holeNumber(chapter1, chapter1.worlds[5], 2)).toBe(18);
    expect(holeNumber(chapter1, chapter1.finale, 0)).toBe(19);
    expect(holeNumber(chapter2, chapter2.worlds[0], 0)).toBe(1);
    expect(holeNumber(chapter2, chapter2.finale, 0)).toBe(13);
    expect(holeNumber(chapter3, chapter3.finale, 0)).toBe(13);
    expect(holeNumber(chapter4, chapter4.finale, 0)).toBe(13);
    expect(holeNumber(chapter5, chapter5.finale, 0)).toBe(13);
    expect(holeNumber(chapter6, chapter6.worlds[3], 2)).toBe(12);
    expect(holeNumber(chapter6, chapter6.finale, 0)).toBe(13);
    expect(holeNumber(chapter7, chapter7.worlds[0], 0)).toBe(1);
    expect(holeNumber(chapter7, chapter7.finale, 0)).toBe(13);
    expect(holeNumber(chapter8, chapter8.worlds[2], 1)).toBe(8);
    expect(holeNumber(chapter8, chapter8.finale, 0)).toBe(13);
    expect(holeNumber(chapter9, chapter9.worlds[3], 2)).toBe(12);
    expect(holeNumber(chapter9, chapter9.finale, 0)).toBe(13);
  });

  it('finds the chapter a world or a finale belongs to', () => {
    expect(chapterOf(CHAPTERS, chapter1.worlds[3])).toBe(chapter1);
    expect(chapterOf(CHAPTERS, chapter2.finale)).toBe(chapter2);
    expect(chapterOf(CHAPTERS, TEST_WORLD)).toBeNull();
    expect(isFinale(CHAPTERS, chapter1.finale)).toBe(true);
    expect(isFinale(CHAPTERS, chapter1.worlds[0])).toBe(false);
    expect(chapterOf(CHAPTERS, chapter3.worlds[0])).toBe(chapter3);
    expect(chapterOf(CHAPTERS, chapter4.finale)).toBe(chapter4);
    expect(chapterOf(CHAPTERS, chapter5.worlds[2])).toBe(chapter5);
    expect(chapterOf(CHAPTERS, chapter6.finale)).toBe(chapter6);
    expect(chapterOf(CHAPTERS, chapter7.worlds[3])).toBe(chapter7);
    expect(chapterOf(CHAPTERS, chapter8.finale)).toBe(chapter8);
    expect(chapterOf(CHAPTERS, chapter9.worlds[1])).toBe(chapter9);
    expect(allHoles(CHAPTERS)).toHaveLength(123);
  });

  it('is counted rightly in the link preview, which is static text in index.html', () => {
    const worlds = CHAPTERS.reduce((sum, chapter) => sum + chapter.worlds.length, 0);
    expect(indexHtml).toContain(`${CHAPTERS.length} chapters, ${worlds} worlds, ${allHoles(CHAPTERS).length} holes.`);
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
