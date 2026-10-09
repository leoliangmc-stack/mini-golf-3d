import { arm } from './arm';
import { coasterZone } from './coaster';
import { drum } from './drum';
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
import { wrap } from './wrap';

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
  registerZone('arm', arm);
  registerZone('drum', drum);
  registerZone('coaster', coasterZone);
  registerZone('wrap', wrap);
}
