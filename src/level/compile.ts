import type { Vec3, XYZ } from '../core/types';
import type { FloorPiece, HoleDef, PillarPiece, RampPiece, WallPiece } from './schema';

/** Ground pieces are tessellated on this grid, in metres. */
export const FLOOR_CELL = 0.5;

const SLAB_DEPTH = 0.45;
const WALL_HEIGHT = 0.35;
const WALL_THICKNESS = 0.2;
const PILLAR_HEIGHT = 0.9;
/** Walls reach below the ground so the ball never meets their bottom edge. */
const WALL_SUNK = 0.3;
/** How far a contact point may be from a ground layer and still belong to it. */
const SURFACE_SNAP = 0.1;

export type Quat = readonly [x: number, y: number, z: number, w: number];

/** The playing surface of the whole hole as one mesh with shared vertices. */
export interface CompiledGround {
  vertices: Float32Array;
  indices: Uint32Array;
  /** Surface id of each triangle, in index order. */
  triangleSurfaces: string[];
  /** Surface at a point on the mesh, or null if the point is not on the ground. */
  surfaceAt(point: XYZ): string | null;
}

/** The solid volume under one ground piece. */
export interface CompiledBody {
  /** Corners of the playing surface: (minX,minZ), (minX,maxZ), (maxX,maxZ), (maxX,minZ). */
  top: readonly [Vec3, Vec3, Vec3, Vec3];
  bottomY: number;
  surface: string;
}

export interface CompiledBox {
  center: Vec3;
  halfExtents: Vec3;
  rotation: Quat;
  surface: string;
}

/** Upright cylinder. */
export interface CompiledCylinder {
  center: Vec3;
  radius: number;
  halfHeight: number;
  surface: string;
}

/**
 * Geometry derived from hole data. Both the physics builder and the renderer consume
 * this and nothing else, so what the player sees is what the ball collides with.
 */
export interface CompiledHole {
  ground: CompiledGround | null;
  bodies: CompiledBody[];
  boxes: CompiledBox[];
  cylinders: CompiledCylinder[];
  bounds: { min: Vec3; max: Vec3 };
}

type GroundPiece = FloorPiece | RampPiece;

export function compileHole(hole: HoleDef): CompiledHole {
  const groundPieces: GroundPiece[] = [];
  const boxes: CompiledBox[] = [];
  const cylinders: CompiledCylinder[] = [];
  for (const piece of hole.pieces) {
    if (piece.type === 'wall') boxes.push(compileWall(hole.id, piece));
    else if (piece.type === 'pillar') cylinders.push(compilePillar(piece));
    else groundPieces.push(piece);
  }
  const { ground, bodies } = compileGround(hole.id, groundPieces);
  return { ground, bodies, boxes, cylinders, bounds: computeBounds(ground, boxes) };
}

function compilePillar(pillar: PillarPiece): CompiledCylinder {
  const y = pillar.y ?? 0;
  const height = pillar.height ?? PILLAR_HEIGHT;
  const halfHeight = (height + WALL_SUNK) / 2;
  return {
    center: [pillar.at[0], y + height - halfHeight, pillar.at[1]],
    radius: pillar.radius,
    halfHeight,
    surface: pillar.surface,
  };
}

function heightFn(piece: GroundPiece): (x: number, z: number) => number {
  if (piece.type === 'floor') {
    const y = piece.y ?? 0;
    return () => y;
  }
  const axis = piece.along === 'x' ? 0 : 1;
  const start = piece.min[axis];
  const span = piece.max[axis] - start;
  const { yFrom, yTo } = piece;
  return (x, z) => yFrom + (((axis === 0 ? x : z) - start) / span) * (yTo - yFrom);
}

interface Layer {
  surface: string;
  height(x: number, z: number): number;
}

/**
 * Merges every ground piece into one mesh. A ball rolling across the edge between two
 * separate colliders gets knocked off course; a single mesh with internal-edge
 * correction rolls as smoothly as one slab (see tests/seams.test.ts).
 */
function compileGround(
  holeId: string,
  pieces: readonly GroundPiece[],
): { ground: CompiledGround | null; bodies: CompiledBody[] } {
  if (pieces.length === 0) return { ground: null, bodies: [] };
  const vertices: number[] = [];
  const indices: number[] = [];
  const triangleSurfaces: string[] = [];
  const bodies: CompiledBody[] = [];
  const vertexIds = new Map<string, number>();
  // Several layers can share a cell when one piece passes over another.
  const cells = new Map<string, Layer[]>();

  const fail = (message: string, piece: GroundPiece): never => {
    throw new Error(`Hole "${holeId}": ${message} in ${JSON.stringify(piece)}`);
  };

  const vertex = (ix: number, iz: number, y: number): number => {
    const key = `${ix},${iz},${Math.round(y * 1000)}`;
    let id = vertexIds.get(key);
    if (id === undefined) {
      id = vertices.length / 3;
      vertices.push(ix * FLOOR_CELL, y, iz * FLOOR_CELL);
      vertexIds.set(key, id);
    }
    return id;
  };

  for (const piece of pieces) {
    const toGrid = (value: number): number => {
      const g = value / FLOOR_CELL;
      if (Math.abs(g - Math.round(g)) > 1e-6) {
        fail(`ground bounds must be multiples of ${FLOOR_CELL}, got ${value}`, piece);
      }
      return Math.round(g);
    };
    const x0 = toGrid(piece.min[0]);
    const x1 = toGrid(piece.max[0]);
    const z0 = toGrid(piece.min[1]);
    const z1 = toGrid(piece.max[1]);
    if (x1 <= x0 || z1 <= z0) fail('ground piece needs min < max on both axes', piece);

    const height = heightFn(piece);
    const at = (ix: number, iz: number) => height(ix * FLOOR_CELL, iz * FLOOR_CELL);
    const layer: Layer = { surface: piece.surface, height };

    for (let iz = z0; iz < z1; iz++) {
      for (let ix = x0; ix < x1; ix++) {
        const cellKey = `${ix},${iz}`;
        const cx = (ix + 0.5) * FLOOR_CELL;
        const cz = (iz + 0.5) * FLOOR_CELL;
        let layers = cells.get(cellKey);
        if (!layers) cells.set(cellKey, (layers = []));
        // Where pieces overlap at the same height, the first one listed wins.
        if (layers.some((l) => Math.abs(l.height(cx, cz) - height(cx, cz)) < 1e-3)) continue;
        layers.push(layer);

        const a = vertex(ix, iz, at(ix, iz));
        const b = vertex(ix, iz + 1, at(ix, iz + 1));
        const c = vertex(ix + 1, iz + 1, at(ix + 1, iz + 1));
        const d = vertex(ix + 1, iz, at(ix + 1, iz));
        indices.push(a, b, c, a, c, d);
        triangleSurfaces.push(piece.surface, piece.surface);
      }
    }

    const [minX, minZ] = piece.min;
    const [maxX, maxZ] = piece.max;
    const top = [
      [minX, height(minX, minZ), minZ],
      [minX, height(minX, maxZ), maxZ],
      [maxX, height(maxX, maxZ), maxZ],
      [maxX, height(maxX, minZ), minZ],
    ] as const;
    bodies.push({
      top,
      bottomY: Math.min(...top.map((p) => p[1])) - (piece.depth ?? SLAB_DEPTH),
      surface: piece.surface,
    });
  }

  const ground: CompiledGround = {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    triangleSurfaces,
    surfaceAt(p) {
      const layers = cells.get(`${Math.floor(p.x / FLOOR_CELL)},${Math.floor(p.z / FLOOR_CELL)}`);
      if (!layers) return null;
      let best: string | null = null;
      let bestGap = SURFACE_SNAP;
      for (const layer of layers) {
        const gap = Math.abs(layer.height(p.x, p.z) - p.y);
        if (gap < bestGap) {
          bestGap = gap;
          best = layer.surface;
        }
      }
      return best;
    },
  };
  return { ground, bodies };
}

function compileWall(holeId: string, wall: WallPiece): CompiledBox {
  const [y0, y1] = typeof wall.y === 'object' ? wall.y : [wall.y ?? 0, wall.y ?? 0];
  const height = wall.height ?? WALL_HEIGHT;
  const thickness = wall.thickness ?? WALL_THICKNESS;
  const dx = wall.to[0] - wall.from[0];
  const dz = wall.to[1] - wall.from[1];
  const dy = y1 - y0;
  const run = Math.hypot(dx, dz);
  if (run < 1e-6) throw new Error(`Hole "${holeId}": wall has zero length in ${JSON.stringify(wall)}`);

  // Local +X runs along the wall: tilt it up by `pitch`, then turn it by `yaw`.
  const yaw = Math.atan2(-dz, dx);
  const pitch = Math.atan2(dy, run);
  const sy = Math.sin(yaw / 2);
  const cy = Math.cos(yaw / 2);
  const sp = Math.sin(pitch / 2);
  const cp = Math.cos(pitch / 2);
  // The wall's own "up", which leans with the slope.
  const up = [-Math.sin(pitch) * Math.cos(yaw), Math.cos(pitch), Math.sin(pitch) * Math.sin(yaw)];
  const lift = (height - WALL_SUNK) / 2;
  return {
    center: [
      (wall.from[0] + wall.to[0]) / 2 + up[0] * lift,
      (y0 + y1) / 2 + up[1] * lift,
      (wall.from[1] + wall.to[1]) / 2 + up[2] * lift,
    ],
    // Extended by half a thickness at each end so walls meeting at a corner overlap.
    halfExtents: [Math.hypot(run, dy) / 2 + thickness / 2, (height + WALL_SUNK) / 2, thickness / 2],
    rotation: [sy * sp, sy * cp, cy * sp, cy * cp],
    surface: wall.surface,
  };
}

function computeBounds(ground: CompiledGround | null, boxes: readonly CompiledBox[]): CompiledHole['bounds'] {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const grow = (x: number, y: number, z: number, pad: number) => {
    min[0] = Math.min(min[0], x - pad);
    min[1] = Math.min(min[1], y - pad);
    min[2] = Math.min(min[2], z - pad);
    max[0] = Math.max(max[0], x + pad);
    max[1] = Math.max(max[1], y + pad);
    max[2] = Math.max(max[2], z + pad);
  };
  if (ground) {
    const v = ground.vertices;
    for (let i = 0; i < v.length; i += 3) grow(v[i], v[i + 1], v[i + 2], 0);
  }
  for (const box of boxes) grow(box.center[0], box.center[1], box.center[2], Math.max(...box.halfExtents));
  if (min[0] === Infinity) return { min: [0, 0, 0], max: [0, 0, 0] };
  return { min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] };
}
