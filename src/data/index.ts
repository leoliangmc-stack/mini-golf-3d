import { registerBuiltinChallenges } from '../game/challenges';
import { registerBuiltinZones } from '../physics/zones/builtin';
import { registerSurfaces } from './surfaces';
import { registerThemes } from './themes';

/** Registers every surface, zone type, challenge type and theme the world data may reference. */
export function registerContent(): void {
  registerSurfaces();
  registerThemes();
  registerBuiltinZones();
  registerBuiltinChallenges();
}
