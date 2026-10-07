import { gravity } from './gravity';
import { registerZone } from './index';
import { launcher } from './launcher';
import { magnet } from './magnet';
import { outOfBounds } from './outOfBounds';
import { timeBonus } from './timeBonus';
import { tunnel } from './tunnel';

export function registerBuiltinZones(): void {
  registerZone('outOfBounds', outOfBounds);
  registerZone('launcher', launcher);
  registerZone('magnet', magnet);
  registerZone('gravity', gravity);
  registerZone('tunnelPair', tunnel);
  registerZone('timeBonus', timeBonus);
}
