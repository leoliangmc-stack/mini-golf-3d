import { registerPart } from './field';
import { Bell, Coin, Dragon, Fire } from './hoard';
import { Crystal, Emitter, Receiver } from './light';
import { Slider } from './slider';
import { Gate, Plate, Stone } from './tomb';

/** Registers every kind of part a hole's data may name. A new kind is one more line here. */
export function registerBuiltinParts(): void {
  registerPart('plate', (def, field, id) => new Plate(def, field, id));
  registerPart('gate', (def, field, id) => new Gate(def, field, id));
  registerPart('stone', (def, field, id) => new Stone(def, field, id));
  registerPart('crystal', (def, field, id) => new Crystal(def, field, id));
  registerPart('emitter', (def, field, id) => new Emitter(def, field, id));
  registerPart('receiver', (def, field, id) => new Receiver(def, field, id));
  registerPart('slider', (def, field, id) => new Slider(def, field, id));
  registerPart('coin', (def, field, id) => new Coin(def, field, id));
  registerPart('bell', (def, field, id) => new Bell(def, field, id));
  registerPart('dragon', (def, field, id) => new Dragon(def, field, id));
  registerPart('fire', (def, field, id) => new Fire(def, field, id));
}
