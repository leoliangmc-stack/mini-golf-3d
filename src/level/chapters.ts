import type { ChapterDef, HoleDef, WorldDef } from './schema';

/**
 * A chapter's worlds followed by its finale: everything in it that holds holes, in play
 * order. The finale has the shape of a one-hole world, so the rest of the game can
 * load, score and unlock it exactly as it does a world.
 */
export function stagesOf(chapter: ChapterDef): readonly WorldDef[] {
  return [...chapter.worlds, chapter.finale];
}

export function chapterOf(chapters: readonly ChapterDef[], world: WorldDef): ChapterDef | null {
  return chapters.find((chapter) => chapter.finale === world || chapter.worlds.includes(world)) ?? null;
}

export function isFinale(chapters: readonly ChapterDef[], world: WorldDef): boolean {
  return chapters.some((chapter) => chapter.finale === world);
}

/**
 * The number a hole goes by within its chapter, counting from 1 across its worlds:
 * the finale of an 18-hole chapter is hole 19.
 */
export function holeNumber(chapter: ChapterDef, world: WorldDef, index: number): number {
  let before = 0;
  for (const stage of stagesOf(chapter)) {
    if (stage === world) break;
    before += stage.holes.length;
  }
  return before + index + 1;
}

export function allHoles(chapters: readonly ChapterDef[]): HoleDef[] {
  return chapters.flatMap((chapter) => stagesOf(chapter).flatMap((stage) => stage.holes));
}
