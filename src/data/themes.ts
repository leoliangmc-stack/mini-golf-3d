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
