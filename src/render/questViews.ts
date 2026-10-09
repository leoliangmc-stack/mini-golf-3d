import * as THREE from 'three';
import type { Part } from '../game/field/field';
import {
  BOSS_HEIGHT,
  MONSTER_FOOT,
  MONSTER_HEIGHT,
  REALM_FLOOR_THICKNESS,
  SHIELD_HALF,
  WEAK_HALF,
  WEAK_OUT,
  type Boss,
  type Door,
  type Key,
  type Monster,
  type Realm,
} from '../game/field/quest';
import type { BossDef, DoorDef, FieldDef, KeyColor, KeyDef, MonsterDef, RealmDef } from '../level/field';
import { getSurface } from '../physics/surfaces';

/** What a part's picture needs to know each frame besides the part itself. The same as fieldViews.ViewFrame. */
interface Frame {
  alpha: number;
  dt: number;
  time: number;
}

interface PartPicture {
  object: THREE.Object3D;
  update?(part: Part, frame: Frame): void;
}

/** The ground the hole's pieces cover, for a picture that has to cover the whole of it. The same as fieldViews.Bounds. */
interface Bounds {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}

const RAD = Math.PI / 180;
const lambert = (color: number, flat = true): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color, flatShading: flat });
const glow = (color: number, opacity = 1): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide });

function solid(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A flat shape lying on the ground, facing up. */
function decal(geometry: THREE.BufferGeometry, material: THREE.Material, y: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

/** Rotation about +Y that points a model built facing -Z along a compass heading (0 is -Z, 90 is +X). */
const headingYaw = (heading: number): number => -heading * RAD;
const ease = (from: number, to: number, rate: number, dt: number): number => from + (to - from) * (1 - Math.exp(-rate * dt));

/** A flat arrowhead pointing along -Z, for the marks over monsters and bosses. */
function arrowGeometry(size: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-size * 0.5, size * 0.4);
  shape.lineTo(0, -size * 0.6);
  shape.lineTo(size * 0.5, size * 0.4);
  shape.lineTo(0, size * 0.1);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/** The colours keys and doors come in. */
export const KEY_COLORS: Record<KeyColor, number> = { red: 0xff4d4d, blue: 0x3f8fff, gold: 0xffc83d };

// --- The haunted house -------------------------------------------------------------------

const GHOST_OPACITY = 0.22;
const VEIL_REAL = 0xffb070;
const VEIL_GHOST = 0x5ad8ff;

/**
 * Two worlds in one place (SPEC v9 3.3). The solid one is drawn as the house is; the
 * other is a see-through shade of itself, with its edges showing. A veil over the
 * whole floor says which world is solid: warm for the real one, cold for the ghost.
 */
export function realmView(def: RealmDef, _field: FieldDef, bounds?: Bounds): PartPicture {
  const group = new THREE.Group();
  const walls: { mesh: THREE.Mesh; edges: THREE.LineSegments; layer: 'real' | 'ghost'; material: THREE.MeshLambertMaterial; edgeMaterial: THREE.LineBasicMaterial }[] = [];
  const floors: { mesh: THREE.Mesh; layer: 'real' | 'ghost'; material: THREE.MeshLambertMaterial; edgeMaterial: THREE.LineBasicMaterial }[] = [];

  const build = (layer: 'real' | 'ghost', side: typeof def.real): void => {
    for (const wall of side.walls ?? []) {
      const dx = wall.to[0] - wall.from[0];
      const dz = wall.to[1] - wall.from[1];
      const length = Math.hypot(dx, dz);
      const height = wall.height ?? 0.35;
      const thickness = wall.thickness ?? 0.2;
      const color = getSurface(wall.surface ?? 'rail').color;
      const material = new THREE.MeshLambertMaterial({ color, transparent: true });
      const mesh = solid(new THREE.BoxGeometry(length, height, thickness), material, (wall.from[0] + wall.to[0]) / 2, (wall.y ?? 0) + height / 2, (wall.from[1] + wall.to[1]) / 2);
      mesh.rotation.y = Math.atan2(-dz, dx);
      const edgeMaterial = new THREE.LineBasicMaterial({ color: layer === 'ghost' ? 0xbffaf5 : 0xffe2c4, transparent: true });
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMaterial);
      mesh.add(edges);
      group.add(mesh);
      walls.push({ mesh, edges, layer, material, edgeMaterial });
    }
    for (const floor of side.floors ?? []) {
      const width = floor.max[0] - floor.min[0];
      const depth = floor.max[1] - floor.min[1];
      const color = getSurface(floor.surface ?? 'slab').color;
      const material = new THREE.MeshLambertMaterial({ color, transparent: true });
      const mesh = solid(
        new THREE.BoxGeometry(width, REALM_FLOOR_THICKNESS, depth),
        material,
        (floor.min[0] + floor.max[0]) / 2,
        (floor.y ?? 0) + 0.004 - REALM_FLOOR_THICKNESS / 2,
        (floor.min[1] + floor.max[1]) / 2,
      );
      const edgeMaterial = new THREE.LineBasicMaterial({ color: layer === 'ghost' ? 0xbffaf5 : 0xffe2c4, transparent: true });
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMaterial));
      group.add(mesh);
      floors.push({ mesh, layer, material, edgeMaterial });
    }
  };
  build('real', def.real);
  build('ghost', def.ghost);

  // The veil: a tint over the whole floor.
  const veilMaterial = new THREE.MeshBasicMaterial({ color: VEIL_REAL, transparent: true, opacity: 0.12, depthWrite: false });
  if (bounds) {
    const veil = decal(new THREE.PlaneGeometry(bounds.max[0] - bounds.min[0] + 2, bounds.max[2] - bounds.min[2] + 2), veilMaterial, 0.009);
    veil.position.x = (bounds.min[0] + bounds.max[0]) / 2;
    veil.position.z = (bounds.min[2] + bounds.max[2]) / 2;
    group.add(veil);
  }
  const veilColor = new THREE.Color(VEIL_REAL);
  const toward = new THREE.Color();
  let ghostness = 0;

  const paint = (ghost: number): void => {
    for (const wall of walls) {
      const there = wall.layer === 'ghost' ? ghost : 1 - ghost;
      wall.material.opacity = GHOST_OPACITY + (1 - GHOST_OPACITY) * there;
      wall.material.depthWrite = there > 0.5;
      wall.mesh.castShadow = there > 0.5;
      wall.edgeMaterial.opacity = 0.35 + 0.65 * there;
    }
    for (const floor of floors) {
      const there = floor.layer === 'ghost' ? ghost : 1 - ghost;
      floor.material.opacity = GHOST_OPACITY + (1 - GHOST_OPACITY) * there;
      floor.material.depthWrite = there > 0.5;
      floor.mesh.castShadow = there > 0.5;
      floor.edgeMaterial.opacity = 0.35 + 0.65 * there;
    }
    toward.setHex(VEIL_GHOST);
    veilColor.setHex(VEIL_REAL).lerp(toward, ghost);
    veilMaterial.color.copy(veilColor);
    veilMaterial.opacity = 0.1 + 0.1 * ghost;
  };
  paint(0);

  return {
    object: group,
    update(part, { dt }) {
      const realm = part as Realm;
      ghostness = ease(ghostness, realm.ghost ? 1 : 0, 10, dt);
      paint(ghostness);
    },
  };
}

// --- Monsters ----------------------------------------------------------------------------

const PATROL_SKIN = 0x6a4c93;
const CHASE_SKIN = 0xd84a5a;
const PATH_MARK = 0xc9b3ff;
const NEXT_MARK = 0xffffff;

/**
 * A monster (SPEC v9 3.4): a squat body with two eyes, facing the way it last walked.
 * One that patrols has its path marked on the ground, with the cell it will step onto
 * next lit; one that chases wears an arrow over its head that points where it would
 * step if the ball stopped now.
 */
export function monsterView(def: MonsterDef, field: FieldDef): PartPicture {
  const grid = field.grid!;
  const cell = grid.cell ?? 1;
  const foot = cell * MONSTER_FOOT;
  const group = new THREE.Group();
  const body = new THREE.Group();
  const skin = lambert(def.mode === 'patrol' ? PATROL_SKIN : CHASE_SKIN);
  const trunk = solid(new THREE.BoxGeometry(foot * 0.92, MONSTER_HEIGHT * 0.78, foot * 0.92), skin, 0, MONSTER_HEIGHT * 0.39);
  body.add(trunk);
  // A head, two eyes, and ears or horns.
  const head = solid(new THREE.BoxGeometry(foot * 0.7, MONSTER_HEIGHT * 0.3, foot * 0.7), skin, 0, MONSTER_HEIGHT * 0.9);
  body.add(head);
  const eyeMaterial = glow(0xffffff);
  const pupil = glow(0x1a1020);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(foot * 0.09, 12), eyeMaterial);
    eye.position.set(side * foot * 0.18, MONSTER_HEIGHT * 0.92, -foot * 0.351);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(foot * 0.045, 10), pupil);
    dot.position.set(side * foot * 0.18, MONSTER_HEIGHT * 0.91, -foot * 0.352);
    body.add(eye, dot);
    const horn = solid(new THREE.ConeGeometry(foot * 0.08, MONSTER_HEIGHT * 0.25, 6), lambert(def.mode === 'patrol' ? 0x3b2a5c : 0x7a2230), side * foot * 0.26, MONSTER_HEIGHT * 1.12, 0);
    body.add(horn);
  }
  // Feet, so it reads as walking.
  for (const side of [-1, 1]) body.add(solid(new THREE.BoxGeometry(foot * 0.28, 0.1, foot * 0.4), lambert(0x2a2030), side * foot * 0.25, 0.05, 0));
  group.add(body);

  const at = (c: readonly [number, number]) => ({ x: grid.origin[0] + c[0] * cell, z: grid.origin[1] + c[1] * cell });
  const y = grid.y ?? 0;

  // The path on the ground, and the next cell.
  const next = decal(new THREE.RingGeometry(foot * 0.42, foot * 0.52, 4), glow(NEXT_MARK, 0.8), y + 0.014);
  next.rotation.z = Math.PI / 4;
  next.visible = false;
  if (def.mode === 'patrol' && def.path) {
    const points = def.path.map((c) => {
      const p = at(c);
      return new THREE.Vector3(p.x, y + 0.012, p.z);
    });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: PATH_MARK, transparent: true, opacity: 0.7 }));
    group.add(line);
    for (const [i, c] of def.path.entries()) {
      const p = at(c);
      const mark = decal(new THREE.CircleGeometry(i === 0 || i === def.path.length - 1 ? 0.09 : 0.05, 10), glow(PATH_MARK, 0.7), y + 0.013);
      mark.position.x = p.x;
      mark.position.z = p.z;
      group.add(mark);
    }
  }
  group.add(next);

  // The arrow over a chasing monster.
  const arrow = new THREE.Mesh(arrowGeometry(0.42), glow(0xffffff, 0.9));
  arrow.rotation.x = -Math.PI / 2;
  const arrowHolder = new THREE.Group();
  arrowHolder.add(arrow);
  arrowHolder.position.y = MONSTER_HEIGHT * 1.45;
  arrowHolder.visible = def.mode === 'chase';
  // And a dot there instead, for one that would stand still.
  const still = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), glow(0xffffff, 0.9));
  still.rotation.x = -Math.PI / 2;
  still.position.y = MONSTER_HEIGHT * 1.45;
  still.visible = false;
  group.add(arrowHolder, still);

  const start = def.mode === 'patrol' ? def.path![0] : def.cell!;
  const p0 = at(start);
  group.position.set(p0.x, y, p0.z);
  body.rotation.y = headingYaw(180);
  let yaw = headingYaw(180);
  let bob = 0;

  return {
    object: group,
    update(part, { alpha, dt, time }) {
      const monster = part as Monster;
      const { prev, center } = monster;
      group.position.set(prev.x + (center.x - prev.x) * alpha, y, prev.z + (center.z - prev.z) * alpha);
      yaw = ease(yaw, headingYaw(monster.facing), 14, dt);
      body.rotation.y = yaw;
      // A hop while it walks.
      const stride = monster.stride;
      bob = monster.busy ? Math.sin(stride * Math.PI) * 0.12 : ease(bob, 0, 20, dt);
      body.position.y = bob;
      const plan = monster.preview();
      if (def.mode === 'patrol') {
        next.visible = plan !== null;
        if (plan) {
          const p = at(plan);
          next.position.x = p.x - group.position.x;
          next.position.z = p.z - group.position.z;
        }
      } else {
        arrowHolder.visible = plan !== null && !monster.busy;
        still.visible = plan === null && !monster.busy;
        if (plan) {
          const dx = plan[0] - monster.cell[0];
          const dz = plan[1] - monster.cell[1];
          arrowHolder.rotation.y = Math.atan2(-dx, -dz);
          arrowHolder.position.y = MONSTER_HEIGHT * 1.45 + 0.05 * Math.sin(time * 6);
        }
      }
    },
  };
}

// --- Keys and doors ----------------------------------------------------------------------

/** A key (SPEC v9 3.5): a ring and a shank, turning slowly in the air, in its colour. It goes when taken. */
export function keyView(def: KeyDef): PartPicture {
  const group = new THREE.Group();
  group.position.set(def.at[0], def.at[1], def.at[2]);
  const color = KEY_COLORS[def.color];
  const material = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 });
  const key = new THREE.Group();
  const ring = solid(new THREE.TorusGeometry(0.13, 0.04, 8, 18), material, 0, 0.26);
  const shank = solid(new THREE.BoxGeometry(0.06, 0.34, 0.06), material, 0, 0.04);
  const bit = solid(new THREE.BoxGeometry(0.14, 0.06, 0.06), material, 0.06, -0.08);
  const bit2 = solid(new THREE.BoxGeometry(0.1, 0.06, 0.06), material, 0.05, 0.03);
  key.add(ring, shank, bit, bit2);
  key.position.y = 0.3;
  const halo = decal(new THREE.RingGeometry(0.28, 0.36, 28), glow(color, 0.55), 0.012);
  group.add(key, halo);
  let shown = 1;
  return {
    object: group,
    update(part, { dt, time }) {
      const taken = (part as Key).held;
      shown = ease(shown, taken ? 0 : 1, 12, dt);
      group.visible = shown > 0.01;
      key.scale.setScalar(Math.max(1e-3, shown));
      halo.scale.setScalar(Math.max(1e-3, shown));
      key.rotation.y = time * 1.6;
      key.position.y = 0.3 + 0.05 * Math.sin(time * 2.5);
    },
  };
}

/** A locked door (SPEC v9 3.5): a slab in its key's colour with a keyhole, which swings down into the ground when opened. */
export function doorView(def: DoorDef): PartPicture {
  const height = def.height ?? 0.8;
  const thickness = def.thickness ?? 0.24;
  const dx = def.to[0] - def.from[0];
  const dz = def.to[1] - def.from[1];
  const length = Math.hypot(dx, dz);
  const group = new THREE.Group();
  group.position.set((def.from[0] + def.to[0]) / 2, def.y ?? 0, (def.from[1] + def.to[1]) / 2);
  group.rotation.y = Math.atan2(-dz, dx);
  const color = KEY_COLORS[def.color];
  const slab = solid(new THREE.BoxGeometry(length, height, thickness), lambert(0x4a3a30));
  const band = solid(new THREE.BoxGeometry(length * 0.9, height * 0.3, thickness * 1.12), new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25 }), 0, 0.05, 0);
  const keyhole = new THREE.Mesh(new THREE.CircleGeometry(height * 0.09, 12), glow(0x14100c));
  keyhole.position.set(0, 0.07, thickness * 0.57);
  const keyhole2 = keyhole.clone();
  keyhole2.position.z = -thickness * 0.57;
  keyhole2.rotation.y = Math.PI;
  slab.add(band, keyhole, keyhole2);
  group.add(slab);
  const place = (openness: number): void => {
    slab.position.y = height / 2 - openness * (height + 0.03);
  };
  place(0);
  return {
    object: group,
    update(part) {
      place((part as Door).openness);
    },
  };
}

// --- The boss ----------------------------------------------------------------------------

/**
 * A boss (SPEC v9 3.6): a great round body with horns and a glaring face, the weak spot
 * glowing on its back, the shield over it when it is up, and an arrow over its head that
 * points where it would turn to if the ball stopped now. Its health is on the HUD.
 */
export function bossView(def: BossDef, field: FieldDef): PartPicture {
  const grid = field.grid!;
  const cell = grid.cell ?? 1;
  const y = grid.y ?? 0;
  const group = new THREE.Group();
  const body = new THREE.Group();
  const skin = lambert(0x5a2a6e);
  const trunk = solid(new THREE.CylinderGeometry(0.72 * cell, 0.85 * cell, BOSS_HEIGHT, 18), skin, 0, BOSS_HEIGHT / 2);
  body.add(trunk);
  const head = solid(new THREE.SphereGeometry(0.5 * cell, 16, 12), skin, 0, BOSS_HEIGHT + 0.2);
  body.add(head);
  const horn = lambert(0xe8d9b0);
  for (const side of [-1, 1]) {
    const h = solid(new THREE.ConeGeometry(0.12 * cell, 0.55, 8), horn, side * 0.38 * cell, BOSS_HEIGHT + 0.6, 0);
    h.rotation.z = -side * 0.5;
    body.add(h);
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.1 * cell, 12), glow(0xffd24a));
    eye.position.set(side * 0.2 * cell, BOSS_HEIGHT + 0.28, -0.47 * cell);
    body.add(eye);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.045 * cell, 10), glow(0x1a0a10));
    pupil.position.set(side * 0.2 * cell, BOSS_HEIGHT + 0.27, -0.475 * cell);
    body.add(pupil);
  }
  // The mouth, and a belt.
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.4 * cell, 0.08), glow(0x1a0a10));
  mouth.position.set(0, BOSS_HEIGHT + 0.02, -0.5 * cell);
  body.add(mouth);
  body.add(solid(new THREE.TorusGeometry(0.8 * cell, 0.06, 8, 24), lambert(0x2c1f2e), 0, BOSS_HEIGHT * 0.5));
  // The weak spot on its back, glowing, and the shield over it.
  const weakMaterial = new THREE.MeshLambertMaterial({ color: 0xff4f6a, emissive: 0xff2040, emissiveIntensity: 0.8 });
  const weak = solid(new THREE.BoxGeometry(WEAK_HALF.x * 2, WEAK_HALF.y * 2, WEAK_HALF.z * 2), weakMaterial, 0, WEAK_HALF.y + 0.1, WEAK_OUT * cell);
  const weakHalo = new THREE.Mesh(new THREE.PlaneGeometry(WEAK_HALF.x * 2.6, WEAK_HALF.y * 2.6), glow(0xff8090, 0.35));
  weakHalo.position.set(0, WEAK_HALF.y + 0.1, WEAK_OUT * cell + WEAK_HALF.z + 0.01);
  const shieldMaterial = new THREE.MeshLambertMaterial({ color: 0x6ad7ff, emissive: 0x2a8ec0, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 });
  const shield = solid(new THREE.BoxGeometry(SHIELD_HALF.x * 2, SHIELD_HALF.y * 2, SHIELD_HALF.z * 2), shieldMaterial, 0, SHIELD_HALF.y + 0.05, WEAK_OUT * cell);
  const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), glow(0x0a2030));
  keyhole.position.set(0, 0.05, SHIELD_HALF.z + 0.01);
  shield.add(keyhole);
  shield.visible = false;
  body.add(weak, weakHalo, shield);
  group.add(body);

  // The arrow over its head, where it would turn to.
  const arrowHolder = new THREE.Group();
  const arrow = new THREE.Mesh(arrowGeometry(0.6), glow(0xffd24a, 0.9));
  arrow.rotation.x = -Math.PI / 2;
  arrowHolder.add(arrow);
  arrowHolder.position.y = BOSS_HEIGHT + 1.15;
  group.add(arrowHolder);
  // Its four cells, on the ground.
  const footMaterial = glow(0xff6a7a, 0.4);
  const footprint = decal(new THREE.RingGeometry(cell * 0.96, cell * 1.02, 48), footMaterial, y + 0.013);
  group.add(footprint);

  const c0 = { x: grid.origin[0] + (def.cell[0] + 0.5) * cell, z: grid.origin[1] + (def.cell[1] + 0.5) * cell };
  group.position.set(c0.x, y, c0.z);
  body.rotation.y = headingYaw(def.facing ?? 180);
  let hurt = 0;
  let dead = 0;

  return {
    object: group,
    update(part, { alpha, dt, time }) {
      const boss = part as Boss;
      const { prev, center } = boss;
      group.position.set(prev.x + (center.x - prev.x) * alpha, y, prev.z + (center.z - prev.z) * alpha);
      body.rotation.y = boss.prevYaw + (boss.yaw - boss.prevYaw) * alpha;
      shield.visible = boss.shielded;
      weak.visible = weakHalo.visible = boss.hp > 0;
      weakMaterial.emissiveIntensity = 0.6 + 0.4 * Math.sin(time * 5);
      arrowHolder.visible = boss.hp > 0 && !boss.busy;
      arrowHolder.rotation.y = headingYaw(boss.preview());
      arrowHolder.position.y = BOSS_HEIGHT + 1.15 + 0.06 * Math.sin(time * 5);
      // A shudder when it is struck, and it sinks when it is beaten.
      hurt = ease(hurt, 0, 6, dt);
      dead = ease(dead, boss.hp === 0 ? 1 : 0, 3, dt);
      body.position.y = -dead * (BOSS_HEIGHT + 0.9) + hurt * 0.05 * Math.sin(time * 40);
      body.scale.setScalar(1 - 0.35 * dead);
      footMaterial.opacity = 0.4 * (1 - dead);
    },
  };
}
