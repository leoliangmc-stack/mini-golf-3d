import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { XYZ } from '../core/types';
import { cupTrack } from '../game/cup';
import { goalCups } from '../game/goal';
import type { CompiledHole } from '../level/compile';
import type { BallSize, CupDef, HoleDef } from '../level/schema';
import { DEFAULT_BALL, sizedProps } from '../physics/ball';
import { getSurface } from '../physics/surfaces';
import { buildDecor } from './decor';
import type { Occluder } from './occlusion';
import { mirrorView } from './strangeViews';

/** How much darker the sides of the ground are than its top. */
const SIDE_SHADE = 0.68;
/** A block lower than this never hides the ball on its own level (see render/occlusion.ts). */
const LOW = 0.5;

/** The visible course of one hole. */
export interface HoleView {
  group: THREE.Group;
  /** One per cup of the hole's goal, in the same order; none on a hole that is all pins. */
  cups: CupView[];
  /** Everything that could stand between the camera and the ball. */
  occluders: Occluder[];
}

/** Builds the visible course from the same compiled geometry the physics uses. */
export function buildHoleView(compiled: CompiledHole, hole: HoleDef): HoleView {
  const group = new THREE.Group();
  const occluders: Occluder[] = [];
  const add = (object: THREE.Object3D): void => {
    group.add(object);
    occluders.push({ object, bounds: new THREE.Box3().setFromObject(object) });
  };

  for (const block of buildBlocks(compiled)) add(block);
  for (const solid of buildSolids(compiled)) add(solid);
  for (const decor of hole.decor ?? []) add(buildDecor(decor));
  // The mirror is see-through already: it is never faded out of the way.
  if (hole.mirror) group.add(mirrorView(hole.mirror));

  const cups = goalCups(hole.goal).map((cup) => {
    const track = buildTrack(cup);
    if (track) group.add(track);
    const view = new CupView(cup);
    group.add(view.object);
    return view;
  });
  return { group, cups, occluders };
}

/** Frees the GPU resources of a view built by buildHoleView. */
export function disposeHoleView(group: THREE.Object3D): void {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line) && !(object instanceof THREE.Points)) return;
    // An instanced mesh keeps its per-instance buffers apart from the geometry.
    if (object instanceof THREE.InstancedMesh) object.dispose();
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      material.dispose();
    }
  });
}

/**
 * One mesh per ground piece: its share of the playing surface, its sides and its
 * underside. The physics rolls the ball on a single merged mesh; the picture is split
 * up so that one piece (a building, an island) can be faded without the others.
 */
function buildBlocks(compiled: CompiledHole): THREE.Mesh[] {
  const { ground, bodies } = compiled;
  if (!ground) return [];
  const { vertices, indices, triangleSurfaces, trianglePieces } = ground;
  const color = new THREE.Color();

  return bodies.map((body, piece) => {
    const positions: number[] = [];
    const colors: number[] = [];

    for (let tri = 0; tri < triangleSurfaces.length; tri++) {
      if (trianglePieces[tri] !== piece) continue;
      const corners = [0, 1, 2].map((k) => {
        const v = indices[tri * 3 + k] * 3;
        return [vertices[v], vertices[v + 1], vertices[v + 2]] as const;
      });
      // Two-tone checker (1 m squares) so the eye can read ball speed on a flat colour.
      const cx = (corners[0][0] + corners[1][0] + corners[2][0]) / 3;
      const cz = (corners[0][2] + corners[1][2] + corners[2][2]) / 3;
      const dark = (Math.floor(cx) + Math.floor(cz)) & 1;
      color.setHex(getSurface(triangleSurfaces[tri]).color).multiplyScalar(dark ? 0.93 : 1);
      for (const c of corners) {
        positions.push(c[0], c[1], c[2]);
        colors.push(color.r, color.g, color.b);
      }
    }

    color.setHex(getSurface(body.surface).color).multiplyScalar(SIDE_SHADE);
    const top = body.top;
    const bottom = top.map((p) => [p[0], body.bottomY, p[2]] as const);
    const quad = (a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[]) => {
      for (const p of [a, b, c, a, c, d]) {
        positions.push(p[0], p[1], p[2]);
        colors.push(color.r, color.g, color.b);
      }
    };
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad(top[i], bottom[i], bottom[j], top[j]);
    }
    quad(bottom[0], bottom[3], bottom[2], bottom[1]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  });
}

/**
 * The hole's solid blocks: walls, posts and the like. The low ones are merged, one mesh
 * per surface and floor level, because a hole has dozens of walls and on a phone every
 * mesh is a draw call, twice over with the shadow pass. A wall never hides the ball on
 * its own level (it is lower than the fader's clearance), so merging the walls of one
 * level costs the fader nothing; those of a higher level fade together when they stand
 * between the camera and a ball below them. Anything taller keeps a mesh of its own, so
 * that one building or pillar can be faded without the rest.
 */
function buildSolids(compiled: CompiledHole): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  const low = new Map<string, { surface: string; flat: boolean; parts: THREE.BufferGeometry[] }>();
  const place = (
    geometry: THREE.BufferGeometry,
    surface: string,
    flat: boolean,
    center: readonly number[],
    rotation?: readonly number[],
  ) => {
    if (rotation) geometry.applyQuaternion(new THREE.Quaternion(rotation[0], rotation[1], rotation[2], rotation[3]));
    geometry.translate(center[0], center[1], center[2]);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    if (bounds.max.y - bounds.min.y >= LOW) {
      meshes.push(solidMesh(geometry, surface, flat));
      return;
    }
    const key = `${surface}|${flat}|${Math.round(bounds.min.y * 4)}`;
    const group = low.get(key) ?? { surface, flat, parts: [] };
    group.parts.push(geometry);
    low.set(key, group);
  };
  for (const box of compiled.boxes) {
    const geometry = new THREE.BoxGeometry(box.halfExtents[0] * 2, box.halfExtents[1] * 2, box.halfExtents[2] * 2);
    place(geometry, box.surface, false, box.center, box.rotation);
  }
  for (const c of compiled.cylinders) {
    place(new THREE.CylinderGeometry(c.radius, c.radius, c.halfHeight * 2, 20), c.surface, true, c.center);
  }
  for (const { surface, flat, parts } of low.values()) {
    const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts);
    if (!merged) throw new Error(`The ${surface} blocks of a hole could not be merged into one mesh`);
    if (merged !== parts[0]) for (const part of parts) part.dispose();
    meshes.push(solidMesh(merged, surface, flat));
  }
  return meshes;
}

function solidMesh(geometry: THREE.BufferGeometry, surface: string, flat: boolean): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: getSurface(surface).color, flatShading: flat }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A line on the ground along the path a moving cup follows, so the player can see where it is going. */
function buildTrack(cup: CupDef): THREE.Mesh | null {
  const points = cupTrack(cup);
  if (points.length < 2) return null;
  const half = 0.035;
  const positions: number[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 1e-6) continue;
    // Sideways from the direction of travel, to give the line its width.
    const sx = (-(b.z - a.z) / length) * half;
    const sz = ((b.x - a.x) / length) * half;
    positions.push(
      a.x - sx, a.y, a.z - sz, a.x + sx, a.y, a.z + sz, b.x + sx, b.y, b.z + sz,
      a.x - sx, a.y, a.z - sz, b.x + sx, b.y, b.z + sz, b.x - sx, b.y, b.z - sz,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
  );
  mesh.position.y = 0.012;
  return mesh;
}

/**
 * Colours for the one size of ball a cup takes (SPEC v3 2.2). Large and small match the
 * pads that make the ball that size: green grows, purple shrinks.
 */
export const SIZE_COLORS: Record<BallSize, number> = { small: 0x9b5de5, medium: 0xffb703, large: 0x2fbf71 };
/** Seconds a cup takes to rise out of the ground when its turn comes. */
const APPEAR_SECONDS = 0.45;

/** The hole in the ground with its flag. Follows a moving cup and shows its lid. */
export class CupView {
  readonly object: THREE.Group;
  private readonly lid: THREE.Mesh | null = null;
  private readonly rim: THREE.MeshBasicMaterial;
  private readonly rimColor: number;
  /** How far out of the ground the cup is, 0..1. */
  private risen = 1;

  constructor(cup: CupDef) {
    const { group, rim } = buildCup(cup);
    this.object = group;
    this.rim = rim;
    this.rimColor = rim.color.getHex();
    if (cup.hidden) {
      this.lid = new THREE.Mesh(
        new THREE.CircleGeometry(cup.radius + 0.03, 32),
        new THREE.MeshLambertMaterial({ color: 0x8b95a1 }),
      );
      this.lid.rotation.x = -Math.PI / 2;
      this.lid.position.y = 0.008;
      this.lid.receiveShadow = true;
      group.add(this.lid);
    }
  }

  /**
   * `openness` runs from 0, lid shut, to 1, wide open. A cup that is not `active` is
   * not there at all; when its turn comes it rises out of the ground.
   */
  update(position: XYZ, openness: number, active = true, frameDt = 0): void {
    this.object.position.set(position.x, position.y, position.z);
    this.risen = active ? Math.min(1, this.risen + frameDt / APPEAR_SECONDS) : 0;
    this.object.visible = this.risen > 0;
    // Overshoots a little on the way up, so the eye catches it.
    const t = this.risen;
    this.object.scale.setScalar(t < 1 ? Math.max(1e-3, t * (1 + 0.6 * (1 - t))) : 1);
    if (!this.lid) return;
    // The lid closes like an iris; the rim turns red while the cup takes no ball.
    this.lid.scale.setScalar(Math.max(1e-3, 1 - openness));
    this.lid.visible = openness < 1;
    this.rim.color.setHex(openness > 0 ? this.rimColor : 0xff5a4f);
  }
}

function buildCup(cup: CupDef): { group: THREE.Group; rim: THREE.MeshBasicMaterial } {
  const group = new THREE.Group();
  group.position.set(cup.position[0], cup.position[1], cup.position[2]);

  const hole = new THREE.Mesh(
    new THREE.CircleGeometry(cup.radius, 32),
    new THREE.MeshBasicMaterial({ color: 0x14202b }),
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.004;

  // A cup that takes one size only says so three ways: a thick rim and a flag in that
  // size's colour, and a ball of exactly that size on top of the pole.
  const size = cup.acceptSize && cup.acceptSize !== 'any' ? cup.acceptSize : null;
  const accent = size ? SIZE_COLORS[size] : 0xffffff;
  const rimMaterial = new THREE.MeshBasicMaterial({ color: accent });
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(cup.radius, cup.radius + (size ? 0.08 : 0.03), 32),
    rimMaterial,
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.005;

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 1.3, 8),
    new THREE.MeshLambertMaterial({ color: 0xf4f4f4 }),
  );
  pole.position.y = 0.65;
  pole.castShadow = true;

  const flagShape = new THREE.BufferGeometry();
  flagShape.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 1.3, 0, 0, 1.0, 0, 0.42, 1.15, 0], 3),
  );
  flagShape.computeVertexNormals();
  const flag = new THREE.Mesh(
    flagShape,
    new THREE.MeshLambertMaterial({ color: size ? accent : 0xff5a4f, side: THREE.DoubleSide }),
  );
  flag.castShadow = true;

  group.add(hole, rim, pole, flag);
  if (size) {
    const sample = new THREE.Mesh(
      new THREE.IcosahedronGeometry(sizedProps(DEFAULT_BALL, size).radius, 2),
      new THREE.MeshLambertMaterial({ color: accent, flatShading: true }),
    );
    sample.position.y = 1.3 + sizedProps(DEFAULT_BALL, size).radius;
    group.add(sample);
  }
  return { group, rim: rimMaterial };
}
