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

  // --- Chapter 2 ---
  // Forest
  registerSurface('moss', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0x74b25c });
  registerSurface('boardwalk', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xc79c6b });
  registerSurface('log', { restitution: 0.6, rollingResistance: 0.5, drag: 0.7, color: 0x9c7044 });
  registerSurface('bark', { restitution: 0.45, rollingResistance: 0.5, drag: 0.7, color: 0x7a5536 });
  registerSurface('boulder', { restitution: 0.8, rollingResistance: 0.5, drag: 0.7, color: 0x8d939a });
  registerSurface('stem', { restitution: 0.6, rollingResistance: 0.5, drag: 0.7, color: 0xf0e2c8 });
  // Rooftops. The sides of a building take the colour of its roof.
  registerSurface('rooftop', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xb3b8bd });
  registerSurface('tar', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0x767f8c });
  registerSurface('terracotta', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xc98263 });
  registerSurface('parapet', { restitution: 0.6, rollingResistance: 0.5, drag: 0.7, color: 0xe2dccf });
  registerSurface('duct', { restitution: 0.6, rollingResistance: 0.5, drag: 0.7, color: 0x8f9aa3 });
  // Moving hole
  registerSurface('felt', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0x2f8f63 });
  // A slick metal plate: rolls like ice.
  registerSurface('polished', { restitution: 0.2, rollingResistance: 0.3, drag: 0.12, color: 0xdcc68e });
  registerSurface('brass', { restitution: 0.7, rollingResistance: 0.5, drag: 0.7, color: 0xc9a24b });
  // Bomb ball
  registerSurface('basalt', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0x5d5566 });
  registerSurface('hazard', { restitution: 0.65, rollingResistance: 0.5, drag: 0.7, color: 0xe6b422 });
  registerSurface('obsidian', { restitution: 0.7, rollingResistance: 0.5, drag: 0.7, color: 0x2e2a36 });

  // --- Chapter 3 ---
  // Loose objects
  registerSurface('crate', { restitution: 0.3, rollingResistance: 0.5, drag: 0.7, color: 0xd08a3c });
  registerSurface('pin', { restitution: 0.25, rollingResistance: 0.5, drag: 0.7, color: 0xfbfaf5 });
  // Growing ball: a playroom floor and toy blocks
  registerSurface('playmat', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xf3d9a4 });
  registerSurface('toyBlock', { restitution: 0.65, rollingResistance: 0.5, drag: 0.7, color: 0x4f9fe0 });
  registerSurface('toyBlockRed', { restitution: 0.65, rollingResistance: 0.5, drag: 0.7, color: 0xe2574c });
  // Time freeze: an observatory
  registerSurface('marble', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xcfd6e4 });
  registerSurface('bronze', { restitution: 0.65, rollingResistance: 0.5, drag: 0.7, color: 0xb07a3c });
  // Clone ball: a hall of mirrors
  registerSurface('tile', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xa9dcd3 });
  registerSurface('mirror', { restitution: 0.75, rollingResistance: 0.5, drag: 0.7, color: 0x6fc3d6 });
  // Golf bowling: an oiled lane keeps the ball's speed, and gutter walls are dull
  registerSurface('lane', { restitution: 0.15, rollingResistance: 0.35, drag: 0.3, color: 0xe4bb7a });
  registerSurface('gutter', { restitution: 0.45, rollingResistance: 0.5, drag: 0.7, color: 0x48505e });
}
