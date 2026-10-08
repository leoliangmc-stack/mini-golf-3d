import { registerBuiltinChallenges } from '../game/challenges';
import { registerBuiltinParts } from '../game/field/builtin';
import { registerBuiltinSkills } from '../game/skills';
import { registerBuiltinZones } from '../physics/zones/builtin';
import { registerSurfaces } from './surfaces';
import { registerThemes } from './themes';

/** Registers every surface, zone type, part kind, challenge type, skill and theme the world data may reference. */
export function registerContent(): void {
  registerSurfaces();
  registerThemes();
  registerBuiltinZones();
  registerBuiltinParts();
  registerBuiltinChallenges();
  registerBuiltinSkills();
}
