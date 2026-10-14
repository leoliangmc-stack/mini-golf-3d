import * as THREE from 'three';
import type { DesignCourse, DesignHooks } from './design.js';
import { designLibrary } from './library';
import { emptyRect, include, type Rect } from './placement';

/** The design project names each finale after its hole, not its world (as scripts/world-art.py does). */
const FINALES: Record<string, string> = {
  'ch1-finale': 'gauntlet',
  'ch2-finale': 'countdown',
  'ch3-finale': 'grand',
  'ch4-finale': 'temple',
  'ch5-finale': 'spring',
  'ch6-finale': 'works',
  'ch7-finale': 'dayout',
  'ch8-finale': 'strange',
  'ch9-finale': 'castle',
};

export const designName = (worldId: string): string => FINALES[worldId] ?? worldId;

/**
 * Pieces of a scene bigger than this across, in design units, are things in their own
 * right (a wall, a hill) and never part of a cluster: else everything leaning on a wall
 * would move as one with it.
 */
export const PROP_SIZE = 4;
/** Pieces this close count as touching, in design units: a bulb on its post, a string under its balloon. */
const TOUCH = 0.06;
/**
 * Times more often the ground's pictures repeat than in the design. Its camera was well
 * back from a course half the size; the game's looks down close, and a ground drawn
 * the design's way goes soft and blocky under it.
 */
const GROUND_DETAIL = 2;

/**
 * Pieces of a scene that touch, which go round a hole together: a lamp keeps its bulb,
 * a balloon its string. The design builds many props out of separate pieces.
 */
export interface Cluster {
  members: THREE.Object3D[];
  box: THREE.Box3;
  /** The middle of `box`: what is placed round the hole, the members kept round it. */
  anchor: THREE.Vector3;
}

export interface DesignLight {
  light: THREE.PointLight | THREE.SpotLight | THREE.DirectionalLight;
  /** The cluster it lights from inside, which it moves with: a lamp's bulb. */
  cluster: Cluster | null;
}

/** One world's scene from the design project, taken apart for placing round holes. */
export interface DesignSet {
  name: string;
  /** Where the design's demonstration courses lay. */
  lane: Rect;
  /** The height of the design's ground (0 in nearly every scene). */
  ground: number;
  /** The height of the playing surface of its course (the first, where there are two): what the hole's own lines up with. */
  top: number;
  /** Whether the scene has a floor of its own: a scene of sky or space has none. */
  floored: boolean;
  /** Things centred on the course and bigger than it: the ground, the sky, a fall of snow. */
  around: THREE.Object3D[];
  clusters: Cluster[];
  lights: DesignLight[];
  hemisphere: THREE.HemisphereLight | null;
  background: THREE.Color;
  fog: THREE.Fog | null;
  /** The light of a room, reflected in everything glossy, and how strongly. */
  environment: THREE.Texture;
  environmentIntensity: number;
  /** The picture's camera: where it stood, what it looked at, and how wide. */
  camera: { position: THREE.Vector3; target: THREE.Vector3; fov: number };
  /** What the demonstration courses were laid with, for the course's own look. */
  courses: DesignCourse[];
  /** The wooden sign by the tee, for each hole to have one with its own number. */
  sign: THREE.Group | null;
  dispose(): void;
}

export interface SetQuality {
  /** Share of the segments of round shapes kept, 0..1. */
  detail: number;
  /** Clear coat and sheen, which only the high tier can afford. */
  physical: boolean;
  /** Bump maps: cheap, but not free on the smallest phones. */
  bumps: boolean;
  /** Plain diffuse shading, without shine: the cheapest pixels, for the smallest phones. */
  flat: boolean;
}

/** The properties that make two materials look the same, for sharing one between them. */
const LOOK: readonly string[] = [
  'type', 'color', 'emissive', 'emissiveIntensity', 'roughness', 'metalness', 'opacity', 'transparent', 'side',
  'flatShading', 'map', 'bumpMap', 'bumpScale', 'emissiveMap', 'alphaMap', 'depthWrite', 'fog', 'wireframe',
  'clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'sheenColor', 'iridescence', 'iridescenceIOR',
  'envMapIntensity', 'toneMapped',
];

function lookOf(material: THREE.Material): string {
  const record = material as unknown as Record<string, unknown>;
  return LOOK.map((key) => {
    const value = record[key];
    if (value instanceof THREE.Color) return value.getHexString();
    if (value instanceof THREE.Texture) return value.uuid;
    return String(value);
  }).join('|');
}

/** The same colours and pictures, shaded plainly. */
function plainly(material: THREE.MeshStandardMaterial): THREE.MeshLambertMaterial {
  const { color, map, emissive, emissiveMap, emissiveIntensity, side, transparent, opacity, depthWrite, flatShading, fog, alphaMap } = material;
  return new THREE.MeshLambertMaterial({
    color, map, emissive, emissiveMap, emissiveIntensity, side, transparent, opacity, depthWrite, flatShading, fog, alphaMap,
  });
}

/**
 * A material the game can afford. Glass that lets the scene through (`transmission`)
 * costs a second picture of the scene every frame: here it is see-through instead. On
 * the lower tiers clear coat and sheen go too, and a clear coat leaves some of its shine;
 * on the lowest, all shine.
 */
function affordable(material: THREE.Material, quality: SetQuality): THREE.Material {
  if (!(material instanceof THREE.MeshStandardMaterial)) return material;
  let result: THREE.MeshStandardMaterial = material;
  if (material instanceof THREE.MeshPhysicalMaterial && !quality.physical) {
    const plain = new THREE.MeshStandardMaterial().copy(material);
    plain.roughness = material.roughness * (1 - 0.45 * material.clearcoat);
    result = plain;
  }
  const glass = material instanceof THREE.MeshPhysicalMaterial ? material.transmission : 0;
  if (glass > 0) {
    if (result instanceof THREE.MeshPhysicalMaterial) result.transmission = 0;
    result.transparent = true;
    result.opacity = Math.min(result.opacity, 1 - 0.65 * glass);
    result.depthWrite = false;
  }
  if (!quality.bumps) result.bumpMap = null;
  return quality.flat ? plainly(result) : result;
}

const isLight = (object: THREE.Object3D): object is THREE.Light => (object as THREE.Light).isLight === true;

function boxOf(object: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(object);
}

const spans = (box: THREE.Box3, lane: Rect): boolean =>
  box.min.x <= lane.minX + 0.01 && box.max.x >= lane.maxX - 0.01 && box.min.z <= lane.minZ + 0.01 && box.max.z >= lane.maxZ - 0.01;

const within = (x: number, z: number, lane: Rect, margin: number): boolean =>
  x >= lane.minX - margin && x <= lane.maxX + margin && z >= lane.minZ - margin && z <= lane.maxZ + margin;

/** Groups the pieces that touch (see Cluster); a big piece stays on its own. */
function clusterPieces(pieces: { object: THREE.Object3D; box: THREE.Box3 }[]): Cluster[] {
  const parent = pieces.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const small = pieces.map(({ box }) => Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z) < PROP_SIZE);
  const grown = pieces.map(({ box }) => box.clone().expandByScalar(TOUCH));
  for (let i = 0; i < pieces.length; i++) {
    if (!small[i]) continue;
    for (let j = i + 1; j < pieces.length; j++) {
      if (small[j] && grown[i].intersectsBox(pieces[j].box)) parent[find(j)] = find(i);
    }
  }
  const byRoot = new Map<number, Cluster>();
  pieces.forEach(({ object, box }, i) => {
    const root = find(i);
    let cluster = byRoot.get(root);
    if (!cluster) byRoot.set(root, (cluster = { members: [], box: new THREE.Box3(), anchor: new THREE.Vector3() }));
    cluster.members.push(object);
    cluster.box.union(box);
  });
  const clusters = [...byRoot.values()];
  for (const cluster of clusters) cluster.box.getCenter(cluster.anchor);
  return clusters;
}

/** The ground's material, its pictures repeating GROUND_DETAIL times as often. */
function sharpen(ground: THREE.Mesh): void {
  if (Array.isArray(ground.material)) return;
  const material = ground.material.clone();
  const record = material as unknown as Record<string, unknown>;
  for (const key of ['map', 'bumpMap', 'emissiveMap', 'roughnessMap', 'normalMap']) {
    const texture = record[key];
    if (!(texture instanceof THREE.Texture)) continue;
    const finer = texture.clone();
    finer.repeat.multiplyScalar(GROUND_DETAIL);
    finer.needsUpdate = true;
    record[key] = finer;
  }
  ground.material = material;
}

/** The largest flat sheet lying at the bottom of the scene: its ground, if it has one. */
function groundOf(roots: readonly THREE.Object3D[]): THREE.Mesh | null {
  let best: THREE.Mesh | null = null;
  let bestSize = 30;
  for (const root of roots) {
    if (!(root instanceof THREE.Mesh) || !(root.geometry instanceof THREE.PlaneGeometry)) continue;
    if (Math.abs(root.rotation.x + Math.PI / 2) > 1e-3) continue;
    const { width, height } = root.geometry.parameters;
    if (Math.min(width, height) > bestSize) {
      best = root;
      bestSize = Math.min(width, height);
    }
  }
  return best;
}

/**
 * Runs a world's scene code from the design project (`build`, from design.js) and takes
 * its scene apart: what goes round every hole, what stands in for the course and is
 * left out, the lights, the sky. Done once per world and graphics tier. Null for a
 * world the design project has no scene for.
 */
export function buildDesignSet(
  build: typeof import('./design.js').build,
  name: string,
  env: THREE.Texture,
  quality: SetQuality,
): DesignSet | null {
  const courses: { options: DesignCourse; group: THREE.Group; top: number }[] = [];
  let sign: THREE.Group | null = null;
  const hooks: DesignHooks = {
    course: (options, group, top) => courses.push({ options, group, top }),
    sign: (group) => {
      sign = group;
    },
    memo: (kind, make) => {
      const made = new Map<string, unknown>();
      const call = make as unknown as (...args: unknown[]) => unknown;
      const once = (...args: unknown[]) => {
        const key = `${kind}${JSON.stringify(args)}`;
        if (!made.has(key)) made.set(key, call(...args));
        return made.get(key);
      };
      return once as unknown as typeof make;
    },
  };
  const { scene, camera, focus = 10 } = build(designLibrary(env, quality.detail), name, hooks);
  if (!camera) return null;
  scene.updateMatrixWorld(true);

  const surface = courses.length > 0 ? new THREE.Vector3(0, courses[0].top, 0).applyMatrix4(courses[0].group.matrixWorld).y : 0.22;
  const lane = emptyRect();
  for (const { group } of courses) {
    const box = boxOf(group);
    include(include(lane, box.min.x, box.min.z), box.max.x, box.max.z);
  }
  if (!Number.isFinite(lane.minX)) Object.assign(lane, { minX: -1.2, maxX: 1.2, minZ: -3.8, maxZ: 3.8 });

  const roots = [...scene.children];
  const targets = new Set<THREE.Object3D>();
  const lights: THREE.Light[] = [];
  for (const root of roots) {
    if (!isLight(root)) continue;
    lights.push(root);
    if (root instanceof THREE.DirectionalLight || root instanceof THREE.SpotLight) targets.add(root.target);
  }
  // A course on a stand (a table, a sponge) is part of that stand, and goes with it.
  const standIns = new Set<THREE.Object3D>(courses.map(({ group }) => group));
  if (sign) standIns.add(sign);
  const ground = groundOf(roots);
  const around: THREE.Object3D[] = [];
  const pieces: { object: THREE.Object3D; box: THREE.Box3 }[] = [];
  for (const root of roots) {
    if (isLight(root) || targets.has(root) || standIns.has(root)) continue;
    const box = boxOf(root);
    if (box.isEmpty()) continue;
    if (spans(box, lane)) {
      around.push(root);
      continue;
    }
    const centre = box.getCenter(new THREE.Vector3());
    // Whatever stands on the demonstration course, or under it, is the course's: the
    // hole has its own.
    if (within(centre.x, centre.z, lane, 0.1)) continue;
    pieces.push({ object: root, box });
  }
  const clusters = clusterPieces(pieces);

  const designLights: DesignLight[] = [];
  let hemisphere: THREE.HemisphereLight | null = null;
  for (const light of lights) {
    if (light instanceof THREE.HemisphereLight) hemisphere = light;
    else if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight || light instanceof THREE.DirectionalLight) {
      const at = light.position;
      const cluster =
        light instanceof THREE.DirectionalLight
          ? null
          : (clusters.find((c) => c.box.clone().expandByScalar(0.5).containsPoint(at)) ?? null);
      // A lamp on the demonstration course goes with it.
      if (!cluster && !(light instanceof THREE.DirectionalLight) && within(at.x, at.z, lane, 0)) continue;
      designLights.push({ light, cluster });
    }
  }

  // One material for everything that looks the same, and only what the tier can draw.
  const shared = new Map<string, THREE.Material>();
  const share = (material: THREE.Material): THREE.Material => {
    const fit = affordable(material, quality);
    const key = lookOf(fit);
    const found = shared.get(key);
    if (found) return found;
    shared.set(key, fit);
    return fit;
  };
  const kept = [...around, ...clusters.flatMap((c) => c.members)];
  if (sign) kept.push(sign);
  for (const root of kept) {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.material = Array.isArray(object.material) ? object.material.map(share) : share(object.material);
    });
  }

  if (ground) sharpen(ground);

  const target = camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(focus).add(camera.position);
  const fog = scene.fog instanceof THREE.Fog ? scene.fog : null;
  const background = scene.background instanceof THREE.Color ? scene.background.clone() : new THREE.Color(0x888888);

  return {
    name,
    lane,
    // A scene with no floor (sky, space) is measured down from its course as if it had one.
    ground: ground?.position.y ?? surface - 0.45,
    top: surface,
    floored: ground !== null,
    around,
    clusters,
    lights: designLights,
    hemisphere,
    background,
    fog,
    environment: env,
    environmentIntensity: scene.environmentIntensity,
    camera: { position: camera.position.clone(), target, fov: camera.fov },
    courses: courses.map(({ options }) => options),
    sign,
    dispose() {
      const textures = new Set<THREE.Texture>();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
          material.dispose();
        }
      });
      for (const texture of textures) if (texture !== env) texture.dispose();
    },
  };
}
