import { beforeAll, describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/chapters';
import { stagesOf } from '../src/level/chapters';
import { compileHole } from '../src/level/compile';
import { boxReach, emptyRect, groundUnder, heightMap, mapPoint, SCALE, siteOf, type Rect } from '../src/render/scenery/placement';
import { setupEngine } from './helpers';

beforeAll(setupEngine);

const holes = CHAPTERS.flatMap(stagesOf).flatMap((world) => world.holes);

describe('scenery placement', () => {
  const lane: Rect = { minX: -1, maxX: 1, minZ: -4, maxZ: 4 };
  const site: Rect = { minX: -3, maxX: 9, minZ: -12, maxZ: 6 };

  it('keeps each side of the design course on the same side of the hole, as far out again SCALE times', () => {
    expect(mapPoint(lane, site, -3, 0)).toEqual({ x: -3 - 2 * SCALE, z: -3 });
    expect(mapPoint(lane, site, 2.5, -6)).toEqual({ x: 9 + 1.5 * SCALE, z: -12 - 2 * SCALE });
    // Along a side, a point keeps its share of the way.
    expect(mapPoint(lane, site, 0, 4).x).toBe(3);
    expect(mapPoint(lane, site, 1, 2).z).toBe(1.5);
  });

  it('bounds a turned wall by its corners, not by a circle of its length', () => {
    // A wall 16 m long and 0.2 thick, running along Z (turned 90 degrees about Y).
    const half = Math.SQRT1_2;
    const rect = boxReach(emptyRect(), { center: [2, 0, -3], halfExtents: [8, 0.3, 0.1], rotation: [0, half, 0, half], surface: 'rail' });
    expect(rect.maxX - rect.minX).toBeCloseTo(0.2, 6);
    expect(rect.maxZ - rect.minZ).toBeCloseTo(16, 6);
    expect((rect.minZ + rect.maxZ) / 2).toBeCloseTo(-3, 6);
  });

  it('lines the design course up with the hole, and its ground with the scenery ground', () => {
    const height = heightMap(0, 0.22, -0.9, 0);
    expect(height(0.22)).toBeCloseTo(0, 9);
    expect(height(0)).toBeCloseTo(-0.9, 9);
    expect(height(2.22)).toBeCloseTo(2 * SCALE, 9);
    // A course up on a table: the floor far below, the table top at the hole.
    const table = heightMap(-3.6, 0.22, -7.64, 0);
    expect(table(-3.6)).toBeCloseTo(-7.64, 9);
    expect(table(0.22)).toBeCloseTo(0, 9);
  });

  it('frames ice-1 by its lane, four metres and its rails across', () => {
    const hole = holes.find((h) => h.id === 'ice-1')!;
    const rect = siteOf(compileHole(hole), hole);
    expect(rect.maxX - rect.minX).toBeLessThan(5);
    expect(rect.maxZ - rect.minZ).toBeGreaterThan(15);
  });

  it('puts the scenery ground under every block of every hole, and on the street in the city', () => {
    for (const hole of holes) {
      const compiled = compileHole(hole);
      const ground = groundUnder(compiled, -0.44);
      const lowest = Math.min(...compiled.bodies.map((body) => body.bottomY));
      expect(ground, hole.id).toBeLessThanOrEqual(lowest);
      if (lowest >= 0) expect(ground, hole.id).toBe(lowest);
      else expect(ground, hole.id).toBeLessThanOrEqual(-0.9);
    }
  });

  it('gives every hole a site of its own, round its tee', () => {
    for (const hole of holes) {
      const rect = siteOf(compileHole(hole), hole);
      const [x, , z] = hole.tee;
      expect(x, hole.id).toBeGreaterThanOrEqual(rect.minX);
      expect(x, hole.id).toBeLessThanOrEqual(rect.maxX);
      expect(z, hole.id).toBeGreaterThanOrEqual(rect.minZ);
      expect(z, hole.id).toBeLessThanOrEqual(rect.maxZ);
      // Large holes run to about 40 metres; anything far beyond that is a bad bound.
      expect(rect.maxX - rect.minX, hole.id).toBeLessThan(60);
      expect(rect.maxZ - rect.minZ, hole.id).toBeLessThan(60);
    }
  });
});
