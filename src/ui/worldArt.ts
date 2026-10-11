import type { WorldDef } from '../level/schema';

/** Pictures by world id, from a folder of `<id>.webp` files. */
const byWorld = (files: Record<string, string>): ReadonlyMap<string, string> =>
  new Map(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.webp'.length), url]));

const cards = byWorld(import.meta.glob<string>('../assets/worlds/card/*.webp', { eager: true, query: '?url', import: 'default' }));
const pages = byWorld(import.meta.glob<string>('../assets/worlds/full/*.webp', { eager: true, query: '?url', import: 'default' }));

/**
 * A world's picture, drawn ahead of time (`scripts/world-art.py`): a small one for its
 * card and the blurred backdrop, a large one for its own page. Only the addresses are
 * bundled; a picture is fetched when a page first shows it.
 */
export const cardArt = (world: WorldDef): string | undefined => cards.get(world.id);
export const pageArt = (world: WorldDef): string | undefined => pages.get(world.id);
