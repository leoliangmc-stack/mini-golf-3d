/** Level data uses plain tuples so hole files stay terse and JSON-friendly. */
export type Vec2 = readonly [x: number, z: number];
export type Vec3 = readonly [x: number, y: number, z: number];

export interface I18nText {
  en: string;
  zh: string;
}

/** Runtime vector shape shared with Rapier. */
export interface XYZ {
  x: number;
  y: number;
  z: number;
}

export const xyz = (v: Vec3): XYZ => ({ x: v[0], y: v[1], z: v[2] });
export const dot = (a: XYZ, b: XYZ): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (a: XYZ): number => Math.hypot(a.x, a.y, a.z);
