import type { ChapterDef } from '../level/schema';
import { COUNTDOWN_RUN, GAUNTLET, GRAND_FINALE, PRODUCTION_LINE, SPRING_TO_CANYON, TEMPLE_GATE } from './finales';
import { ASSEMBLY_WORLD } from './worlds/assembly';
import { BOMB_WORLD } from './worlds/bomb';
import { BOWL_WORLD } from './worlds/bowl';
import { CANYON_WORLD } from './worlds/canyon';
import { CAVERN_WORLD } from './worlds/cavern';
import { CITY_WORLD } from './worlds/city';
import { CLOCK_WORLD } from './worlds/clock';
import { CLONE_WORLD } from './worlds/clone';
import { DAM_WORLD } from './worlds/dam';
import { DESERT_WORLD } from './worlds/desert';
import { FOREST_WORLD } from './worlds/forest';
import { FREEZE_WORLD } from './worlds/freeze';
import { GRAVITY_WORLD } from './worlds/gravity';
import { GROW_WORLD } from './worlds/grow';
import { HOARD_WORLD } from './worlds/hoard';
import { ICE_WORLD } from './worlds/ice';
import { JUNGLE_WORLD } from './worlds/jungle';
import { MAGNET_WORLD } from './worlds/magnet';
import { MOVING_WORLD } from './worlds/moving';
import { MUSIC_WORLD } from './worlds/music';
import { PIRATE_WORLD } from './worlds/pirate';
import { POLAR_WORLD } from './worlds/polar';
import { REEF_WORLD } from './worlds/reef';
import { SKY_WORLD } from './worlds/sky';
import { TOMB_WORLD } from './worlds/tomb';
import { TOY_WORLD } from './worlds/toy';

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
  // Ancient Ruins (SPEC v4). It opens with Chapter 3, not after it: a player who has
  // finished Chapter 2 can go either way.
  {
    id: 'ch4',
    name: { en: 'Chapter 4', zh: '第四章' },
    worlds: [TOMB_WORLD, CAVERN_WORLD, JUNGLE_WORLD, HOARD_WORLD],
    finale: TEMPLE_GATE,
    after: 'ch2',
  },
  // Wild Elements (SPEC v5). It follows Chapter 4, which with Chapter 2 before it is
  // the main line; Chapter 3 is a branch off it.
  {
    id: 'ch5',
    name: { en: 'Chapter 5', zh: '第五章' },
    worlds: [REEF_WORLD, POLAR_WORLD, DAM_WORLD, CANYON_WORLD],
    finale: SPRING_TO_CANYON,
    after: 'ch4',
  },
  // Machine Works (SPEC v6). It follows Chapter 5 on the main line.
  {
    id: 'ch6',
    name: { en: 'Chapter 6', zh: '第六章' },
    worlds: [TOY_WORLD, ASSEMBLY_WORLD, MUSIC_WORLD, CLOCK_WORLD],
    finale: PRODUCTION_LINE,
    after: 'ch5',
  },
];
