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

  // --- Chapter 4 ---
  // The works: gates, stone blocks, crystal pedestals
  registerSurface('gate', { restitution: 0.55, rollingResistance: 0.5, drag: 0.7, color: 0x8c7b62 });
  // Dull on purpose: a ball that has shoved a block should not fly back across the room.
  registerSurface('block', { restitution: 0.35, rollingResistance: 0.5, drag: 0.7, color: 0xc9b48a });
  registerSurface('crystal', { restitution: 0.5, rollingResistance: 0.5, drag: 0.7, color: 0x8fe3ff });
  // Pharaoh's tomb
  registerSurface('tombFloor', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xdcc391 });
  registerSurface('tombWall', { restitution: 0.65, rollingResistance: 0.5, drag: 0.7, color: 0xa9895a });
  // Crystal cavern
  registerSurface('cavernFloor', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0x56607e });
  registerSurface('cavernWall', { restitution: 0.65, rollingResistance: 0.5, drag: 0.7, color: 0x343b55 });
  // Jungle temple
  registerSurface('jungleFloor', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0x7fae62 });
  registerSurface('templeWall', { restitution: 0.65, rollingResistance: 0.5, drag: 0.7, color: 0x6f7a63 });
  registerSurface('templeStone', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xa7ab95 });
  // Dragon's hoard
  registerSurface('hoardFloor', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0x6b4a4f });
  registerSurface('hoardWall', { restitution: 0.65, rollingResistance: 0.5, drag: 0.7, color: 0x3c2a33 });

  // --- Chapter 5 ---
  // The works: rafts and the cracked slabs of a bridge
  registerSurface('raft', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xb98a5e });
  registerSurface('slab', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xc98a5a });
  // Reef
  registerSurface('seabed', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xd9c9a0 });
  registerSurface('coral', { restitution: 0.6, rollingResistance: 0.5, drag: 0.7, color: 0xe8846e });
  // Polar station: packed snow to roll on, and painted steel
  registerSurface('packedSnow', { restitution: 0.15, rollingResistance: 0.5, drag: 0.7, color: 0xeaf2f8 });
  // A drift of loose snow: a ball that lands in it stops where it lands.
  registerSurface('drift', { restitution: 0.02, rollingResistance: 5, drag: 3, color: 0xcfe0ee });
  registerSurface('stationWall', { restitution: 0.6, rollingResistance: 0.5, drag: 0.7, color: 0xd9534f });
  // Waterworks
  registerSurface('concrete', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xb9bdc2 });
  registerSurface('damWall', { restitution: 0.6, rollingResistance: 0.5, drag: 0.7, color: 0x7d8791 });
  // Canyon
  registerSurface('mesa', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xd98a54 });
  registerSurface('canyonWall', { restitution: 0.6, rollingResistance: 0.5, drag: 0.7, color: 0xa85a36 });

  // --- Chapter 6 ---
  // The rubber of a conveyor belt. It rolls like any floor: what a belt does to a ball is the belt's doing.
  registerSurface('belt', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0x3f4753 });
  // Toy factory
  registerSurface('toyFloor', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0x9ad9c9 });
  // Assembly line
  registerSurface('plant', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xa3aeba });
  // Music factory: a stage, the keys of a piano, and something soft to land on
  registerSurface('stage', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0x5a4691 });
  registerSurface('neonWall', { restitution: 0.65, rollingResistance: 0.5, drag: 0.7, color: 0xff5fb3 });
  // A key is slick, like ice: a ball that rolls onto one is still rolling when it gets to the top.
  registerSurface('ivory', { restitution: 0.2, rollingResistance: 0.3, drag: 0.12, color: 0xf5f1e6 });
  // A ball thrown by a drum comes down fast. This takes most of that off it within a metre or so.
  registerSurface('cushion', { restitution: 0.04, rollingResistance: 2.5, drag: 1.5, color: 0xd4527a });
  // Clockwork
  registerSurface('clockFloor', { restitution: 0.2, rollingResistance: 0.5, drag: 0.7, color: 0xdccba3 });
  registerSurface('cog', { restitution: 0.5, rollingResistance: 0.5, drag: 0.7, color: 0x8f6b34 });
}
