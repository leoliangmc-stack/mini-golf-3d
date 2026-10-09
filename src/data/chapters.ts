import type { ChapterDef } from '../level/schema';
import {
  CITY_DAY_OUT,
  COUNTDOWN_RUN,
  GAUNTLET,
  GRAND_FINALE,
  PRODUCTION_LINE,
  SPRING_TO_CANYON,
  STRANGE_GATE,
  TEMPLE_GATE,
} from './finales';
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
import { ECHO_WORLD } from './worlds/echo';
import { FAIR_WORLD } from './worlds/fair';
import { FOREST_WORLD } from './worlds/forest';
import { FREEZE_WORLD } from './worlds/freeze';
import { GRAVITY_WORLD } from './worlds/gravity';
import { GROW_WORLD } from './worlds/grow';
import { HALL_WORLD } from './worlds/hall';
import { HOARD_WORLD } from './worlds/hoard';
import { ICE_WORLD } from './worlds/ice';
import { JUNGLE_WORLD } from './worlds/jungle';
import { MAGNET_WORLD } from './worlds/magnet';
import { MAZE_WORLD } from './worlds/maze';
import { MIRROR_WORLD } from './worlds/mirror';
import { MOVING_WORLD } from './worlds/moving';
import { MUSIC_WORLD } from './worlds/music';
import { PHANTOM_WORLD } from './worlds/phantom';
import { PIRATE_WORLD } from './worlds/pirate';
import { POLAR_WORLD } from './worlds/polar';
import { RAIL_WORLD } from './worlds/rail';
import { REEF_WORLD } from './worlds/reef';
import { SKY_WORLD } from './worlds/sky';
import { SUBWAY_WORLD } from './worlds/subway';
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
  // City & Carnival (SPEC v7). It follows Chapter 6 on the main line.
  {
    id: 'ch7',
    name: { en: 'Chapter 7', zh: '第七章' },
    worlds: [SUBWAY_WORLD, RAIL_WORLD, FAIR_WORLD, MAZE_WORLD],
    finale: CITY_DAY_OUT,
    after: 'ch6',
  },
  // Strange Dimensions (SPEC v8). It follows Chapter 7 on the main line.
  {
    id: 'ch8',
    name: { en: 'Chapter 8', zh: '第八章' },
    worlds: [PHANTOM_WORLD, HALL_WORLD, MIRROR_WORLD, ECHO_WORLD],
    finale: STRANGE_GATE,
    after: 'ch7',
  },
];
