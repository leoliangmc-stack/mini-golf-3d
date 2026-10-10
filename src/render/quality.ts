import type { Quality } from '../app/progress';

export type Tier = 'low' | 'medium' | 'high';

export interface TierSettings {
  /** Upper limit on device pixels per CSS pixel. */
  pixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
}

export const TIERS: Record<Tier, TierSettings> = {
  low: { pixelRatio: 1, shadows: false, shadowMapSize: 512 },
  medium: { pixelRatio: 1.5, shadows: true, shadowMapSize: 1024 },
  high: { pixelRatio: 2, shadows: true, shadowMapSize: 2048 },
};

const ORDER: Tier[] = ['low', 'medium', 'high'];
/** Auto mode steps down when the frame rate stays under this for two windows in a row. */
const MIN_FPS = 45;
const WINDOW_SECONDS = 3;

/** A phone or a tablet: something played with a finger. */
export function isHandheld(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/**
 * A starting guess from what the browser reveals about the device. A handheld never
 * starts high: a budget phone has eight cores and 4 GB like a laptop, but not the GPU
 * to fill its screen at two device pixels per CSS pixel with a 2048 shadow map, and the
 * automatic step down takes six seconds to notice, on the first hole of all places.
 */
export function guessTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  if (cores <= 4 && memory <= 2) return 'low';
  if (isHandheld()) return 'medium';
  return cores >= 6 && memory >= 4 ? 'high' : 'medium';
}

/**
 * Picks the graphics tier (SPEC 3, performance). In `auto` it starts from a guess and
 * steps down while the game is running if the device cannot hold the frame rate; it
 * never steps back up, to avoid flickering between tiers.
 */
export class QualityController {
  tier: Tier;
  private setting: Quality;
  private frames = 0;
  private elapsed = 0;
  private slowWindows = 0;

  constructor(
    setting: Quality,
    private readonly apply: (settings: TierSettings) => void,
  ) {
    this.setting = setting;
    this.tier = setting === 'auto' ? guessTier() : setting;
    apply(TIERS[this.tier]);
  }

  setSetting(setting: Quality): void {
    if (setting === this.setting) return;
    this.setting = setting;
    this.tier = setting === 'auto' ? guessTier() : setting;
    this.slowWindows = 0;
    this.apply(TIERS[this.tier]);
  }

  /** Call once per rendered frame while a hole is being played. */
  frame(frameDt: number): void {
    if (this.setting !== 'auto' || this.tier === 'low') return;
    this.frames++;
    this.elapsed += frameDt;
    if (this.elapsed < WINDOW_SECONDS) return;
    const fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;
    this.slowWindows = fps < MIN_FPS ? this.slowWindows + 1 : 0;
    if (this.slowWindows < 2) return;
    this.slowWindows = 0;
    this.tier = ORDER[ORDER.indexOf(this.tier) - 1];
    this.apply(TIERS[this.tier]);
  }
}
