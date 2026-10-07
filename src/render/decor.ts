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
}
