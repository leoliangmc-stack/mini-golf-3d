import * as THREE from 'three';
import type { XYZ } from '../core/types';
import type { Drive, Field, Part } from '../game/field/field';
import { BELL_POST, type Bell, type Coin, type Dragon, type Fire } from '../game/field/hoard';
import { BEAM_HEIGHT, CRYSTAL_RADIUS, Light, POST_RADIUS, type Crystal, type Receiver } from '../game/field/light';
import type { Slider } from '../game/field/slider';
import type { Gate, Plate, Stone } from '../game/field/tomb';
import type {
  BellDef,
  CoinDef,
  CrystalDef,
  DragonDef,
  EmitterDef,
  FieldDef,
  FireDef,
  GateDef,
  PartDef,
  PlateDef,
  ReceiverDef,
  SliderDef,
  StoneDef,
} from '../level/field';
import { getSurface } from '../physics/surfaces';

/** What a part's picture needs to know each frame besides the part itself. */
export interface ViewFrame {
  /** How far between the last two physics steps this frame is, 0..1. */
  alpha: number;
  /** Seconds since the last frame. */
  dt: number;
  /** Seconds the hole has been on screen, for things that flicker or spin. */
  time: number;
}

/** The picture of one part. `update` is called every frame with the live part. */
export interface PartView {
  object: THREE.Object3D;
  update?(part: Part, frame: ViewFrame): void;
}

export type PartViewBuilder<D extends PartDef = PartDef> = (def: D, field: FieldDef) => PartView;

const registry = new Map<string, PartViewBuilder>();

export function registerPartView<K extends PartDef['kind']>(
  kind: K,
  build: PartViewBuilder<Extract<PartDef, { kind: K }>>,
): void {
  registry.set(kind, build as PartViewBuilder);
}

/** The picture of all the works of a hole. */
export interface FieldView {
  group: THREE.Group;
  update(field: Field, frame: ViewFrame): void;
}

const RAD = Math.PI / 180;
const GOLD = 0xf2c14e;
const HOLD_BLUE = 0x4aa3ff;
const LINK_DIM = 0x35544d;
const LINK_LIT = 0x8dffd6;
const TRAP_DIM = 0x6b3535;
const TRAP_LIT = 0xff6a5a;
const BEAM = 0xfff0a0;

const lambert = (color: number, flat = true): THREE.MeshLambertMaterial =>
  new THREE.MeshLambertMaterial({ color, flatShading: flat });
const glow = (color: number, opacity = 1): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });

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

/** Moves `from` toward `to`, closing most of the gap in about 1/`rate` seconds. */
const ease = (from: number, to: number, rate: number, dt: number): number => from + (to - from) * (1 - Math.exp(-rate * dt));

// --- Plates -------------------------------------------------------------------

function plateView(def: PlateDef, field: FieldDef): PartView {
  const radius = def.radius ?? 0.45;
  // A plate that only ever brings trouble is red, like the line that leads from it.
  const listeners = field.parts.filter((part) => {
    const when = (part as { when?: string | { all?: readonly string[] } }).when;
    return when !== undefined && (typeof when === 'string' ? when === def.id : (when.all ?? []).includes(def.id));
  });
  const trouble =
    listeners.length > 0 &&
    listeners.every((part) => part.kind === 'fire' || (part.kind === 'gate' && part.trap === true));
  const accent = trouble ? TRAP_LIT : def.mode === 'latch' ? GOLD : HOLD_BLUE;
  const group = new THREE.Group();
  group.position.set(def.at[0], def.at[1], def.at[2]);
  const face = solid(new THREE.CylinderGeometry(radius * 0.86, radius * 0.86, 0.06, 28), lambert(0x8f8672, false), 0, 0.035);
  face.castShadow = false;
  const rimMaterial = glow(accent);
  const rim = decal(new THREE.RingGeometry(radius * 0.86, radius, 32), rimMaterial, 0.012);
  // What it is for, at a glance: a keyhole for one that stays down, a bar for one that must be held.
  const markMaterial = glow(accent);
  const mark = decal(
    def.mode === 'latch' ? new THREE.CircleGeometry(radius * 0.22, 20) : new THREE.PlaneGeometry(radius * 0.9, radius * 0.2),
    markMaterial,
    0.07,
  );
  group.add(face, rim, mark);
  const dim = new THREE.Color(accent).multiplyScalar(0.55);
  const bright = new THREE.Color(accent).lerp(new THREE.Color(0xffffff), 0.45);
  let sunk = 0;
  return {
    object: group,
    update(part, { dt }) {
      const plate = part as Plate;
      sunk = ease(sunk, plate.pressed || plate.on ? 1 : 0, 18, dt);
      face.position.y = 0.035 - sunk * 0.045;
      mark.position.y = face.position.y + 0.035;
      rimMaterial.color.copy(plate.on ? bright : dim);
      markMaterial.color.copy(plate.on ? bright : dim);
    },
  };
}

// --- Gates --------------------------------------------------------------------

function gateView(def: GateDef): PartView {
  const height = def.height ?? 0.8;
  const thickness = def.thickness ?? 0.24;
  const dx = def.to[0] - def.from[0];
  const dz = def.to[1] - def.from[1];
  const length = Math.hypot(dx, dz);
  const y = def.y ?? 0;
  const group = new THREE.Group();
  group.position.set((def.from[0] + def.to[0]) / 2, y, (def.from[1] + def.to[1]) / 2);
  group.rotation.y = Math.atan2(-dz, dx);
  const color = getSurface(def.surface ?? 'gate').color;
  const look = def.look ?? 'slab';

  if (look === 'boulder') {
    // A rock hanging over the doorway on a rope. Shut means down.
    const rock = solid(new THREE.IcosahedronGeometry(1, 1), lambert(0x7d7468));
    rock.scale.set(length * 0.52, height * 1.25, Math.max(thickness * 2.4, 0.6));
    const rope = solid(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), lambert(0x6b4f2f));
    group.add(rock, rope);
    const up = 2.6;
    const place = (openness: number): void => {
      // Open, it hangs; let go, it falls faster and faster, as a dropped thing does.
      const fallen = 1 - openness;
      rock.position.y = height * 0.62 + up * (1 - fallen * fallen);
      // The rope holds it only while it hangs.
      rope.visible = openness >= 1;
      rope.scale.y = 1.6;
      rope.position.y = rock.position.y + height * 0.6 + 0.8;
    };
    place(def.trap ? 1 : 0);
    return {
      object: group,
      update(part) {
        place((part as Gate).openness);
      },
    };
  }

  const stone = lambert(color);
  const slab = solid(new THREE.BoxGeometry(length, height, thickness), stone);
  const trim = lambert(look === 'door' ? GOLD : new THREE.Color(color).multiplyScalar(0.62).getHex());
  const cap = solid(new THREE.BoxGeometry(length, 0.08, thickness * 1.18), trim, 0, height / 2);
  slab.add(cap);
  if (look === 'bars' || look === 'door') {
    // Upright ribs, so it reads as a gate and not as one more piece of wall.
    const ribs = Math.max(2, Math.round(length / 0.35));
    for (let i = 0; i < ribs; i++) {
      const x = ((i + 0.5) / ribs - 0.5) * length;
      slab.add(solid(new THREE.BoxGeometry(0.07, height * 0.9, thickness * 1.14), trim, x, 0, 0));
    }
  } else {
    const band = solid(new THREE.BoxGeometry(length * 0.86, height * 0.16, thickness * 1.1), trim, 0, 0, 0);
    slab.add(band);
  }
  group.add(slab);
  // Open, it has sunk into the ground, leaving its cap level with the floor.
  const place = (openness: number): void => {
    slab.position.y = height / 2 - openness * (height + 0.03);
  };
  place(def.trap ? 1 : 0);
  return {
    object: group,
    update(part) {
      place((part as Gate).openness);
    },
  };
}

// --- Stones and their grid -----------------------------------------------------

function stoneView(def: StoneDef, field: FieldDef): PartView {
  const cell = field.grid?.cell ?? 1;
  const width = cell * 0.9;
  const height = cell * 0.6;
  const color = getSurface('block').color;
  const group = new THREE.Group();
  const box = solid(new THREE.BoxGeometry(width, height, width), lambert(color));
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(width * 1.004, height * 1.004, width * 1.004)),
    new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.5) }),
  );
  // An arrow on each side, pointing the way a knock on that side sends it.
  const arrow = new THREE.Shape();
  arrow.moveTo(-0.16, -0.1);
  arrow.lineTo(0, 0.12);
  arrow.lineTo(0.16, -0.1);
  arrow.lineTo(0.08, -0.1);
  arrow.lineTo(0, 0.02);
  arrow.lineTo(-0.08, -0.1);
  arrow.closePath();
  const arrowGeometry = new THREE.ShapeGeometry(arrow);
  const arrowMaterial = glow(new THREE.Color(color).multiplyScalar(0.45).getHex());
  for (let side = 0; side < 4; side++) {
    const mark = new THREE.Mesh(arrowGeometry, arrowMaterial);
    mark.rotation.x = -Math.PI / 2;
    const holder = new THREE.Group();
    holder.rotation.y = (side * Math.PI) / 2;
    mark.position.set(0, height / 2 + 0.004, width * 0.3);
    mark.rotation.z = Math.PI;
    holder.add(mark);
    group.add(holder);
  }
  group.add(box, edges);
  if (field.grid) {
    const [ox, oz] = field.grid.origin;
    group.position.set(ox + def.cell[0] * cell, (field.grid.y ?? 0) + height / 2, oz + def.cell[1] * cell);
  }
  return {
    object: group,
    update(part, { alpha }) {
      const { prev, center } = part as Stone;
      group.position.set(
        prev.x + (center.x - prev.x) * alpha,
        prev.y + (center.y - prev.y) * alpha,
        prev.z + (center.z - prev.z) * alpha,
      );
    },
  };
}

/** Faint squares on the floor: where a stone can stand. */
function gridView(field: FieldDef): THREE.Object3D | null {
  const grid = field.grid;
  if (!grid) return null;
  const cell = grid.cell ?? 1;
  const blocked = new Set((grid.blocked ?? []).map(([col, row]) => `${col},${row}`));
  const positions: number[] = [];
  const half = cell * 0.46;
  const corner = cell * 0.14;
  for (let col = 0; col < grid.cols; col++) {
    for (let row = 0; row < grid.rows; row++) {
      if (blocked.has(`${col},${row}`)) continue;
      const x = grid.origin[0] + col * cell;
      const z = grid.origin[1] + row * cell;
      // Corner ticks only: full outlines would bury the floor in lines.
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const cx = x + sx * half;
        const cz = z + sz * half;
        positions.push(cx, 0, cz, cx - sx * corner, 0, cz, cx, 0, cz, cx, 0, cz - sz * corner);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  lines.position.y = (grid.y ?? 0) + 0.012;
  return lines;
}

// --- Light --------------------------------------------------------------------

function post(radius: number, height: number, color: number): THREE.Mesh {
  return solid(new THREE.CylinderGeometry(radius * 0.8, radius, height, 10), lambert(color), 0, height / 2);
}

/** A flat arrow on the ground from `inner` to `outer` metres out, pointing along -Z. */
function groundArrow(inner: number, outer: number, width: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  const neck = outer - width * 1.1;
  shape.moveTo(-width * 0.28, inner);
  shape.lineTo(-width * 0.28, neck);
  shape.lineTo(-width * 0.7, neck);
  shape.lineTo(0, outer);
  shape.lineTo(width * 0.7, neck);
  shape.lineTo(width * 0.28, neck);
  shape.lineTo(width * 0.28, inner);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function crystalView(def: CrystalDef): PartView {
  const group = new THREE.Group();
  group.position.set(def.at[0], def.at[1], def.at[2]);
  const pedestal = post(CRYSTAL_RADIUS, BEAM_HEIGHT - 0.28, 0x4b5068);
  const gemMaterial = new THREE.MeshLambertMaterial({ color: 0x8fe3ff, flatShading: true, emissive: 0x1d6f8f, emissiveIntensity: 0.4 });
  const gem = solid(new THREE.OctahedronGeometry(0.26, 0), gemMaterial, 0, BEAM_HEIGHT);
  gem.scale.set(1, 1.45, 1);
  // The way the light leaves: a spike on the gem, and an arrow on the ground under it.
  const pointer = new THREE.Group();
  pointer.position.y = BEAM_HEIGHT;
  const spike = solid(new THREE.ConeGeometry(0.09, 0.34, 8), gemMaterial, 0, 0, -0.36);
  spike.rotation.x = -Math.PI / 2;
  pointer.add(spike);
  const arrowGeometry = groundArrow(CRYSTAL_RADIUS + 0.08, 0.98, 0.3);
  const marks = def.facings.map((heading) => {
    const material = glow(0x8fe3ff, 0.3);
    const mark = decal(arrowGeometry, material, 0.014);
    // The shape points along +Y, which lying down is -Z: heading 0.
    mark.rotation.z = headingYaw(heading);
    group.add(mark);
    return material;
  });
  group.add(pedestal, gem, pointer);
  let yaw = headingYaw(def.facings[def.start ?? 0]);
  pointer.rotation.y = yaw;
  return {
    object: group,
    update(part, { dt, time }) {
      const crystal = part as Crystal;
      // Turn the short way round to the new facing.
      const target = headingYaw(crystal.facing);
      const turn = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw));
      yaw += turn * (1 - Math.exp(-14 * dt));
      pointer.rotation.y = yaw;
      gem.rotation.y = yaw + time * 0.4;
      gemMaterial.emissiveIntensity = crystal.lit ? 1.5 : 0.4;
      const next = (crystal.index + 1) % def.facings.length;
      marks.forEach((material, i) => {
        material.opacity = i === crystal.index ? 0.95 : i === next ? 0.4 : 0.14;
        material.color.setHex(i === crystal.index && crystal.lit ? BEAM : 0x8fe3ff);
      });
    },
  };
}

function emitterView(def: EmitterDef): PartView {
  const group = new THREE.Group();
  group.position.set(def.at[0], def.at[1], def.at[2]);
  group.rotation.y = headingYaw(def.heading);
  const lamp = solid(new THREE.BoxGeometry(0.34, 0.34, 0.34), lambert(0x4b5068), 0, BEAM_HEIGHT);
  const lensMaterial = glow(BEAM);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), lensMaterial);
  lens.position.set(0, BEAM_HEIGHT, -0.172);
  lens.rotation.y = Math.PI;
  group.add(post(POST_RADIUS, BEAM_HEIGHT - 0.17, 0x4b5068), lamp, lens);
  return {
    object: group,
    update(part) {
      lensMaterial.color.setHex(part.on ? BEAM : 0x55523f);
    },
  };
}

function receiverView(def: ReceiverDef): PartView {
  const group = new THREE.Group();
  group.position.set(def.at[0], def.at[1], def.at[2]);
  const ringMaterial = glow(0x6a6f85);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 8, 20), ringMaterial);
  ring.position.y = BEAM_HEIGHT;
  const coreMaterial = glow(0x2a2d3c);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), coreMaterial);
  core.position.y = BEAM_HEIGHT;
  group.add(post(POST_RADIUS, BEAM_HEIGHT - 0.24, 0x4b5068), ring, core);
  return {
    object: group,
    update(part, { time }) {
      const receiver = part as Receiver;
      // Lit for good once light has reached it; it throbs while the light is still on it.
      const pulse = receiver.lit ? 0.85 + 0.15 * Math.sin(time * 8) : 1;
      coreMaterial.color.setHex(receiver.on ? BEAM : 0x2a2d3c).multiplyScalar(receiver.on ? pulse : 1);
      ringMaterial.color.setHex(receiver.on ? GOLD : 0x6a6f85);
      ring.rotation.y = time * (receiver.on ? 1.6 : 0);
    },
  };
}

/** The edges of the course on the ground: light that leaves it is not drawn much further. */
export interface Bounds {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}

/** The rectangle the ground of a hole fits in. Tighter than the hole's own bounds, which leave room for its walls. */
export function groundBounds(bodies: readonly { top: readonly (readonly [number, number, number])[] }[]): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const body of bodies) {
    for (const corner of body.top) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], corner[i]);
        max[i] = Math.max(max[i], corner[i]);
      }
    }
  }
  return { min, max };
}

/** Shortens the stretch from `a` to `b` so that it ends at the edge of `bounds`, if it runs past it. */
function clipToBounds(a: THREE.Vector3, b: THREE.Vector3, bounds: Bounds): void {
  let reach = 1;
  for (const axis of ['x', 'z'] as const) {
    const i = axis === 'x' ? 0 : 2;
    const step = b[axis] - a[axis];
    if (Math.abs(step) < 1e-9) continue;
    const edge = step > 0 ? bounds.max[i] + 0.4 : bounds.min[i] - 0.4;
    reach = Math.min(reach, Math.max(0, (edge - a[axis]) / step));
  }
  b.lerpVectors(a, b, reach);
}

/** Every beam of the hole, redrawn only when the light has been traced again. */
function beamsView(bounds?: Bounds): { object: THREE.Group; update(field: Field): void } {
  const group = new THREE.Group();
  const core = new THREE.MeshBasicMaterial({ color: BEAM, transparent: true, opacity: 0.95, depthWrite: false });
  const halo = new THREE.MeshBasicMaterial({
    color: BEAM,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const unit = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  const up = new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  let drawn = -1;
  return {
    object: group,
    update(field) {
      const light = field.system('light', () => new Light(field));
      if (light.version === drawn) return;
      drawn = light.version;
      group.clear();
      for (const beam of light.beams) {
        for (let i = 0; i + 1 < beam.points.length; i++) {
          a.set(beam.points[i].x, beam.points[i].y, beam.points[i].z);
          b.set(beam.points[i + 1].x, beam.points[i + 1].y, beam.points[i + 1].z);
          // Light that misses everything goes on a long way: draw it to the edge of the course.
          if (bounds && !beam.home && i + 2 === beam.points.length) clipToBounds(a, b, bounds);
          const length = a.distanceTo(b);
          if (length < 1e-4) continue;
          for (const [material, radius] of [[core, 0.028], [halo, 0.085]] as const) {
            const mesh = new THREE.Mesh(unit, material);
            mesh.scale.set(radius, length, radius);
            mesh.position.copy(a).add(b).multiplyScalar(0.5);
            mesh.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
            group.add(mesh);
          }
        }
      }
    },
  };
}

// --- Sliders ------------------------------------------------------------------

function sliderView(def: SliderDef): PartView {
  const [width, height, depth] = def.size;
  const color = getSurface(def.surface).color;
  const group = new THREE.Group();
  if (def.look === 'boulder') {
    const rock = solid(new THREE.IcosahedronGeometry(1, 1), lambert(0x7d7468));
    rock.scale.set(width / 2, height / 2, depth / 2);
    group.add(rock);
  } else {
    group.add(solid(new THREE.BoxGeometry(width, height, depth), lambert(color)));
    if (def.look === 'bridge') {
      // Planks across the way the ball rolls.
      const along = depth >= width;
      const planks = Math.max(2, Math.round((along ? depth : width) / 0.45));
      const dark = lambert(new THREE.Color(color).multiplyScalar(0.72).getHex());
      for (let i = 1; i < planks; i++) {
        const at = (i / planks - 0.5) * (along ? depth : width);
        const gap = new THREE.Mesh(
          new THREE.BoxGeometry(along ? width * 0.98 : 0.04, 0.012, along ? 0.04 : depth * 0.98),
          dark,
        );
        gap.position.set(along ? 0 : at, height / 2 + 0.002, along ? at : 0);
        group.add(gap);
      }
    }
  }
  group.position.set(def.from[0], def.from[1], def.from[2]);
  return {
    object: group,
    update(part, { alpha }) {
      const { prevPose: was, pose: now } = (part as Slider).mover;
      group.position.set(
        was.position.x + (now.position.x - was.position.x) * alpha,
        was.position.y + (now.position.y - was.position.y) * alpha,
        was.position.z + (now.position.z - was.position.z) * alpha,
      );
    },
  };
}

// --- Gold and the dragon --------------------------------------------------------

function coinView(def: CoinDef): PartView {
  const group = new THREE.Group();
  group.position.set(def.at[0], def.at[1] + 0.3, def.at[2]);
  const material = new THREE.MeshLambertMaterial({ color: GOLD, emissive: 0x7a5200, emissiveIntensity: 0.6 });
  const coin = solid(new THREE.CylinderGeometry(0.17, 0.17, 0.045, 18), material);
  coin.rotation.x = Math.PI / 2;
  group.add(coin);
  let shown = 1;
  const phase = (def.at[0] * 1.7 + def.at[2] * 0.9) % (Math.PI * 2);
  return {
    object: group,
    update(part, { dt, time }) {
      shown = ease(shown, (part as Coin).collected ? 0 : 1, 14, dt);
      group.visible = shown > 0.02;
      group.rotation.y = time * 2.4 + phase;
      group.position.y = def.at[1] + 0.3 + Math.sin(time * 2 + phase) * 0.04 + (1 - shown) * 0.5;
      group.scale.setScalar(Math.max(0.01, shown));
    },
  };
}

function bellView(def: BellDef): PartView {
  const group = new THREE.Group();
  group.position.set(def.at[0], def.at[1], def.at[2]);
  if ((def.look ?? 'bell') === 'bones') {
    const bone = lambert(0xe9e2cf);
    const reach = def.radius ?? 0.4;
    const ring = decal(new THREE.RingGeometry(reach - 0.035, reach, 32), glow(0xe9e2cf, 0.35), 0.013);
    group.add(ring);
    for (let i = 0; i < 6; i++) {
      const angle = i * 2.4;
      const far = reach * (0.2 + 0.1 * (i % 3));
      const piece = solid(new THREE.CapsuleGeometry(0.035, 0.2 + 0.05 * (i % 2), 3, 6), bone, Math.cos(angle) * far, 0.04, Math.sin(angle) * far);
      piece.rotation.set(Math.PI / 2, 0, angle * 1.7);
      group.add(piece);
    }
    const skull = solid(new THREE.IcosahedronGeometry(0.1, 1), bone, 0, 0.1, 0);
    group.add(skull);
    let shake = 0;
    let rings = 0;
    return {
      object: group,
      update(part, { dt, time }) {
        const bell = part as Bell;
        if (bell.rings !== rings) shake = bell.rings > rings ? 1 : 0;
        rings = bell.rings;
        shake = Math.max(0, shake - dt * 2.5);
        skull.position.y = 0.1 + Math.abs(Math.sin(time * 30)) * 0.08 * shake;
      },
    };
  }
  const brass = new THREE.MeshLambertMaterial({ color: 0xf0b94a, emissive: 0x6a4300, emissiveIntensity: 0.7 });
  const stand = solid(new THREE.CylinderGeometry(BELL_POST * 0.6, BELL_POST, 0.95, 10), lambert(0x8a6a45), 0, 0.475);
  const swing = new THREE.Group();
  swing.position.y = 1.0;
  const profile = [
    [0.03, 0.3],
    [0.11, 0.26],
    [0.17, 0.08],
    [0.2, -0.1],
    [0.28, -0.2],
  ].map(([r, h]) => new THREE.Vector2(r, h));
  const body = solid(new THREE.LatheGeometry(profile, 14), brass, 0, 0.12);
  swing.add(body);
  // How near is too near, on the ground: a ball's width out from the post.
  const reach = decal(new THREE.RingGeometry(BELL_POST + 0.1, BELL_POST + 0.14, 28), glow(0xf0b94a, 0.55), 0.013);
  group.add(stand, swing, reach);
  let amount = 0;
  let rings = 0;
  return {
    object: group,
    update(part, { dt, time }) {
      const bell = part as Bell;
      if (bell.rings !== rings) amount = bell.rings > rings ? 1 : 0;
      rings = bell.rings;
      amount = Math.max(0, amount - dt * 1.2);
      swing.rotation.z = Math.sin(time * 22) * 0.5 * amount;
    },
  };
}

function dragonView(def: DragonDef): PartView {
  const group = new THREE.Group();
  group.position.set(def.at[0], def.at[1], def.at[2]);
  group.rotation.y = headingYaw(def.heading ?? 0);
  const hide = lambert(0xa5322e);
  const belly = lambert(0xe0a23f);
  const horn = lambert(0xf0e6cf);

  // Built facing -Z, curled round its gold.
  const body = solid(new THREE.IcosahedronGeometry(1, 1), hide, 0, 0.62, 0.9);
  body.scale.set(1.05, 0.62, 1.45);
  const under = solid(new THREE.IcosahedronGeometry(1, 1), belly, 0, 0.42, 0.9);
  under.scale.set(0.85, 0.42, 1.3);
  const tail = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const size = 0.42 - i * 0.07;
    const piece = solid(new THREE.IcosahedronGeometry(size, 0), hide, 0.85 + i * 0.28, size * 0.9, 1.9 - i * 0.42);
    tail.add(piece);
  }
  const wing = (side: 1 | -1): THREE.Mesh => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(1.5, 0.5);
    shape.lineTo(1.1, -0.1);
    shape.lineTo(1.3, -0.7);
    shape.lineTo(0.7, -0.5);
    shape.lineTo(0.2, -0.9);
    shape.closePath();
    const mesh = solid(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color: 0x7c2422, side: THREE.DoubleSide }), side * 0.5, 1.0, 0.8);
    mesh.rotation.set(-1.15, side > 0 ? 0.25 : Math.PI - 0.25, 0);
    return mesh;
  };
  const wings = [wing(1), wing(-1)];

  // Neck and head hang from one joint, so the head can lie down or rear up.
  const neck = new THREE.Group();
  neck.position.set(0, 0.7, -0.3);
  const throat = solid(new THREE.CylinderGeometry(0.26, 0.4, 1.2, 8), hide, 0, 0, -0.55);
  throat.rotation.x = -Math.PI / 2;
  const head = new THREE.Group();
  head.position.set(0, 0, -1.2);
  const skull = solid(new THREE.BoxGeometry(0.62, 0.42, 0.6), hide);
  const snout = solid(new THREE.BoxGeometry(0.44, 0.28, 0.6), hide, 0, -0.05, -0.55);
  const jaw = solid(new THREE.BoxGeometry(0.4, 0.1, 0.56), belly, 0, -0.24, -0.5);
  const eyeMaterial = glow(0x2a1414);
  const eyes = [-1, 1].map((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), eyeMaterial);
    eye.position.set(side * 0.3, 0.1, -0.2);
    return eye;
  });
  const horns = [-1, 1].map((side) => {
    const spike = solid(new THREE.ConeGeometry(0.07, 0.42, 6), horn, side * 0.2, 0.34, 0.2);
    spike.rotation.x = 0.5;
    return spike;
  });
  head.add(skull, snout, jaw, ...eyes, ...horns);
  neck.add(throat, head);

  // What it sleeps on.
  const gold = lambert(GOLD);
  const heap = solid(new THREE.ConeGeometry(1.5, 0.5, 9), gold, 0.1, 0.25, 0.7);
  // And the rock that is under, down to the ground the course stands over.
  const ledge = solid(new THREE.CylinderGeometry(2.1, 2.5, 0.9, 9), lambert(0x4a3f3a), 0.2, -0.45, 0.7);
  group.add(ledge, heap, under, body, tail, ...wings, neck);

  let raised = 0;
  return {
    object: group,
    update(part, { dt, time }) {
      const dragon = part as Dragon;
      const awake = dragon.on;
      const unrest = dragon.unrest;
      // Asleep its head lies on the gold. A noise lifts it a little; awake, it rears.
      raised = ease(raised, awake ? 1 : unrest > 0 ? 0.35 : 0, 5, dt);
      const breath = Math.sin(time * (awake ? 5 : 1.4));
      neck.rotation.x = -0.42 + raised * 0.95 + breath * (awake ? 0.03 : 0.012);
      head.rotation.x = 0.42 - raised * 0.75;
      jaw.rotation.x = awake ? 0.38 + breath * 0.08 : 0;
      body.scale.y = 0.62 + breath * 0.012;
      eyeMaterial.color.setHex(awake ? 0xffd23a : unrest > 0 ? 0xc47a1e : 0x2a1414);
      wings.forEach((mesh, i) => (mesh.rotation.x = -1.15 + raised * 0.5 + (awake ? Math.sin(time * 3 + i) * 0.05 : 0)));
    },
  };
}

function fireView(def: FireDef): PartView {
  const group = new THREE.Group();
  const [cx, cy, cz] = def.shape.center;
  const half = def.shape.kind === 'box' ? def.shape.halfExtents : ([def.shape.radius, def.shape.radius, def.shape.radius] as const);
  const base = cy - half[1];
  group.position.set(cx, base, cz);
  // Where it burns, always to be seen: scorched ground while it is cold, embers as it heats.
  const scorchMaterial = glow(0x1b0f0c, 0.3);
  const scorch = decal(new THREE.PlaneGeometry(half[0] * 2, half[2] * 2), scorchMaterial, 0.013);
  group.add(scorch);
  const flames: { mesh: THREE.Mesh; phase: number; height: number }[] = [];
  const outer = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85, depthWrite: false });
  const inner = new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.9, depthWrite: false });
  const longX = half[0] >= half[2];
  const span = (longX ? half[0] : half[2]) * 2;
  const across = (longX ? half[2] : half[0]) * 2;
  const count = Math.max(3, Math.round(span / 0.42));
  for (let i = 0; i < count; i++) {
    const at = ((i + 0.5) / count - 0.5) * span;
    const height = 0.9 + ((i * 7) % 5) * 0.09;
    for (const [material, scale] of [[outer, 1], [inner, 0.55]] as const) {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(Math.min(0.3, across * 0.5) * scale, height * scale, 7), material);
      mesh.position.set(longX ? at : 0, (height * scale) / 2, longX ? 0 : at);
      // Cold until the first frame says otherwise: a thumbnail shows the hole as it starts.
      mesh.visible = false;
      group.add(mesh);
      flames.push({ mesh, phase: i * 1.9 + scale, height: height * scale });
    }
  }
  let shown = 0;
  return {
    object: group,
    update(part, { dt, time }) {
      const fire = part as Fire;
      shown = ease(shown, fire.burning ? 1 : 0, 16, dt);
      // Embers: the ground glows hotter as a burst comes nearer.
      const heat = fire.burning ? 1 : fire.heat;
      scorchMaterial.color.setRGB(0.1 + 0.9 * heat, 0.06 + 0.3 * heat, 0.05);
      scorchMaterial.opacity = 0.3 + 0.5 * heat * (fire.burning ? 1 : 0.6 + 0.4 * Math.sin(time * 14));
      for (const { mesh, phase, height } of flames) {
        mesh.visible = shown > 0.03;
        const flicker = 0.8 + 0.25 * Math.sin(time * 13 + phase) + 0.12 * Math.sin(time * 29 + phase * 2);
        mesh.scale.set(shown, shown * flicker, shown);
        mesh.position.y = (height * shown * flicker) / 2;
      }
    },
  };
}

// --- The lines between parts ----------------------------------------------------

const LINK_WIDTH = 0.07;
const LINK_STEP = 0.22;

/** A ribbon along a path on the ground, cut into short pieces so that any length of it can be lit. */
function ribbon(path: readonly XYZ[]): { geometry: THREE.BufferGeometry; pieces: number } {
  const positions: number[] = [];
  let pieces = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 1e-6) continue;
    const sx = (-(b.z - a.z) / length) * LINK_WIDTH;
    const sz = ((b.x - a.x) / length) * LINK_WIDTH;
    const steps = Math.max(1, Math.round(length / LINK_STEP));
    for (let step = 0; step < steps; step++) {
      const p = { x: a.x + ((b.x - a.x) * step) / steps, z: a.z + ((b.z - a.z) * step) / steps };
      const q = { x: a.x + ((b.x - a.x) * (step + 1)) / steps, z: a.z + ((b.z - a.z) * (step + 1)) / steps };
      positions.push(
        p.x - sx, 0, p.z - sz, p.x + sx, 0, p.z + sz, q.x + sx, 0, q.z + sz,
        p.x - sx, 0, p.z - sz, q.x + sx, 0, q.z + sz, q.x - sx, 0, q.z - sz,
      );
      pieces++;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return { geometry, pieces };
}

interface LinkView {
  lit: THREE.Mesh;
  pieces: number;
  owner: number;
  source: number;
}

/**
 * The lines on the ground from each part to the parts that listen to it (SPEC v4 3.2).
 * They are made from the live field the first time it is seen, since only it knows
 * where every part is; the paths never change after that.
 */
function linksView(): { object: THREE.Group; update(field: Field): void } {
  const group = new THREE.Group();
  let links: LinkView[] | null = null;
  const build = (field: Field): LinkView[] => {
    const made: LinkView[] = [];
    field.parts.forEach((part, owner) => {
      const drive = (part as Part & { drive?: Drive | null }).drive;
      if (!drive || (part.def as { unlinked?: boolean }).unlinked) return;
      drive.sources.forEach((source, index) => {
        const y = source.part.anchor.y;
        const path = source.path.map((p) => ({ x: p.x, y, z: p.z }));
        const { geometry, pieces } = ribbon(path);
        if (pieces === 0) return;
        // Red for a line that brings trouble: one to a trap or to fire. A line that
        // holds a trap back is as green as any that opens a gate.
        const trouble = !source.inhibit && (part.kind === 'fire' || (part.def as { trap?: boolean }).trap === true);
        const dim = new THREE.Mesh(geometry, glow(trouble ? TRAP_DIM : LINK_DIM, 0.75));
        const lit = new THREE.Mesh(geometry.clone(), glow(trouble ? TRAP_LIT : LINK_LIT));
        dim.position.y = y + 0.014;
        lit.position.y = y + 0.018;
        dim.renderOrder = 1;
        lit.renderOrder = 2;
        group.add(dim, lit);
        made.push({ lit, pieces, owner, source: index });
      });
    });
    return made;
  };
  return {
    object: group,
    update(field) {
      links ??= build(field);
      for (const link of links) {
        const drive = (field.parts[link.owner] as Part & { drive: Drive }).drive;
        const source = drive.sources[link.source];
        const alone = drive.sources.filter((other) => !other.inhibit).length === 1;
        // A line is lit as far as its signal has run; one of several, as soon as its own end is on.
        const reach = source.inhibit
          ? source.part.on ? 1 : 0
          : drive.active ? 1 : source.part.on ? (alone ? drive.progress : 1) : 0;
        link.lit.geometry.setDrawRange(0, Math.round(reach * link.pieces) * 6);
        link.lit.visible = reach > 0;
      }
    },
  };
}

// --- Putting it together --------------------------------------------------------

/**
 * Builds the picture of a hole's works from its data. Before the first `update` every
 * part is drawn the way the hole starts, which is all a thumbnail needs.
 */
export function buildFieldView(def: FieldDef, bounds?: Bounds): FieldView {
  const group = new THREE.Group();
  const grid = gridView(def);
  if (grid) group.add(grid);
  const views = def.parts.map((part) => registry.get(part.kind)?.(part, def) ?? null);
  for (const view of views) if (view) group.add(view.object);
  const hasLight = def.parts.some((part) => part.kind === 'emitter');
  const beams = hasLight ? beamsView(bounds) : null;
  const links = linksView();
  group.add(links.object);
  if (beams) group.add(beams.object);
  return {
    group,
    update(field, frame) {
      views.forEach((view, i) => view?.update?.(field.parts[i], frame));
      links.update(field);
      beams?.update(field);
    },
  };
}

export function registerBuiltinPartViews(): void {
  registerPartView('plate', plateView);
  registerPartView('gate', gateView);
  registerPartView('stone', stoneView);
  registerPartView('crystal', crystalView);
  registerPartView('emitter', emitterView);
  registerPartView('receiver', receiverView);
  registerPartView('slider', sliderView);
  registerPartView('coin', coinView);
  registerPartView('bell', bellView);
  registerPartView('dragon', dragonView);
  registerPartView('fire', fireView);
}
