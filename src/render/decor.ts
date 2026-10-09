import * as THREE from 'three';
import type { DecorDef } from '../level/schema';

/** Builds a piece of scenery around its own origin; placing and turning it is done for it. */
export type DecorBuilder = (def: DecorDef) => THREE.Object3D;

const registry = new Map<string, DecorBuilder>();

export function registerDecor(type: string, build: DecorBuilder): void {
  registry.set(type, build);
}

/** The model for a piece of scenery, standing where the hole data puts it. */
export function buildDecor(def: DecorDef): THREE.Object3D {
  const build = registry.get(def.type);
  if (!build) throw new Error(`Unknown decor type "${def.type}"`);
  const object = build(def);
  object.position.set(def.at[0], def.at[1], def.at[2]);
  object.rotation.y = ((def.yaw ?? 0) * Math.PI) / 180;
  return object;
}

const flat = (color: number): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color, flatShading: true });

function part(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const group = (...children: THREE.Object3D[]): THREE.Group => new THREE.Group().add(...children);

/** A repeatable stand-in for randomness, so scenery looks the same on every visit. */
function noise(a: number, b: number, c: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Leaves for the top of a trunk. `size` is [radius, height]. */
function canopy(def: DecorDef): THREE.Object3D {
  const [radius, height] = def.size ?? [1.2, 1.7, 0];
  const leaves = flat(def.color ?? 0x3f8f4a);
  const big = part(new THREE.IcosahedronGeometry(1, 1), leaves, 0, height * 0.45);
  big.scale.set(radius, height * 0.55, radius);
  const small = part(new THREE.IcosahedronGeometry(1, 0), leaves, radius * 0.35, height * 0.85, -radius * 0.2);
  small.scale.set(radius * 0.6, height * 0.3, radius * 0.6);
  return group(big, small);
}

/** A whole conifer, for the edges of the scene. `size` is [radius, height]. */
function pine(def: DecorDef): THREE.Object3D {
  const [radius, height] = def.size ?? [0.9, 3.4, 0];
  const leaves = flat(def.color ?? 0x2f7a47);
  const tree = group(part(new THREE.CylinderGeometry(radius * 0.14, radius * 0.2, height * 0.35, 7), flat(0x7a5536), 0, height * 0.17));
  for (let i = 0; i < 3; i++) {
    const r = radius * (1 - i * 0.24);
    tree.add(part(new THREE.ConeGeometry(r, height * 0.36, 8), leaves, 0, height * (0.42 + i * 0.22)));
  }
  return tree;
}

/** The cap of a giant mushroom, for the top of a stem. `size` is [radius]. */
function mushroomCap(def: DecorDef): THREE.Object3D {
  const radius = def.size?.[0] ?? 0.7;
  const cap = part(new THREE.SphereGeometry(radius, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), flat(def.color ?? 0xd9463e));
  cap.scale.y = 0.72;
  const underside = part(new THREE.CircleGeometry(radius, 14), flat(0xf3e6cf));
  underside.rotation.x = Math.PI / 2;
  const mushroom = group(cap, underside);
  const white = flat(0xfff6e8);
  for (let i = 0; i < 6; i++) {
    const around = (i / 6) * Math.PI * 2 + 0.4;
    const out = radius * (i % 2 ? 0.72 : 0.42);
    const up = Math.sqrt(Math.max(0, radius * radius - out * out)) * 0.72;
    mushroom.add(part(new THREE.SphereGeometry(radius * 0.13, 6, 4), white, Math.cos(around) * out, up, Math.sin(around) * out));
  }
  return mushroom;
}

/** `size` is [radius]. */
function rock(def: DecorDef): THREE.Object3D {
  const radius = def.size?.[0] ?? 0.5;
  const stone = part(new THREE.DodecahedronGeometry(radius, 0), flat(def.color ?? 0x8d939a), 0, radius * 0.45);
  stone.scale.y = 0.7;
  return stone;
}

/** `size` is [radius]. */
function bush(def: DecorDef): THREE.Object3D {
  const radius = def.size?.[0] ?? 0.5;
  const leaves = part(new THREE.IcosahedronGeometry(radius, 0), flat(def.color ?? 0x4d9a52), 0, radius * 0.6);
  leaves.scale.y = 0.75;
  return leaves;
}

/** A flat sheet of water. `size` is [width, -, depth]. */
function water(def: DecorDef): THREE.Object3D {
  const [width, , depth] = def.size ?? [4, 0, 4];
  const sheet = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshLambertMaterial({ color: def.color ?? 0x3aa0d8, transparent: true, opacity: 0.88 }),
  );
  sheet.rotation.x = -Math.PI / 2;
  sheet.receiveShadow = true;
  return group(sheet);
}

/** Lit and dark windows on the four sides of a box standing on `at`. `size` is the box. */
function windows(def: DecorDef): THREE.Object3D {
  const [width, height, depth] = def.size ?? [4, 6, 4];
  const pane = new THREE.PlaneGeometry(0.42, 0.55);
  const transforms: THREE.Matrix4[] = [];
  const lit: boolean[] = [];
  const dummy = new THREE.Object3D();
  const rows = Math.floor((height - 0.6) / 1.15);
  // Each side: a centre, the direction it faces, and how wide it is.
  const sides: [x: number, z: number, turn: number, span: number][] = [
    [0, depth / 2, 0, width],
    [0, -depth / 2, Math.PI, width],
    [width / 2, 0, Math.PI / 2, depth],
    [-width / 2, 0, -Math.PI / 2, depth],
  ];
  sides.forEach(([sx, sz, turn, span], side) => {
    const columns = Math.floor((span - 0.5) / 0.95);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const along = (column - (columns - 1) / 2) * 0.95;
        dummy.position.set(
          sx + Math.cos(turn) * along + Math.sin(turn) * 0.012,
          height - 0.95 - row * 1.15,
          sz - Math.sin(turn) * along + Math.cos(turn) * 0.012,
        );
        dummy.rotation.y = turn;
        dummy.updateMatrix();
        transforms.push(dummy.matrix.clone());
        lit.push(noise(def.at[0] + side, def.at[2] + row, column) > 0.45);
      }
    }
  });
  const build = (on: boolean): THREE.InstancedMesh => {
    const picked = transforms.filter((_, i) => lit[i] === on);
    const mesh = new THREE.InstancedMesh(pane, new THREE.MeshBasicMaterial({ color: on ? 0xffe3a1 : 0x2a3340 }), picked.length);
    picked.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    return mesh;
  };
  return group(build(true), build(false));
}

/** A building that is only scenery, standing on `at`. `size` is the box. */
function tower(def: DecorDef): THREE.Object3D {
  const [width, height, depth] = def.size ?? [4, 6, 4];
  const body = part(new THREE.BoxGeometry(width, height, depth), flat(def.color ?? 0x6f7b8a), 0, height / 2);
  return group(body, windows({ ...def, size: [width, height, depth] }));
}

function acUnit(def: DecorDef): THREE.Object3D {
  const fan = part(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 14), flat(0x39424d), 0, 0.57);
  return group(part(new THREE.BoxGeometry(0.9, 0.55, 0.7), flat(def.color ?? 0xc9d0d6), 0, 0.275), fan);
}

function waterTank(def: DecorDef): THREE.Object3D {
  const wood = flat(def.color ?? 0x9a6b42);
  const tank = group(
    part(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 12), wood, 0, 1.55),
    part(new THREE.ConeGeometry(0.85, 0.5, 12), flat(0x5b6570), 0, 2.45),
  );
  const steel = flat(0x4a525c);
  for (const [x, z] of [[0.5, 0.5], [0.5, -0.5], [-0.5, 0.5], [-0.5, -0.5]]) {
    tank.add(part(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 5), steel, x, 0.45, z));
  }
  return tank;
}

/** `size` is [-, height]. */
function antenna(def: DecorDef): THREE.Object3D {
  const height = def.size?.[1] ?? 2.6;
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4d4d }));
  light.position.y = height;
  return group(part(new THREE.CylinderGeometry(0.03, 0.05, height, 5), flat(0x4a525c), 0, height / 2), light);
}

/** A cog lying flat. `size` is [radius]. */
function gear(def: DecorDef): THREE.Object3D {
  const radius = def.size?.[0] ?? 1.5;
  const metal = flat(def.color ?? 0xc9a24b);
  const cog = group(
    part(new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, 0.16, 24), metal, 0, 0.08),
    part(new THREE.CylinderGeometry(radius * 0.25, radius * 0.25, 0.3, 12), flat(0x8a6d2c), 0, 0.15),
  );
  const teeth = Math.max(8, Math.round(radius * 8));
  for (let i = 0; i < teeth; i++) {
    const around = (i / teeth) * Math.PI * 2;
    const tooth = part(new THREE.BoxGeometry(radius * 0.22, 0.16, radius * 0.2), metal, Math.cos(around) * radius * 0.9, 0.08, Math.sin(around) * radius * 0.9);
    tooth.rotation.y = -around;
    cog.add(tooth);
  }
  return cog;
}

/** `size` is the box. */
function crate(def: DecorDef): THREE.Object3D {
  const [width, height, depth] = def.size ?? [0.9, 0.9, 0.9];
  const box = part(new THREE.BoxGeometry(width, height, depth), flat(def.color ?? 0xa87943), 0, height / 2);
  const band = flat(0x6f4b25);
  return group(
    box,
    part(new THREE.BoxGeometry(width * 1.03, height * 0.12, depth * 1.03), band, 0, height * 0.12),
    part(new THREE.BoxGeometry(width * 1.03, height * 0.12, depth * 1.03), band, 0, height * 0.88),
  );
}

function barrel(def: DecorDef): THREE.Object3D {
  const stripe = flat(0x2c2f36);
  return group(
    part(new THREE.CylinderGeometry(0.38, 0.38, 1, 12), flat(def.color ?? 0xc0392b), 0, 0.5),
    part(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 12), stripe, 0, 0.25),
    part(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 12), stripe, 0, 0.75),
  );
}

/** A tapering four-sided pillar with a pointed top. `size` is [width, height]. */
function obelisk(def: DecorDef): THREE.Object3D {
  const [width, height] = def.size ?? [0.8, 4, 0];
  const stone = flat(def.color ?? 0xc9a56a);
  const shaft = part(new THREE.CylinderGeometry(width * 0.34, width * 0.5, height, 4), stone, 0, height / 2);
  const tip = part(new THREE.ConeGeometry(width * 0.34, width * 0.7, 4), flat(0xf2c14e), 0, height + width * 0.35);
  shaft.rotation.y = tip.rotation.y = Math.PI / 4;
  return group(shaft, tip);
}

/** A round column on a square base. A short one reads as broken. `size` is [radius, height]. */
/** A fairground tent: a round wall and a striped cone of a roof, with a flag. `size` is [radius, height of the wall]. */
function tent(def: DecorDef): THREE.Object3D {
  const [radius, height] = def.size ?? [2.4, 3, 0];
  const color = def.color ?? 0xe5484d;
  const cloth = flat(color);
  const pale = flat(0xfff3e0);
  const tentGroup = group(part(new THREE.CylinderGeometry(radius, radius, height, 16), pale, 0, height / 2));
  // The roof in gores, every other one white.
  for (let i = 0; i < 8; i++) {
    const gore = part(new THREE.ConeGeometry(radius * 1.12, height * 0.8, 16, 1, false, (i * Math.PI) / 4, Math.PI / 4), i % 2 ? pale : cloth, 0, height * 1.4);
    tentGroup.add(gore);
  }
  tentGroup.add(
    part(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), flat(0x59626d), 0, height * 1.8 + 0.4),
    part(new THREE.BoxGeometry(0.5, 0.26, 0.03), cloth, 0.27, height * 1.8 + 0.7),
  );
  return tentGroup;
}

/**
 * A stretch of railway track, for a train that crosses the course on a line of its
 * own: a bed, two rails and sleepers, on trestles. It runs along X about where it
 * stands. `size` is [length, how far down the trestles reach].
 */
function track(def: DecorDef): THREE.Object3D {
  const [length, drop] = def.size ?? [10, 3.6, 0];
  const bed = flat(0x5b5148);
  const line = group(part(new THREE.BoxGeometry(length, 0.05, 0.9), bed, 0, 0.005));
  const steel = flat(0xb9c0c8);
  for (const side of [-0.3, 0.3]) line.add(part(new THREE.BoxGeometry(length, 0.05, 0.06), steel, 0, 0.05, side));
  const wood = flat(0x7a5a3c);
  const ties = Math.max(1, Math.round(length / 0.5));
  for (let i = 0; i < ties; i++) line.add(part(new THREE.BoxGeometry(0.12, 0.035, 0.82), wood, ((i + 0.5) / ties - 0.5) * length, 0.035));
  const posts = Math.max(2, Math.round(length / 3));
  for (let i = 0; i < posts; i++) {
    line.add(part(new THREE.CylinderGeometry(0.1, 0.14, drop, 6), bed, ((i + 0.5) / posts - 0.5) * length, -drop / 2 - 0.02));
  }
  return line;
}

function column(def: DecorDef): THREE.Object3D {
  const [radius, height] = def.size ?? [0.35, 2.4, 0];
  const stone = flat(def.color ?? 0xb9b39c);
  const base = part(new THREE.BoxGeometry(radius * 2.8, 0.25, radius * 2.8), stone, 0, 0.125);
  const shaft = part(new THREE.CylinderGeometry(radius * 0.9, radius, height, 9), stone, 0, 0.25 + height / 2);
  const top = part(new THREE.CylinderGeometry(radius * 1.25, radius * 0.9, 0.22, 9), stone, 0, 0.36 + height);
  // A broken column ends in a slant instead of a capital.
  if (height < 1.6) top.rotation.z = 0.35;
  return group(base, shaft, top);
}

/** A cluster of crystals growing out of the rock. `size` is [height]. */
function crystals(def: DecorDef): THREE.Object3D {
  const height = def.size?.[0] ?? 1.6;
  const glass = new THREE.MeshLambertMaterial({
    color: def.color ?? 0x8fe3ff,
    flatShading: true,
    emissive: def.color ?? 0x2a8fb5,
    emissiveIntensity: 0.55,
  });
  const cluster = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const tall = height * (1 - i * 0.16);
    const shard = part(new THREE.ConeGeometry(tall * 0.16, tall, 5), glass, 0, tall / 2 - 0.1);
    const lean = new THREE.Group().add(shard);
    lean.rotation.set(0.32 * (i > 0 ? 1 : 0), i * 1.4, 0.28 * (i % 2 ? 1 : -1) * (i > 0 ? 1 : 0));
    cluster.add(lean);
  }
  return cluster;
}

/** A palm tree. `size` is [height]. */
function palm(def: DecorDef): THREE.Object3D {
  const height = def.size?.[0] ?? 3.4;
  const trunk = part(new THREE.CylinderGeometry(0.11, 0.2, height, 7), flat(0x8a6a45), 0, height / 2);
  const leaves = flat(def.color ?? 0x3f9a55);
  const crown = new THREE.Group();
  crown.position.y = height;
  for (let i = 0; i < 7; i++) {
    const frond = part(new THREE.ConeGeometry(0.3, 1.4, 4), leaves, 0, 0, 0.66);
    frond.rotation.x = Math.PI / 2 + 0.5;
    frond.scale.z = 0.25;
    crown.add(new THREE.Group().add(frond));
    crown.children[i].rotation.y = (i / 7) * Math.PI * 2;
  }
  const tree = group(trunk, crown);
  tree.rotation.z = 0.06;
  return tree;
}

/** A heap of gold. `size` is [radius]. */
function goldHeap(def: DecorDef): THREE.Object3D {
  const radius = def.size?.[0] ?? 1.2;
  const gold = new THREE.MeshLambertMaterial({ color: 0xf2c14e, flatShading: true, emissive: 0x6a4300, emissiveIntensity: 0.5 });
  const heap = part(new THREE.ConeGeometry(radius, radius * 0.55, 9), gold, 0, radius * 0.27);
  const pieces = [0, 1, 2, 3].map((i) =>
    part(new THREE.IcosahedronGeometry(radius * 0.16, 0), gold, Math.cos(i * 1.9) * radius * 0.8, radius * 0.1, Math.sin(i * 1.9) * radius * 0.8),
  );
  return group(heap, ...pieces);
}

/** A branching coral. `size` is [height]. */
function coral(def: DecorDef): THREE.Object3D {
  const height = def.size?.[0] ?? 1.6;
  const flesh = flat(def.color ?? 0xf0766a);
  const bush = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const tall = height * (0.55 + 0.45 * noise(def.at[0], def.at[2], i));
    const arm = part(new THREE.CylinderGeometry(tall * 0.05, tall * 0.11, tall, 5), flesh, 0, tall / 2);
    const tip = part(new THREE.IcosahedronGeometry(tall * 0.12, 0), flesh, 0, tall);
    const lean = new THREE.Group().add(arm, tip);
    lean.rotation.set(i === 0 ? 0 : 0.45, i * 1.25, 0);
    bush.add(lean);
  }
  return bush;
}

/** A stand of kelp. `size` is [height]. */
function kelp(def: DecorDef): THREE.Object3D {
  const height = def.size?.[0] ?? 3;
  const leaf = new THREE.MeshLambertMaterial({ color: def.color ?? 0x2f8f6a, flatShading: true, side: THREE.DoubleSide });
  const stand = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const tall = height * (0.6 + 0.4 * noise(def.at[0], def.at[2], i + 9));
    const blade = part(new THREE.PlaneGeometry(0.22, tall, 1, 4), leaf, Math.cos(i * 1.9) * 0.3, tall / 2, Math.sin(i * 1.9) * 0.3);
    blade.rotation.y = i * 1.1;
    blade.rotation.z = (noise(i, def.at[0], 3) - 0.5) * 0.3;
    stand.add(blade);
  }
  return stand;
}

/** A length of pipe on two feet. `size` is [length, radius]. */
function pipe(def: DecorDef): THREE.Object3D {
  const [length, radius] = def.size ?? [4, 0.35, 0];
  const steel = flat(def.color ?? 0x6f7b86);
  const run = part(new THREE.CylinderGeometry(radius, radius, length, 12), steel, 0, radius + 0.5);
  run.rotation.z = Math.PI / 2;
  const feet = [-1, 1].map((side) => part(new THREE.BoxGeometry(0.3, 0.5, radius * 2.2), steel, side * length * 0.35, 0.25));
  const flange = [-1, 1].map((side) => {
    const ring = part(new THREE.CylinderGeometry(radius * 1.25, radius * 1.25, 0.12, 12), flat(0x4f5963), side * length * 0.5, radius + 0.5);
    ring.rotation.z = Math.PI / 2;
    return ring;
  });
  return group(run, ...feet, ...flange);
}

export function registerBuiltinDecor(): void {
  registerDecor('canopy', canopy);
  registerDecor('pine', pine);
  registerDecor('mushroomCap', mushroomCap);
  registerDecor('rock', rock);
  registerDecor('bush', bush);
  registerDecor('water', water);
  registerDecor('windows', windows);
  registerDecor('tower', tower);
  registerDecor('acUnit', acUnit);
  registerDecor('waterTank', waterTank);
  registerDecor('antenna', antenna);
  registerDecor('gear', gear);
  registerDecor('crate', crate);
  registerDecor('barrel', barrel);
  registerDecor('obelisk', obelisk);
  registerDecor('column', column);
  registerDecor('crystals', crystals);
  registerDecor('palm', palm);
  registerDecor('goldHeap', goldHeap);
  registerDecor('coral', coral);
  registerDecor('kelp', kelp);
  registerDecor('pipe', pipe);
  registerDecor('tent', tent);
  registerDecor('track', track);
}
