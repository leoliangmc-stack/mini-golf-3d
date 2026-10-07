import type { WorldDef } from '../../level/schema';
import { DESERT_WORLD } from './desert';
import { GRAVITY_WORLD } from './gravity';
import { ICE_WORLD } from './ice';
import { MAGNET_WORLD } from './magnet';
import { PIRATE_WORLD } from './pirate';
import { SKY_WORLD } from './sky';

/** Worlds in play order. */
export const WORLDS: readonly WorldDef[] = [ICE_WORLD, DESERT_WORLD, SKY_WORLD, PIRATE_WORLD, MAGNET_WORLD, GRAVITY_WORLD];
