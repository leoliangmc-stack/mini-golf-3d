import type { ChapterDef } from '../level/schema';
import { COUNTDOWN_RUN, GAUNTLET } from './finales';
import { BOMB_WORLD } from './worlds/bomb';
import { CITY_WORLD } from './worlds/city';
import { DESERT_WORLD } from './worlds/desert';
import { FOREST_WORLD } from './worlds/forest';
import { GRAVITY_WORLD } from './worlds/gravity';
import { ICE_WORLD } from './worlds/ice';
import { MAGNET_WORLD } from './worlds/magnet';
import { MOVING_WORLD } from './worlds/moving';
import { PIRATE_WORLD } from './worlds/pirate';
import { SKY_WORLD } from './worlds/sky';

/**
 * The game, in play order: each chapter's worlds, then its finale. Adding a chapter is
 * one more entry here; menus, unlocks and saves follow from this list.
 */
export const CHAPTERS: readonly ChapterDef[] = [
  {
    id: 'ch1',
    name: { en: 'Chapter 1', zh: '第一章' },
    worlds: [ICE_WORLD, DESERT_WORLD, SKY_WORLD, PIRATE_WORLD, MAGNET_WORLD, GRAVITY_WORLD],
    finale: GAUNTLET,
  },
  {
    id: 'ch2',
    name: { en: 'Chapter 2', zh: '第二章' },
    worlds: [FOREST_WORLD, CITY_WORLD, MOVING_WORLD, BOMB_WORLD],
    finale: COUNTDOWN_RUN,
  },
];
