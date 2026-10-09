import { Train, Tunnel } from './city';
import { Crumble, Float, Valve, Water } from './elements';
import { registerPart } from './field';
import { Bell, Coin, Dragon, Fire } from './hoard';
import { Crystal, Emitter, Receiver } from './light';
import { Belt, Dial, Pulse, TimeZone } from './machines';
import { Rotor } from './maze';
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
  registerPart('valve', (def, field, id) => new Valve(def, field, id));
  registerPart('water', (def, field, id) => new Water(def, field, id));
  registerPart('float', (def, field, id) => new Float(def, field, id));
  registerPart('crumble', (def, field, id) => new Crumble(def, field, id));
  registerPart('belt', (def, field, id) => new Belt(def, field, id));
  registerPart('dial', (def, field, id) => new Dial(def, field, id));
  registerPart('timeZone', (def, field, id) => new TimeZone(def, field, id));
  registerPart('pulse', (def, field, id) => new Pulse(def, field, id));
  registerPart('rotor', (def, field, id) => new Rotor(def, field, id));
  registerPart('tunnel', (def, field, id) => new Tunnel(def, field, id));
  registerPart('train', (def, field, id) => new Train(def, field, id));
}
