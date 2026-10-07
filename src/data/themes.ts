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
