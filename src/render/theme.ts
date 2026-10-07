/** Look of a world: sky and lighting. Surface colours live with the surfaces. */
export interface ThemeDef {
  sky: number;
  /** Hemisphere light: colour from above, colour bounced from below, strength. */
  ambientSky: number;
  ambientGround: number;
  ambientIntensity: number;
  sun: number;
  sunIntensity: number;
  /** A flat sea (water, ice, cloud) below the course. Leave out for open sky. */
  sea?: { color: number; y: number; opacity?: number };
}

const registry = new Map<string, ThemeDef>();

export function registerTheme(id: string, def: ThemeDef): void {
  registry.set(id, def);
}

export function getTheme(id: string): ThemeDef {
  const def = registry.get(id);
  if (!def) throw new Error(`Unknown theme "${id}"`);
  return def;
}
