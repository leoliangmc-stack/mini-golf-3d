import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CompiledHole } from '../../level/compile';
import type { HoleDef } from '../../level/schema';
import { wallEnds } from '../courseLook';
import { PROP_SIZE, type Cluster, type DesignSet } from './designSet';
import { boxReach, centreOf, emptyRect, groundUnder, heightMap, mapPoint, moverReach, SCALE, siteOf, type Rect } from './placement';

/**
 * The layer the scenery is drawn on. It is lit and toned like the design's pictures, in
 * a pass of its own before the course (render/scene.ts), so the course keeps the plain
 * light it was tuned under.
 */
export const SCENERY_LAYER = 1;

/** Margin round the hole the scenery's sun casts shadows over, in metres. */
const SHADOW_MARGIN = 14;
/**
 * The small props the design scatters round its course (snowballs, flowers, coins) are
 * scattered round the hole as well, close in, where the camera that plays the hole sees
 * them: this many to the square metre, out to BORDER metres from the course.
 */
const BORDER_DENSITY = 0.1;
const BORDER = 5;
const MOST_IN_BORDER = 110;
/** Room left between the course and a scattered prop, in metres. */
const BORDER_GAP = 0.45;
/** The biggest prop that is scattered, in design units: across, and tall. */
const SMALL_ACROSS = 1.2;
const SMALL_TALL = 0.8;

/**
 * How far from the hole a prop stands, at the least, for each metre of its height. The
 * camera looks down at about 52 degrees, and further down when the ball is nearer: a
 * prop further out than it is tall can never come between the camera and the ball, so
 * the scenery never has to be faded out of the way, and can all be merged.
 */
const CLEARANCE_PER_METRE = 0.95;

export interface SceneryLimits {
  /** Whether the scenery's sun casts shadows, and how sharp they are. */
  shadows: boolean;
  shadowMapSize: number;
  /** Lamps, candles and the like that light their surroundings. Each costs on every pixel of scenery. */
  lamps: number;
}

/** A hole's scenery, placed. */
export interface SceneryView {
  group: THREE.Group;
  background: THREE.Color;
  fog: THREE.Fog | null;
  environment: THREE.Texture;
  environmentIntensity: number;
  /** The scenery's ground stands in for the sea under the course. */
  floored: boolean;
  /** The picture's camera, set up round this hole. */
  camera: { position: THREE.Vector3; target: THREE.Vector3; fov: number };
  dispose(): void;
}

/** Geometry made for this hole, in place, with the attributes every piece shares. */
function baked(mesh: THREE.Mesh): THREE.BufferGeometry {
  let geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') geometry.deleteAttribute(name);
  }
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  if (!geometry.attributes.uv) {
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
  }
  if (!geometry.index) {
    const count = geometry.attributes.position.count;
    geometry.setIndex(Array.from({ length: count }, (_, i) => i));
  }
  geometry.morphAttributes = {};
  return geometry;
}

/**
 * One mesh per material (and shadow setting) for everything that stands still: a set
 * is hundreds of pieces, and on a phone every mesh is a draw call, and twice over with
 * the shadow pass.
 */
function mergeStill(group: THREE.Group, created: THREE.BufferGeometry[]): THREE.Mesh[] {
  group.updateMatrixWorld(true);
  const buckets = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; parts: THREE.BufferGeometry[] }>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material)) return;
    const key = `${object.material.uuid}|${object.castShadow}|${object.receiveShadow}`;
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = { material: object.material, cast: object.castShadow, receive: object.receiveShadow, parts: [] }));
    bucket.parts.push(baked(object));
  });
  const meshes: THREE.Mesh[] = [];
  for (const { material, cast, receive, parts } of buckets.values()) {
    const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts);
    if (!merged) continue;
    if (merged !== parts[0]) for (const part of parts) part.dispose();
    created.push(merged);
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    // Merged, a mesh spans the whole set: its box says nothing worth culling by.
    mesh.frustumCulled = false;
    meshes.push(mesh);
  }
  return meshes;
}

/**
 * Copies of the pieces of a cluster, moved round the hole as one: its anchor to `at`,
 * the whole turned by `yaw` about it and scaled by `size` on top of SCALE.
 */
function placeCluster(cluster: Cluster, at: { x: number; z: number }, height: (y: number) => number, yaw = 0, size = 1): THREE.Group {
  const placed = new THREE.Group();
  const turn = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const offset = new THREE.Vector3();
  for (const member of cluster.members) {
    const copy = member.clone();
    offset.set(member.position.x - cluster.anchor.x, 0, member.position.z - cluster.anchor.z).applyQuaternion(turn);
    copy.position.set(at.x + offset.x * SCALE * size, height(member.position.y), at.z + offset.z * SCALE * size);
    copy.quaternion.premultiply(turn);
    copy.scale.multiplyScalar(SCALE * size);
    placed.add(copy);
  }
  return placed;
}

const UP = new THREE.Vector3(0, 1, 0);

/** A repeatable stand-in for randomness, from a hole's id: the same scatter on every visit. */
function seeded(text: string): () => number {
  let s = 0;
  for (let i = 0; i < text.length; i++) s = (Math.imul(s, 31) + text.charCodeAt(i)) | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The ground the course takes up, piece by piece: what a scattered prop keeps clear of. */
function courseRects(compiled: CompiledHole, hole: HoleDef): Rect[] {
  const rects: Rect[] = [];
  for (const body of compiled.bodies) {
    const xs = body.top.map((p) => p[0]);
    const zs = body.top.map((p) => p[2]);
    rects.push({ minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) });
  }
  for (const box of compiled.boxes) rects.push(boxReach(emptyRect(), box));
  for (const c of compiled.cylinders) {
    rects.push({ minX: c.center[0] - c.radius, maxX: c.center[0] + c.radius, minZ: c.center[2] - c.radius, maxZ: c.center[2] + c.radius });
  }
  // Moving parts, and the ground they pass over, belong to the course too.
  for (const mover of hole.movers ?? []) rects.push(moverReach(emptyRect(), mover));
  return rects;
}

/** How far a point is from the nearest piece of the course, in metres; 0 on it. */
function distanceToCourse(rects: readonly Rect[], x: number, z: number): number {
  let best = Infinity;
  for (const r of rects) {
    const dx = Math.max(r.minX - x, 0, x - r.maxX);
    const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
    best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
}

/**
 * The design's small props scattered round the hole, close in, and into the gaps of a
 * hole that is not one rectangle. Each keeps clear of the course by its own size, and
 * by its height (CLEARANCE_PER_METRE), so none can hide the ball.
 */
function scatterBorder(
  set: DesignSet,
  compiled: CompiledHole,
  hole: HoleDef,
  site: Rect,
  height: (y: number) => number,
  /** Ground the design's own props stand on already: x, z and reach, in metres. */
  taken: { x: number; z: number; r: number }[],
): THREE.Group[] {
  const small = set.clusters.filter(({ box }) => {
    const across = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    return across <= SMALL_ACROSS && box.max.y - set.ground <= SMALL_TALL && box.min.y - set.ground <= 0.15;
  });
  if (small.length === 0) return [];
  const rects = courseRects(compiled, hole);
  const random = seeded(hole.id);
  const minX = site.minX - BORDER;
  const minZ = site.minZ - BORDER;
  const width = site.maxX - site.minX + 2 * BORDER;
  const depth = site.maxZ - site.minZ + 2 * BORDER;
  const wanted = Math.min(MOST_IN_BORDER, Math.round(width * depth * BORDER_DENSITY * 0.6));
  const placed: THREE.Group[] = [];
  for (let tries = 0; placed.length < wanted && tries < wanted * 12; tries++) {
    const x = minX + random() * width;
    const z = minZ + random() * depth;
    const cluster = small[Math.floor(random() * small.length)];
    const size = 0.85 + random() * 0.3;
    const reach = (Math.max(cluster.box.max.x - cluster.box.min.x, cluster.box.max.z - cluster.box.min.z) / 2) * SCALE * size;
    const top = height(cluster.box.max.y);
    const clear = distanceToCourse(rects, x, z) - reach;
    if (clear < BORDER_GAP || clear < top * CLEARANCE_PER_METRE || clear > BORDER) continue;
    if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + reach)) continue;
    taken.push({ x, z, r: reach });
    placed.push(placeCluster(cluster, { x, z }, height, random() * Math.PI * 2, size));
  }
  return placed;
}

/**
 * Where a cluster goes round the hole: where the frame cut in nine puts it (placement.ts),
 * moved further out if it is too tall to stand that close (CLEARANCE_PER_METRE). It is
 * moved the way it already lies from the course, so the picture keeps its order.
 */
function clusterPlace(cluster: Cluster, lane: Rect, site: Rect, top: number): { x: number; z: number } {
  const at = mapPoint(lane, site, cluster.anchor.x, cluster.anchor.z);
  const { box, anchor } = cluster;
  const minX = at.x + (box.min.x - anchor.x) * SCALE;
  const maxX = at.x + (box.max.x - anchor.x) * SCALE;
  const minZ = at.z + (box.min.z - anchor.z) * SCALE;
  const maxZ = at.z + (box.max.z - anchor.z) * SCALE;
  const sideX = anchor.x < lane.minX ? -1 : anchor.x > lane.maxX ? 1 : 0;
  const sideZ = anchor.z < lane.minZ ? -1 : anchor.z > lane.maxZ ? 1 : 0;
  const gapX = sideX < 0 ? site.minX - maxX : sideX > 0 ? minX - site.maxX : -Infinity;
  const gapZ = sideZ < 0 ? site.minZ - maxZ : sideZ > 0 ? minZ - site.maxZ : -Infinity;
  const gap = gapX > 0 && gapZ > 0 ? Math.hypot(gapX, gapZ) : Math.max(gapX, gapZ);
  const short = top * CLEARANCE_PER_METRE - gap;
  if (short <= 0) return at;
  const length = Math.hypot(sideX, sideZ);
  return { x: at.x + (sideX / length) * short, z: at.z + (sideZ / length) * short };
}

/** Something the size of the whole scene (the ground, the sky, a fall of snow), centred on the hole as it was on the course. */
function placeAround(object: THREE.Object3D, lane: Rect, site: Rect, height: (y: number) => number): THREE.Object3D {
  const from = centreOf(lane);
  const to = centreOf(site);
  const copy = object.clone();
  copy.position.set(to.x + (object.position.x - from.x) * SCALE, height(object.position.y), to.z + (object.position.z - from.z) * SCALE);
  copy.scale.multiplyScalar(SCALE);
  return copy;
}

/**
 * A stand-in for the course on the scenery's layer that is never seen, only casts: so
 * that the course throws its shadow on the ground round it, as in the pictures.
 */
function courseShadow(compiled: CompiledHole): THREE.Mesh | null {
  const parts: THREE.BufferGeometry[] = [];
  for (const body of compiled.bodies) {
    const xs = body.top.map((p) => p[0]);
    const zs = body.top.map((p) => p[2]);
    const top = Math.max(...body.top.map((p) => p[1]));
    const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const box = new THREE.BoxGeometry(maxX - minX, top - body.bottomY, maxZ - minZ);
    box.translate((minX + maxX) / 2, (top + body.bottomY) / 2, (minZ + maxZ) / 2);
    parts.push(box);
  }
  for (const box of compiled.boxes) {
    const geometry = new THREE.BoxGeometry(box.halfExtents[0] * 2, box.halfExtents[1] * 2, box.halfExtents[2] * 2);
    geometry.applyQuaternion(new THREE.Quaternion(...box.rotation));
    geometry.translate(...box.center);
    parts.push(geometry);
  }
  if (parts.length === 0) return null;
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!merged) return null;
  const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** How far from the tee its sign stands, at the most, in metres. */
const SIGN_REACH = 3.2;

/**
 * The design's sign by the tee, with this hole's number on it, at the nearest spot to
 * the tee that is clear of the course, to the right of it and toward the camera if it can be.
 */
function placeSign(sign: THREE.Group, hole: HoleDef, rects: readonly Rect[], number: number, height: (y: number) => number, made: { dispose(): void }[]): THREE.Group | null {
  const [tx, , tz] = hole.tee;
  let best: { x: number; z: number; score: number } | null = null;
  for (let ring = 1; ring <= 8; ring++) {
    const r = (ring / 8) * SIGN_REACH;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const x = tx + Math.cos(a) * r;
      const z = tz + Math.sin(a) * r;
      if (distanceToCourse(rects, x, z) < 0.35) continue;
      // Nearer is better; then the side toward the camera, then the right.
      const score = r - Math.sin(a) * 0.6 - Math.cos(a) * 0.3;
      if (!best || score < best.score) best = { x, z, score };
    }
  }
  if (!best) return null;
  const placed = sign.clone();
  placed.position.set(best.x, height(sign.position.y), best.z);
  placed.scale.multiplyScalar(SCALE);
  placed.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial) || !object.material.map) return;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 96;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#c99458';
    g.fillRect(0, 0, 128, 96);
    g.fillStyle = '#3a2412';
    g.font = 'bold 60px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(number), 64, 52);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    object.material = object.material.clone();
    object.material.map = texture;
    made.push(texture, object.material);
  });
  return placed;
}

/** Brass, as on the caps of the posts in the pictures. */
const BRASS = new THREE.MeshStandardMaterial({ color: 0xd9ab55, metalness: 1, roughness: 0.25 });

/** A brass cap on each post of the course's rails (the posts are the course's: render/holeView.ts). */
function postCaps(compiled: CompiledHole): THREE.Mesh | null {
  const parts = wallEnds(compiled).map((end) => {
    const radius = end.half * 1.25 * 0.95;
    const cap = new THREE.SphereGeometry(radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 0.6, 1);
    cap.translate(end.x, end.top + 0.05, end.z);
    return cap;
  });
  if (parts.length === 0) return null;
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!merged) return null;
  const mesh = new THREE.Mesh(merged, BRASS);
  mesh.castShadow = true;
  return mesh;
}

/**
 * The picture's camera round this hole: looking the way it looked, at the same share of
 * the course, from as far as it was or far enough to take in the whole hole.
 */
function openingShot(set: DesignSet, site: Rect, height: (y: number) => number): SceneryView['camera'] {
  const { position, target: aim, fov } = set.camera;
  const at = mapPoint(set.lane, site, aim.x, aim.z);
  const target = new THREE.Vector3(at.x, height(aim.y), at.z);
  const away = position.clone().sub(aim);
  const radius = Math.hypot(site.maxX - site.minX, site.maxZ - site.minZ) / 2;
  const fit = radius / Math.tan(((fov / 2) * Math.PI) / 180);
  const distance = Math.max(away.length() * SCALE, fit * 0.85);
  return { position: away.normalize().multiplyScalar(distance).add(target), target, fov };
}

/**
 * Sets a world's scenery round one hole: every prop moved out from the design's short
 * course to the same side of the real one (scenery/placement.ts), the ground under the
 * course, the sky round it, and the design's lights over it.
 */
export function placeScenery(set: DesignSet, compiled: CompiledHole, hole: HoleDef, number: number, limits: SceneryLimits): SceneryView {
  const site = siteOf(compiled, hole);
  // The hole's playing surface is the height of its tee.
  const level = hole.tee[1];
  const groundY = groundUnder(compiled, level + (set.ground - set.top) * SCALE);
  const height = heightMap(set.ground, set.top, groundY, level);
  const centre = centreOf(site);
  const group = new THREE.Group();
  const still = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const instanced: THREE.InstancedMesh[] = [];

  for (const object of set.around) still.add(placeAround(object, set.lane, site, height));
  const placedAt = new Map<Cluster, { x: number; z: number }>();
  const taken: { x: number; z: number; r: number }[] = [];
  for (const cluster of set.clusters) {
    const at = clusterPlace(cluster, set.lane, site, height(cluster.box.max.y));
    placedAt.set(cluster, at);
    still.add(placeCluster(cluster, at, height));
    // A prop's ground is taken; a wall or a hill is not, or it would take everything.
    const { box, anchor } = cluster;
    const across = Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z);
    if (across > PROP_SIZE) continue;
    taken.push({
      x: at.x + ((box.min.x + box.max.x) / 2 - anchor.x) * SCALE,
      z: at.z + ((box.min.z + box.max.z) / 2 - anchor.z) * SCALE,
      r: (across / 2) * SCALE * 0.8,
    });
  }
  for (const placed of scatterBorder(set, compiled, hole, site, height, taken)) still.add(placed);
  // The sign's plaque, its number drawn for this hole.
  const plaque: { dispose(): void }[] = [];
  const sign = set.sign ? placeSign(set.sign, hole, courseRects(compiled, hole), number, height, plaque) : null;
  if (sign) group.add(sign);
  for (const mesh of mergeStill(still, geometries)) group.add(mesh);
  // A cloud of specks is one mesh already; each copy has its own buffer of places.
  still.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) instanced.push(object);
  });
  for (const mesh of instanced) {
    group.attach(mesh);
    mesh.frustumCulled = false;
  }
  // The pieces were only there to be merged: what is drawn is the merged meshes.
  still.clear();

  if (set.hemisphere) group.add(set.hemisphere.clone());
  const span = Math.max(site.maxX - site.minX, site.maxZ - site.minZ) / 2 + SHADOW_MARGIN;
  let lamps = 0;
  let sunCasts = limits.shadows;
  for (const { light, cluster } of set.lights) {
    if (light instanceof THREE.DirectionalLight) {
      const sun = light.clone();
      const direction = light.position.clone().sub(light.target.position).normalize();
      sun.target.position.set(centre.x, groundY, centre.z);
      sun.position.copy(sun.target.position).addScaledVector(direction, span * 2 + 10);
      sun.castShadow = sunCasts && light.castShadow;
      if (sun.castShadow) {
        sunCasts = false;
        const shadowCamera = sun.shadow.camera;
        shadowCamera.left = shadowCamera.bottom = -span;
        shadowCamera.right = shadowCamera.top = span;
        shadowCamera.near = 1;
        shadowCamera.far = span * 4 + 20;
        shadowCamera.updateProjectionMatrix();
        sun.shadow.mapSize.set(limits.shadowMapSize, limits.shadowMapSize);
        sun.shadow.bias = -0.0008;
        sun.shadow.normalBias = 0.08;
        // Nothing in the scenery moves: its shadows are drawn once.
        sun.shadow.autoUpdate = false;
        sun.shadow.needsUpdate = true;
      }
      group.add(sun, sun.target);
      continue;
    }
    if (lamps >= limits.lamps) continue;
    lamps++;
    const lamp = light.clone();
    const at = cluster ? placedAt.get(cluster)! : mapPoint(set.lane, site, light.position.x, light.position.z);
    const anchor = cluster?.anchor ?? light.position;
    lamp.position.set(at.x + (light.position.x - anchor.x) * SCALE, height(light.position.y), at.z + (light.position.z - anchor.z) * SCALE);
    lamp.distance *= SCALE;
    // The same light at twice the distance: four times the power, to land as bright.
    lamp.intensity *= SCALE * SCALE;
    lamp.castShadow = false;
    group.add(lamp);
    if (lamp instanceof THREE.SpotLight && light instanceof THREE.SpotLight) {
      lamp.target.position.subVectors(light.target.position, light.position).multiplyScalar(SCALE).add(lamp.position);
      group.add(lamp.target);
    }
  }

  const shadow = courseShadow(compiled);
  if (shadow) {
    geometries.push(shadow.geometry);
    group.add(shadow);
  }
  const caps = postCaps(compiled);
  if (caps) {
    geometries.push(caps.geometry);
    group.add(caps);
  }
  group.traverse((object) => object.layers.set(SCENERY_LAYER));

  return {
    group,
    background: set.background,
    fog: set.fog ? new THREE.Fog(set.fog.color, set.fog.near * SCALE, set.fog.far * SCALE) : null,
    environment: set.environment,
    environmentIntensity: set.environmentIntensity,
    floored: set.floored,
    camera: openingShot(set, site, height),
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const mesh of instanced) mesh.dispose();
      for (const thing of plaque) thing.dispose();
      if (shadow) (shadow.material as THREE.Material).dispose();
      group.traverse((object) => {
        if (object instanceof THREE.DirectionalLight && object.shadow.map) object.shadow.dispose();
      });
    },
  };
}
