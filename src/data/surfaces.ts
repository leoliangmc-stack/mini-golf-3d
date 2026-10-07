import { registerSurface } from '../physics/surfaces';

/** Surface catalogue. New surfaces are added here; the engine only knows them by id. */
export function registerSurfaces(): void {
  // Ground
  registerSurface('grass', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0x5fb760 });
  registerSurface('snow', { restitution: 0.15, rollingResistance: 0.55, drag: 0.75, color: 0xe6eef5 });
  // Barely slows the ball at all: about three times the roll of snow.
  registerSurface('ice', { restitution: 0.2, rollingResistance: 0.3, drag: 0.12, color: 0x7cc9ec });

  registerSurface('sandstone', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xe3c690 });
  // A trap: the ball dies within a metre or two.
  registerSurface('sand', { restitution: 0.02, rollingResistance: 5, drag: 3, color: 0xcc9a45 });

  registerSurface('steel', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xb4bcc6 });
  registerSurface('neonFloor', { restitution: 0.15, rollingResistance: 0.5, drag: 0.7, color: 0x43346e });
  registerSurface('deck', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xcfa671 });

  // Walls (the rolling terms only matter if gravity ever turns a wall into ground)
  registerSurface('rail', { restitution: 0.7, rollingResistance: 0.5, drag: 0.7, color: 0xe9e2d0 });
  registerSurface('woodRail', { restitution: 0.65, rollingResistance: 0.5, drag: 0.7, color: 0xb98a5e });
  registerSurface('plank', { restitution: 0.6, rollingResistance: 0.5, drag: 0.7, color: 0x8a5a33 });
  // Moving parts
  registerSurface('driftwood', { restitution: 0.5, rollingResistance: 0.5, drag: 0.7, color: 0x6b4a34 });
  registerSurface('iron', { restitution: 0.6, rollingResistance: 0.5, drag: 0.7, color: 0x59626d });
  registerSurface('magnetRed', { restitution: 0.15, rollingResistance: 0.5, drag: 0.7, color: 0xe5484d });
  registerSurface('magnetBlue', { restitution: 0.6, rollingResistance: 0.5, drag: 0.7, color: 0x3b82f6 });
  // Soft, because in a gravity zone the ball falls onto walls and must not bounce for ever.
  registerSurface('padded', { restitution: 0.25, rollingResistance: 0.5, drag: 0.7, color: 0x8a6cff });
  registerSurface('stone', { restitution: 0.8, rollingResistance: 0.5, drag: 0.7, color: 0x9b948a });
  registerSurface('iceWall', { restitution: 0.85, rollingResistance: 0.3, drag: 0.12, color: 0x4fa8d8 });
}
