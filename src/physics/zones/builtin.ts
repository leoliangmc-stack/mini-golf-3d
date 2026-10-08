import { gravity } from './gravity';
import { registerZone } from './index';
import { launcher } from './launcher';
import { magnet } from './magnet';
import { outOfBounds } from './outOfBounds';
import { resizer, splitter } from './pads';
import { timeBonus } from './timeBonus';
import { tunnel } from './tunnel';
import { bubbleLift, current } from './water';
import { wind } from './wind';

export function registerBuiltinZones(): void {
  registerZone('outOfBounds', outOfBounds);
  registerZone('launcher', launcher);
  registerZone('magnet', magnet);
  registerZone('gravity', gravity);
  registerZone('tunnelPair', tunnel);
  registerZone('timeBonus', timeBonus);
  registerZone('grow', resizer(1));
  registerZone('shrink', resizer(-1));
  registerZone('split', splitter);
  registerZone('current', current);
  registerZone('bubbleLift', bubbleLift);
  registerZone('wind', wind);
}
