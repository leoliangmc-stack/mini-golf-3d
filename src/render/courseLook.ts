import * as THREE from 'three';
import type { CompiledHole } from '../level/compile';

/**
 * The look of the course itself, after the design project's pictures: turf with a grain
 * and mown stripes, wooden rails with a grain, a post with a brass cap where rails meet,
 * a mat at the tee. The textures are grey: each surface keeps its own colour, which
 * tells the player what it does, and the texture only gives it a grain.
 */

/** Metres of course one repeat of the turf's grain covers. */
export const TURF_METRES = 1.5;
/** Width of a mown stripe, in metres. */
export const STRIPE_METRES = 1;
/** How much darker every other stripe is. */
export const STRIPE_SHADE = 0.93;

/** Surfaces made of wood, which get its grain. */
const WOODEN = new Set(['woodRail', 'plank', 'driftwood', 'deck', 'log', 'bark', 'boardwalk', 'raft', 'crate', 'gate']);
export const isWooden = (surface: string): boolean => WOODEN.has(surface);

/** A repeatable stand-in for randomness, so the grain is the same on every visit. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(width: number, height: number, draw: (g: CanvasRenderingContext2D, random: () => number) => void, seed: number, colour = true): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!, seeded(seed));
  const texture = new THREE.CanvasTexture(canvas);
  if (colour) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** Specks lighter and darker than `base`, as the design draws felt, sand and snow. */
function speckle(base: string, count: number, amount: number, size: number) {
  return (g: CanvasRenderingContext2D, random: () => number) => {
    const { width, height } = g.canvas;
    g.fillStyle = base;
    g.fillRect(0, 0, width, height);
    for (let i = 0; i < count; i++) {
      const v = (random() - 0.5) * amount;
      g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
      const z = size * (0.5 + random());
      g.fillRect(random() * width, random() * height, z, z);
    }
  };
}

/** Lines of grain running along the texture, as the design draws wood. */
function grainLines(base: string) {
  return (g: CanvasRenderingContext2D, random: () => number) => {
    const { width, height } = g.canvas;
    g.fillStyle = base;
    g.fillRect(0, 0, width, height);
    for (let i = 0; i < 110; i++) {
      g.strokeStyle = `rgba(0,0,0,${0.04 + random() * 0.16})`;
      g.lineWidth = 0.5 + random() * 2.5;
      g.beginPath();
      let y = random() * height;
      g.moveTo(0, y);
      for (let x = 0; x <= width; x += 16) {
        y += (random() - 0.5) * 1.6;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  };
}

interface CourseTextures {
  turf: THREE.Texture;
  turfBump: THREE.Texture;
  grain: THREE.Texture;
  grainBump: THREE.Texture;
  mat: THREE.Texture;
}

let textures: CourseTextures | null = null;

/** Made the first time a course is drawn, and kept: every hole uses the same few. */
export function courseTextures(): CourseTextures {
  textures ??= {
    turf: canvasTexture(256, 256, speckle('#f4f4f4', 9000, 0.16, 2), 11),
    turfBump: canvasTexture(256, 256, speckle('#808080', 9000, 0.9, 2), 12, false),
    grain: canvasTexture(512, 128, grainLines('#ffffff'), 13),
    grainBump: canvasTexture(512, 128, grainLines('#808080'), 14, false),
    mat: canvasTexture(128, 128, speckle('#2e4f33', 3000, 0.25, 2), 15),
  };
  return textures;
}

/** Which way the hole runs, for the stripes to go across: 0 along X, 2 along Z. */
export function longAxis(compiled: CompiledHole): 0 | 2 {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const body of compiled.bodies) {
    for (const [x, , z] of body.top) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }
  return maxX - minX > maxZ - minZ ? 0 : 2;
}

/** A rail's end, where a post stands. */
export interface WallEnd {
  x: number;
  z: number;
  /** Heights of the rail's top and bottom. */
  top: number;
  bottom: number;
  /** Half the rail's thickness. */
  half: number;
  surface: string;
}

/**
 * The ends of the course's rails: one post where two rails meet, as in the pictures.
 * Only low, thin walls are rails; a building or a tall wall has no posts.
 */
export function wallEnds(compiled: CompiledHole): WallEnd[] {
  const ends: WallEnd[] = [];
  const axis = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  for (const box of compiled.boxes) {
    const [length, height, thickness] = box.halfExtents.map((h) => h * 2);
    if (height < 0.4 || height > 0.9 || thickness > 0.35 || length < 0.5) continue;
    rotation.set(...box.rotation);
    axis.set(1, 0, 0).applyQuaternion(rotation);
    // A rail upright and level only: a slanted one is something else.
    if (Math.abs(axis.y) > 0.05) continue;
    // Walls are compiled half a thickness longer at each end, so that corners overlap.
    const reach = box.halfExtents[0] - box.halfExtents[2];
    const top = box.center[1] + box.halfExtents[1];
    const bottom = box.center[1] - box.halfExtents[1];
    for (const side of [-1, 1]) {
      const x = box.center[0] + axis.x * reach * side;
      const z = box.center[2] + axis.z * reach * side;
      if (ends.some((end) => Math.hypot(end.x - x, end.z - z) < 0.15 && Math.abs(end.top - top) < 0.1)) continue;
      ends.push({ x, z, top, bottom, half: box.halfExtents[2], surface: box.surface });
    }
  }
  return ends;
}
