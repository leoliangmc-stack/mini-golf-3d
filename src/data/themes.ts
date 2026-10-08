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
