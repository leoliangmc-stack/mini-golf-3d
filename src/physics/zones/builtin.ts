import { gravity } from './gravity';
import { registerZone } from './index';
import { launcher } from './launcher';
import { magnet } from './magnet';
import { outOfBounds } from './outOfBounds';

export function registerBuiltinZones(): void {
  registerZone('outOfBounds', outOfBounds);
  registerZone('launcher', launcher);
  registerZone('magnet', magnet);
  registerZone('gravity', gravity);
}
