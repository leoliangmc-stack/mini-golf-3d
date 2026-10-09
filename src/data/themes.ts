import { registerTheme } from '../render/theme';

export function registerThemes(): void {
  registerTheme('meadow', {
    sky: 0x9ed3ee,
    ambientSky: 0xffffff,
    ambientGround: 0x8fb7c9,
    ambientIntensity: 1.5,
    sun: 0xfff4e0,
    sunIntensity: 2.2,
  });
  registerTheme('desert', {
    sky: 0xf2dcae,
    ambientSky: 0xfff6e0,
    ambientGround: 0xc9a56a,
    ambientIntensity: 1.5,
    sun: 0xffe9c2,
    sunIntensity: 2.3,
    sea: { color: 0xd9b46c, y: -0.9 },
  });
  registerTheme('sky', {
    sky: 0x8ecbff,
    ambientSky: 0xffffff,
    ambientGround: 0x9fd0f5,
    ambientIntensity: 1.6,
    sun: 0xfff6e6,
    sunIntensity: 2.1,
  });
  registerTheme('ice', {
    sky: 0xbfe0f3,
    ambientSky: 0xf2f9ff,
    ambientGround: 0x9dbfd8,
    ambientIntensity: 1.7,
    sun: 0xfff1dc,
    sunIntensity: 1.9,
    sea: { color: 0x3f7fa6, y: -0.9, opacity: 0.9 },
  });
  registerTheme('magnet', {
    sky: 0xc9d1d9,
    ambientSky: 0xffffff,
    ambientGround: 0x8d99a6,
    ambientIntensity: 1.5,
    sun: 0xffffff,
    sunIntensity: 2,
    sea: { color: 0x6f7a86, y: -0.9 },
  });
  registerTheme('gravity', {
    sky: 0x1c1436,
    ambientSky: 0xcbb8ff,
    ambientGround: 0x3a2a6b,
    ambientIntensity: 1.7,
    sun: 0xe6dcff,
    sunIntensity: 1.6,
  });
  // The Chapter 1 finale: late sun over a floor of cloud.
  registerTheme('summit', {
    sky: 0xf9cfa3,
    ambientSky: 0xfff2e0,
    ambientGround: 0xc9a27a,
    ambientIntensity: 1.5,
    sun: 0xffe0b0,
    sunIntensity: 2.3,
    sea: { color: 0xfff4e6, y: -1.4, opacity: 0.85 },
  });
  // The "sea" of the forest is its floor.
  registerTheme('forest', {
    sky: 0xcfe8d6,
    ambientSky: 0xf4fff0,
    ambientGround: 0x6f9a6a,
    ambientIntensity: 1.5,
    sun: 0xfff0c8,
    sunIntensity: 2.1,
    sea: { color: 0x4f8a4a, y: -0.9 },
  });
  // Dusk over the city. The "sea" is the street, the one place a ball must not land.
  registerTheme('rooftop', {
    sky: 0xf4bf9a,
    ambientSky: 0xffe9d6,
    ambientGround: 0x6a6f86,
    ambientIntensity: 1.5,
    sun: 0xffd6a8,
    sunIntensity: 2.2,
    sea: { color: 0x3d434c, y: 0 },
  });
  // A table of brass and felt under warm lamps.
  registerTheme('clockwork', {
    sky: 0x2b2420,
    ambientSky: 0xffe9c4,
    ambientGround: 0x6b5a3c,
    ambientIntensity: 1.6,
    sun: 0xfff1d6,
    sunIntensity: 2,
    sea: { color: 0x4a3b2c, y: -0.9 },
  });
  // Dark rock over lava.
  registerTheme('bomb', {
    sky: 0x241a26,
    ambientSky: 0xffd0b0,
    ambientGround: 0x8a3218,
    ambientIntensity: 1.6,
    sun: 0xffdcc0,
    sunIntensity: 1.9,
    sea: { color: 0xc8451c, y: -0.9 },
  });
  // The Chapter 2 finale: the city at night.
  registerTheme('midnight', {
    sky: 0x161c38,
    ambientSky: 0xbcc8ff,
    ambientGround: 0x30365a,
    ambientIntensity: 1.8,
    sun: 0xdfe6ff,
    sunIntensity: 1.6,
    sea: { color: 0x232733, y: 0 },
  });
  // --- Chapter 3 ---
  // Growing ball: a sunny playroom.
  registerTheme('playroom', {
    sky: 0xffe3c2,
    ambientSky: 0xfffaf0,
    ambientGround: 0xe0b98a,
    ambientIntensity: 1.6,
    sun: 0xfff3dd,
    sunIntensity: 2.1,
  });
  // Time freeze: an observatory under a clear night sky.
  registerTheme('observatory', {
    sky: 0x14213d,
    ambientSky: 0xbfd0ff,
    ambientGround: 0x2b3a67,
    ambientIntensity: 1.8,
    sun: 0xeaf0ff,
    sunIntensity: 1.7,
  });
  // Clone ball: a hall of mirrors, cool and bright.
  registerTheme('mirrors', {
    sky: 0xc5efe9,
    ambientSky: 0xffffff,
    ambientGround: 0x86c9c4,
    ambientIntensity: 1.6,
    sun: 0xffffff,
    sunIntensity: 2,
  });
  // Golf bowling: a bowling alley at night, lit from above.
  registerTheme('alley', {
    sky: 0x23202e,
    ambientSky: 0xfff0d6,
    ambientGround: 0x4a3f5c,
    ambientIntensity: 1.5,
    sun: 0xfff1d0,
    sunIntensity: 2.2,
  });
  // The Chapter 3 finale: fairground lights at dusk.
  registerTheme('carnival', {
    sky: 0x4b2a6b,
    ambientSky: 0xffd9f2,
    ambientGround: 0x5b3a86,
    ambientIntensity: 1.7,
    sun: 0xffe2b8,
    sunIntensity: 2,
  });
  // --- Chapter 4: ancient ruins ---
  // Pharaoh's tomb: torchlight on sandstone, under a dusk sky.
  registerTheme('tomb', {
    sky: 0x2b2238,
    ambientSky: 0xffe2b0,
    ambientGround: 0x7a5a3a,
    ambientIntensity: 1.6,
    sun: 0xffd9a0,
    sunIntensity: 2.1,
    sea: { color: 0x8a6a45, y: -0.9 },
  });
  // Crystal cavern: dark, so the beams and the crystals carry the picture.
  registerTheme('cavern', {
    sky: 0x0e1326,
    ambientSky: 0xa8c4ff,
    ambientGround: 0x27304f,
    ambientIntensity: 1.7,
    sun: 0xd6e4ff,
    sunIntensity: 1.5,
    sea: { color: 0x1a2038, y: -0.9 },
  });
  // Jungle temple: green daylight through leaves.
  registerTheme('jungle', {
    sky: 0x9fd6b0,
    ambientSky: 0xf2ffe6,
    ambientGround: 0x5f8f5a,
    ambientIntensity: 1.6,
    sun: 0xfff6cf,
    sunIntensity: 2.1,
    sea: { color: 0x4f8a55, y: -0.9 },
  });
  // Dragon's hoard: a red cave lit by the gold in it.
  registerTheme('hoard', {
    sky: 0x1f0f14,
    ambientSky: 0xffc98a,
    ambientGround: 0x5a2a2a,
    ambientIntensity: 1.7,
    sun: 0xffd08a,
    sunIntensity: 1.9,
    sea: { color: 0x2c171c, y: -0.9 },
  });
  // The Chapter 4 finale: the temple at sunset.
  registerTheme('temple', {
    sky: 0xf0a868,
    ambientSky: 0xffe9cf,
    ambientGround: 0x8a6a4f,
    ambientIntensity: 1.6,
    sun: 0xffd6a0,
    sunIntensity: 2.2,
    sea: { color: 0xb98a55, y: -0.9 },
  });
  // --- Chapter 5: wild elements ---
  // Reef: under water, the light coming down through it.
  registerTheme('reef', {
    sky: 0x1f7f9c,
    ambientSky: 0xbff3ff,
    ambientGround: 0x2a7f8f,
    ambientIntensity: 1.7,
    sun: 0xeaffff,
    sunIntensity: 1.7,
    sea: { color: 0x15607a, y: -0.9 },
  });
  // Polar station: a white day over open water and floes.
  registerTheme('polar', {
    sky: 0xcfe6f5,
    ambientSky: 0xffffff,
    ambientGround: 0xa9c8de,
    ambientIntensity: 1.7,
    sun: 0xfff6e8,
    sunIntensity: 1.9,
    // Dark water under the floes: white ground on a white sea would have no edges.
    sea: { color: 0x3f7fa6, y: -1.4, opacity: 0.95 },
  });
  // Waterworks: concrete under an overcast sky, the river far below.
  registerTheme('dam', {
    sky: 0xaec3cf,
    ambientSky: 0xffffff,
    ambientGround: 0x7f97a6,
    ambientIntensity: 1.6,
    sun: 0xfdf6ea,
    sunIntensity: 2,
    sea: { color: 0x2f5f7a, y: -3.4 },
  });
  // Canyon: red rock, and a long way down.
  registerTheme('canyon', {
    sky: 0xf2c9a0,
    ambientSky: 0xfff0dc,
    ambientGround: 0xb8703f,
    ambientIntensity: 1.6,
    sun: 0xffe2bd,
    sunIntensity: 2.2,
    sea: { color: 0x8a4a2b, y: -3.6 },
  });
  // The Chapter 5 finale: a mountain morning, from the spring down.
  registerTheme('spring', {
    sky: 0xa6d8ef,
    ambientSky: 0xffffff,
    ambientGround: 0x7fae9b,
    ambientIntensity: 1.6,
    sun: 0xfff3da,
    sunIntensity: 2.1,
    sea: { color: 0x4f7f7a, y: -3.6 },
  });
  // Toy factory: a bright shop floor, painted like a nursery.
  registerTheme('toy', {
    sky: 0xffd9a8,
    ambientSky: 0xffffff,
    ambientGround: 0xf0a878,
    ambientIntensity: 1.6,
    sun: 0xfff6e0,
    sunIntensity: 2.1,
    sea: { color: 0xe8956a, y: -3.6 },
  });
  // Assembly line: a hall of steel under cold lamps.
  registerTheme('assembly', {
    sky: 0x8fa3b5,
    ambientSky: 0xf2f7ff,
    ambientGround: 0x5f7284,
    ambientIntensity: 1.6,
    sun: 0xfff3d6,
    sunIntensity: 2,
    sea: { color: 0x3f4d5c, y: -3.6 },
  });
  // Music factory: a stage at night.
  registerTheme('music', {
    sky: 0x1d1338,
    ambientSky: 0xe0c8ff,
    ambientGround: 0x4a2f7a,
    ambientIntensity: 1.8,
    sun: 0xffe6f5,
    sunIntensity: 1.7,
    sea: { color: 0x140c28, y: -3.6 },
  });
  // Clockwork: the inside of a clock tower, all brass and late light. ("clockwork" is the Moving Hole's.)
  registerTheme('clocktower', {
    sky: 0xe8c98a,
    ambientSky: 0xfff3d9,
    ambientGround: 0xa87f45,
    ambientIntensity: 1.6,
    sun: 0xffe7b8,
    sunIntensity: 2.1,
    sea: { color: 0x6b4f2a, y: -3.6 },
  });
  // The Chapter 6 finale: the whole works, end to end, under the night shift's lamps.
  registerTheme('works', {
    sky: 0x2b3a55,
    ambientSky: 0xdfe9ff,
    ambientGround: 0x55627a,
    ambientIntensity: 1.8,
    sun: 0xfff0d0,
    sunIntensity: 1.9,
    sea: { color: 0x1a2436, y: -3.6 },
  });
  // Subway: under the street, in the light of the station lamps.
  registerTheme('subway', {
    sky: 0x27323d,
    ambientSky: 0xe6f2ff,
    ambientGround: 0x4f6475,
    ambientIntensity: 1.8,
    sun: 0xfff1d0,
    sunIntensity: 1.8,
    sea: { color: 0x161d24, y: -3.6 },
  });
  // Railway town: a clear morning over the roofs.
  registerTheme('railway', {
    sky: 0xaed6f0,
    ambientSky: 0xffffff,
    ambientGround: 0x9fb58a,
    ambientIntensity: 1.6,
    sun: 0xfff2d8,
    sunIntensity: 2.1,
    sea: { color: 0x6f9a62, y: -3.6 },
  });
  // Carnival: the fair at dusk. ("carnival" is the Chapter 3 finale's.)
  registerTheme('funfair', {
    sky: 0xf2a0b8,
    ambientSky: 0xfff0f4,
    ambientGround: 0xb86a8f,
    ambientIntensity: 1.6,
    sun: 0xffe3c2,
    sunIntensity: 2,
    sea: { color: 0x7a3f6b, y: -3.6 },
  });
  // Maze course: a garden on a bright afternoon.
  registerTheme('garden', {
    sky: 0xbfe6c9,
    ambientSky: 0xffffff,
    ambientGround: 0x7fb77a,
    ambientIntensity: 1.6,
    sun: 0xfff6dc,
    sunIntensity: 2.2,
    sea: { color: 0x4f8f5a, y: -3.6 },
  });
  // The Chapter 7 finale: the whole town in one afternoon, the light going gold.
  registerTheme('cityday', {
    sky: 0xf7c98a,
    ambientSky: 0xfff4e2,
    ambientGround: 0xa9916f,
    ambientIntensity: 1.6,
    sun: 0xffe6bd,
    sunIntensity: 2.1,
    sea: { color: 0x5f6f7f, y: -3.6 },
  });
  registerTheme('pirate', {
    sky: 0x9fd8f0,
    ambientSky: 0xffffff,
    ambientGround: 0x7fb6d6,
    ambientIntensity: 1.6,
    sun: 0xfff2d6,
    sunIntensity: 2.2,
    sea: { color: 0x2b7fb5, y: -0.9, opacity: 0.92 },
  });
}
