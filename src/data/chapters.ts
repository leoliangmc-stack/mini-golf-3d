import type { ChapterDef } from '../level/schema';
import { COUNTDOWN_RUN, GAUNTLET, GRAND_FINALE } from './finales';
import { BOMB_WORLD } from './worlds/bomb';
import { BOWL_WORLD } from './worlds/bowl';
import { CITY_WORLD } from './worlds/city';
import { CLONE_WORLD } from './worlds/clone';
import { DESERT_WORLD } from './worlds/desert';
import { FOREST_WORLD } from './worlds/forest';
import { FREEZE_WORLD } from './worlds/freeze';
import { GRAVITY_WORLD } from './worlds/gravity';
import { GROW_WORLD } from './worlds/grow';
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
  {
    id: 'ch3',
    name: { en: 'Chapter 3', zh: '第三章' },
    worlds: [GROW_WORLD, FREEZE_WORLD, CLONE_WORLD, BOWL_WORLD],
    finale: GRAND_FINALE,
  },
];
