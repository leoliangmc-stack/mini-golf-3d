import * as THREE from 'three';
import type { XYZ } from '../core/types';
import { SLAB_THICKNESS, VALVE_HEIGHT, VALVE_POST, type Crumble, type Float, type Valve, type Water } from '../game/field/elements';
import type { Drive, Field, Part } from '../game/field/field';
import { BELL_POST, type Bell, type Coin, type Dragon, type Fire } from '../game/field/hoard';
import { BEAM_HEIGHT, CRYSTAL_RADIUS, Light, POST_RADIUS, type Crystal, type Receiver } from '../game/field/light';
import type { Belt, Dial, Pulse, TimeZone } from '../game/field/machines';
import type { Slider } from '../game/field/slider';
import type { Gate, Plate, Stone } from '../game/field/tomb';
import type {
  BellDef,
  BeltDef,
  CoinDef,
  CrumbleDef,
  CrystalDef,
  DialDef,
  DragonDef,
  EmitterDef,
  FieldDef,
  FireDef,
  FloatDef,
  GateDef,
  PartDef,
  PlateDef,
  PulseDef,
  ReceiverDef,
  SliderDef,
  StoneDef,
  TimeZoneDef,
  ValveDef,
  WaterDef,
} from '../level/field';
import { getSurface } from '../physics/surfaces';
import { pointsView, rotorView, trainView, tunnelView } from './cityViews';

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
  if (look === 'bars' || look === 'door' || look === 'shutter') {
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

// --- Chapter 5: valves, water, rafts and cracked slabs ---------------------------

const VALVE_OPEN = 0x2fbf71;
const VALVE_SHUT = 0xe5484d;

function valveView(def: ValveDef, field: FieldDef): PartView {
  if (def.look === 'lever') return leverView(def, field);
  if (def.look === 'points') return pointsView(def, field);
  const group = new THREE.Group();
  group.position.set(def.at[0], def.at[1], def.at[2]);
  const depth = def.depth ?? 0;
  const pipe = solid(
    new THREE.CylinderGeometry(VALVE_POST * 0.75, VALVE_POST, VALVE_HEIGHT + depth, 12),
    lambert(0x59626d),
    0,
    (VALVE_HEIGHT - depth) / 2,
  );
  // The wheel lies flat on top of the pipe, where it can be seen from above.
  const paint = new THREE.MeshLambertMaterial({ color: def.open ? VALVE_OPEN : VALVE_SHUT });
  const wheel = new THREE.Group();
  wheel.position.y = VALVE_HEIGHT + 0.06;
  const rim = solid(new THREE.TorusGeometry(0.3, 0.05, 8, 20), paint);
  rim.rotation.x = Math.PI / 2;
  wheel.add(rim);
  for (let spoke = 0; spoke < 2; spoke++) {
    const bar = solid(new THREE.BoxGeometry(0.6, 0.05, 0.06), paint);
    bar.rotation.y = (spoke * Math.PI) / 2;
    wheel.add(bar);
  }
  group.add(pipe, wheel);
  let turned = def.open ? 1 : 0;
  return {
    object: group,
    update(part, { dt }) {
      const valve = part as Valve;
      turned = ease(turned, valve.open ? 1 : 0, 6, dt);
      wheel.rotation.y = turned * Math.PI * 1.5;
      paint.color.setHex(valve.open ? VALVE_OPEN : VALVE_SHUT);
    },
  };
}

function waterView(def: WaterDef): PartView {
  const width = def.max[0] - def.min[0];
  const depth = def.max[1] - def.min[1];
  const group = new THREE.Group();
  group.position.set((def.min[0] + def.max[0]) / 2, def.level, (def.min[1] + def.max[1]) / 2);
  const material = new THREE.MeshLambertMaterial({ color: 0x3aa0d8, transparent: true, opacity: 0.72 });
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  surface.rotation.x = -Math.PI / 2;
  surface.receiveShadow = true;
  // The water under the surface, so a low pool is not a sheet hanging in a pit.
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, 3, depth),
    new THREE.MeshBasicMaterial({ color: 0x1f6f9e, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  body.position.y = -1.52;
  group.add(body, surface);
  return {
    object: group,
    update(part, { alpha, time }) {
      const water = part as Water;
      group.position.y = water.prev + (water.level - water.prev) * alpha;
      // Brighter while it is on the move.
      material.opacity = water.busy ? 0.8 + 0.08 * Math.sin(time * 9) : 0.72;
    },
  };
}

function floatView(def: FloatDef, field: FieldDef): PartView {
  const [width, height, depth] = def.size;
  const color = getSurface(def.surface).color;
  const group = new THREE.Group();
  group.add(solid(new THREE.BoxGeometry(width, height, depth), lambert(color)));
  // Planks across the way the ball rolls, and a drum under each corner.
  const dark = lambert(new THREE.Color(color).multiplyScalar(0.7).getHex());
  const along = depth >= width;
  const planks = Math.max(2, Math.round((along ? depth : width) / 0.5));
  for (let i = 1; i < planks; i++) {
    const at = (i / planks - 0.5) * (along ? depth : width);
    const gap = new THREE.Mesh(new THREE.BoxGeometry(along ? width * 0.98 : 0.04, 0.012, along ? 0.04 : depth * 0.98), dark);
    gap.position.set(along ? 0 : at, height / 2 + 0.002, along ? at : 0);
    group.add(gap);
  }
  const drum = lambert(0x3f7fb5);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const barrel = solid(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 10), drum, sx * (width / 2 - 0.3), -height / 2 - 0.05, sz * (depth / 2 - 0.4));
      barrel.rotation.x = Math.PI / 2;
      group.add(barrel);
    }
  }
  const water = field.parts.find((part): part is WaterDef => part.kind === 'water' && part.id === def.water);
  const top = (water?.level ?? 0) + (def.freeboard ?? 0.1);
  group.position.set(def.at[0], top - height / 2, def.at[1]);
  return {
    object: group,
    update(part, { alpha }) {
      const { prevPose: was, pose: now } = (part as Float).mover;
      group.position.y = was.position.y + (now.position.y - was.position.y) * alpha;
    },
  };
}

function crumbleView(def: CrumbleDef): PartView {
  const [width, depth] = def.size;
  const color = getSurface(def.surface ?? 'slab').color;
  const group = new THREE.Group();
  // A hair smaller than it is, so that slabs which overlap show the joins between them.
  const slab = solid(new THREE.BoxGeometry(width - 0.06, SLAB_THICKNESS, depth - 0.06), lambert(color));
  group.add(slab);
  // Cracks across the top: the same every time, but different from slab to slab.
  const noise = (k: number): number => {
    const s = Math.sin((def.at[0] * 12.9898 + def.at[2] * 78.233 + k * 37.719) * 43758.5453);
    return s - Math.floor(s);
  };
  const points: number[] = [];
  const y = SLAB_THICKNESS / 2 + 0.004;
  for (let crack = 0; crack < 3; crack++) {
    let x = (noise(crack) - 0.5) * width * 0.6;
    let z = -depth / 2 + 0.05;
    while (z < depth / 2 - 0.1) {
      const nx = x + (noise(crack * 10 + z) - 0.5) * 0.5;
      const nz = z + 0.18 + noise(crack * 20 + z) * 0.25;
      points.push(x, y, z, Math.max(-width / 2 + 0.05, Math.min(width / 2 - 0.05, nx)), y, Math.min(depth / 2 - 0.05, nz));
      x = Math.max(-width / 2 + 0.05, Math.min(width / 2 - 0.05, nx));
      z = nz;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const cracks = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.35) }));
  group.add(cracks);
  group.position.set(def.at[0], def.at[1] - SLAB_THICKNESS / 2, def.at[2]);
  return {
    object: group,
    update(part, { alpha, time }) {
      const crumble = part as Crumble;
      const { prevPose: was, pose: now } = crumble.mover;
      group.visible = !crumble.gone;
      // It shakes harder the nearer it is to going.
      const shake = crumble.falling >= 0 ? 0 : crumble.strain * 0.025;
      group.position.set(
        was.position.x + (now.position.x - was.position.x) * alpha + Math.sin(time * 61 + def.at[2]) * shake,
        was.position.y + (now.position.y - was.position.y) * alpha,
        was.position.z + (now.position.z - was.position.z) * alpha + Math.sin(time * 53 + def.at[0]) * shake,
      );
      // And tips as it falls.
      group.rotation.x = crumble.falling > 0 ? crumble.falling * 0.012 : 0;
    },
  };
}

// --- Chapter 6: levers, belts, clock switches, time zones and the beat ------------

const BELT_MARK = 0xf2c230;

/**
 * The lever of a conveyor belt (SPEC v6 3.2): the post of a valve with a handle on it
 * that is thrown over to one side or the other, and on top an arrow that shows which
 * way the belt it works is asked to run.
 */
function leverView(def: ValveDef, field: FieldDef): PartView {
  const group = new THREE.Group();
  group.position.set(def.at[0], def.at[1], def.at[2]);
  const depth = def.depth ?? 0;
  const pipe = solid(
    new THREE.CylinderGeometry(VALVE_POST * 0.8, VALVE_POST, VALVE_HEIGHT + depth, 12),
    lambert(0x59626d),
    0,
    (VALVE_HEIGHT - depth) / 2,
  );
  // The belt it works: the first that names it among the signals it needs.
  const belt = field.parts.find((part): part is BeltDef => {
    if (part.kind !== 'belt' || part.when === undefined) return false;
    return typeof part.when === 'string' ? part.when === def.id : (part.when.all ?? []).includes(def.id);
  });
  const heading = belt ? Math.atan2(-belt.velocity[0], -belt.velocity[1]) : 0;
  const paint = new THREE.MeshLambertMaterial({ color: BELT_MARK });
  // The arrow is built pointing along -Z and turned to the way the belt starts out.
  const sign = new THREE.Group();
  sign.position.y = VALVE_HEIGHT + 0.07;
  const plate = solid(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 20), lambert(0x2f3640));
  const shaft = solid(new THREE.BoxGeometry(0.1, 0.03, 0.34), paint, 0, 0.04, 0.07);
  const head = solid(new THREE.ConeGeometry(0.16, 0.24, 3), paint, 0, 0.04, -0.2);
  head.rotation.set(-Math.PI / 2, 0, 0);
  head.scale.z = 0.2;
  sign.add(plate, shaft, head);
  // The handle: a rod with a ball on its end, leaning away from the way the arrow points.
  const handle = new THREE.Group();
  handle.position.y = VALVE_HEIGHT * 0.55;
  const rod = solid(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), lambert(0x2f3640), 0, 0.25, 0);
  const knob = solid(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshLambertMaterial({ color: 0xe5484d }), 0, 0.52, 0);
  handle.add(rod, knob);
  group.add(pipe, sign, handle);
  let thrown = def.open ? 1 : 0;
  const place = (): void => {
    // Thrown, the arrow has gone right round and the handle has gone over.
    sign.rotation.y = heading + thrown * Math.PI;
    handle.rotation.set(0, heading, 0);
    handle.rotateX((0.5 - thrown) * 1.3);
  };
  place();
  return {
    object: group,
    update(part, { dt }) {
      thrown = ease(thrown, (part as Valve).open ? 1 : 0, 10, dt);
      place();
    },
  };
}

/**
 * A conveyor belt (SPEC v6 3.2): a roller at each end and chevrons riding the rubber
 * at the belt's own pace, the way it runs. When it is turned round they slow, stop and
 * set off the other way with it, pointing the new way.
 */
function beltView(def: BeltDef): PartView {
  const group = new THREE.Group();
  const y = def.y ?? 0;
  const width = def.max[0] - def.min[0];
  const depth = def.max[1] - def.min[1];
  group.position.set((def.min[0] + def.max[0]) / 2, y, (def.min[1] + def.max[1]) / 2);
  const [vx, vz] = def.velocity;
  const speed = Math.hypot(vx, vz);
  const alongX = Math.abs(vx) > Math.abs(vz);
  const length = alongX ? width : depth;
  const across = alongX ? depth : width;
  // A frame turned so that the belt, as it starts out, runs along its own -Z.
  const run = new THREE.Group();
  run.rotation.y = Math.atan2(-vx, -vz);
  group.add(run);

  const iron = lambert(0x6f7b86, false);
  for (const end of [-1, 1]) {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, across * 0.98, 10), iron);
    roller.rotation.z = Math.PI / 2;
    roller.position.set(0, -0.05, end * (length / 2 - 0.02));
    run.add(roller);
  }
  // Slats across the rubber, and chevrons on them, all of which travel.
  const slatMaterial = glow(0x59626d);
  const markMaterial = new THREE.MeshBasicMaterial({ color: BELT_MARK, transparent: true, opacity: 0.9, depthWrite: false });
  const chevron = new THREE.Shape();
  chevron.moveTo(-0.3, -0.25);
  chevron.lineTo(0, 0.05);
  chevron.lineTo(0.3, -0.25);
  chevron.lineTo(0.3, -0.05);
  chevron.lineTo(0, 0.25);
  chevron.lineTo(-0.3, -0.05);
  chevron.closePath();
  const chevronGeometry = new THREE.ShapeGeometry(chevron);
  const slatGeometry = new THREE.PlaneGeometry(across * 0.96, 0.05);
  const spacing = 1;
  const rows = Math.max(2, Math.round(length / spacing));
  const pitch = length / rows;
  const lanes = Math.max(1, Math.round(across / 1.1));
  const riders: { mesh: THREE.Mesh; offset: number; mark: boolean }[] = [];
  for (let row = 0; row < rows; row++) {
    const slat = new THREE.Mesh(slatGeometry, slatMaterial);
    slat.rotation.x = -Math.PI / 2;
    slat.position.y = 0.011;
    run.add(slat);
    riders.push({ mesh: slat, offset: row * pitch, mark: false });
    for (let lane = 0; lane < lanes; lane++) {
      const mark = new THREE.Mesh(chevronGeometry, markMaterial);
      mark.position.set(((lane + 0.5) / lanes - 0.5) * across, 0.014, 0);
      mark.scale.setScalar(0.75);
      run.add(mark);
      riders.push({ mesh: mark, offset: (row + 0.5) * pitch, mark: true });
    }
  }
  let travelled = 0;
  const place = (flow: number): void => {
    for (const rider of riders) {
      const along = (((rider.offset + travelled) % length) + length) % length;
      rider.mesh.position.z = length / 2 - along;
      if (!rider.mark) continue;
      // Lying flat, its point along -Z while the belt runs as it started and along +Z once turned.
      rider.mesh.rotation.set(-Math.PI / 2, 0, flow >= 0 ? 0 : Math.PI);
      rider.mesh.visible = along > 0.25 && along < length - 0.25;
    }
    markMaterial.opacity = 0.25 + 0.65 * Math.min(1, Math.abs(flow));
  };
  place(1);
  return {
    object: group,
    update(part, { dt }) {
      const { flow } = part as Belt;
      travelled += flow * speed * dt;
      place(flow);
    },
  };
}

const TIME_SLOW = new THREE.Color(0x3d8bff);
const TIME_USUAL = new THREE.Color(0xf7ecc8);
const TIME_FAST = new THREE.Color(0xff6a2b);

/** The colour of a rate: blue for slow, pale for the hole's own pace, orange for fast. */
function rateColor(rate: number, into: THREE.Color): THREE.Color {
  if (rate <= 1) return into.copy(TIME_SLOW).lerp(TIME_USUAL, Math.max(0, (rate - 0.5) / 0.5));
  return into.copy(TIME_USUAL).lerp(TIME_FAST, Math.min(1, rate - 1));
}

/** How far the hand of a clock face turns for one tick of the clock it shows: once round in four seconds at the usual rate. */
const HAND_TURN = (Math.PI * 2) / 240;

/**
 * A clock switch (SPEC v6 3.5): the post of a valve with a dial on top, a mark for each
 * of its rates, coloured as the rates are, and a hand that points at the one it is set to.
 */
function dialView(def: DialDef): PartView {
  const group = new THREE.Group();
  group.position.set(def.at[0], def.at[1], def.at[2]);
  const rates = def.rates ?? [0.5, 1, 2];
  const start = def.start ?? 1;
  group.add(solid(new THREE.CylinderGeometry(VALVE_POST * 0.8, VALVE_POST, VALVE_HEIGHT, 12), lambert(0x8f6b34), 0, VALVE_HEIGHT / 2));
  const face = new THREE.Group();
  face.position.y = VALVE_HEIGHT + 0.06;
  const rimMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
  face.add(solid(new THREE.CylinderGeometry(0.4, 0.4, 0.07, 24), rimMaterial));
  face.add(solid(new THREE.CylinderGeometry(0.33, 0.33, 0.08, 24), lambert(0xfbf6e6, false)));
  // The marks stand a third of a turn apart, the first at the top (-Z).
  const angle = (position: number): number => (position / rates.length) * Math.PI * 2;
  const scratch = new THREE.Color();
  rates.forEach((rate, i) => {
    const mark = solid(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 12), new THREE.MeshBasicMaterial({ color: rateColor(rate, scratch).getHex() }));
    mark.position.set(-Math.sin(angle(i)) * 0.23, 0, -Math.cos(angle(i)) * 0.23);
    face.add(mark);
  });
  const hand = new THREE.Group();
  hand.add(solid(new THREE.BoxGeometry(0.06, 0.04, 0.3), lambert(0x1d2b3a), 0, 0.06, -0.12));
  face.add(hand);
  group.add(face);
  let shown = start;
  const place = (rate: number): void => {
    hand.rotation.y = angle(shown);
    rateColor(rate, rimMaterial.color);
  };
  place(rates[start]);
  return {
    object: group,
    update(part, { dt }) {
      const dial = part as Dial;
      // The hand only ever goes on round, never back: from the last mark on to the first.
      let target = dial.position;
      while (target < shown - 0.5) target += rates.length;
      shown = ease(shown, target, 12, dt);
      if (Math.abs(shown - target) < 0.002) shown = dial.position;
      place(dial.rate);
    },
  };
}

/**
 * A time zone (SPEC v6 3.5): a tint over the ground it covers, an edge to say where it
 * ends, and clock faces lying on it whose hands turn with the zone's own clock. Its
 * colour is its rate. Since the hands show the very clock the machines keep, they slow
 * and quicken with them, to the tick.
 */
function timeZoneView(def: TimeZoneDef): PartView {
  const group = new THREE.Group();
  const y = def.y ?? 0;
  const width = def.max[0] - def.min[0];
  const depth = def.max[1] - def.min[1];
  group.position.set((def.min[0] + def.max[0]) / 2, y, (def.min[1] + def.max[1]) / 2);
  const tint = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, depthWrite: false });
  const line = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
  group.add(decal(new THREE.PlaneGeometry(width, depth), tint, 0.009));
  const edge = 0.07;
  for (const [w, d, x, z] of [
    [width, edge, 0, -depth / 2 + edge / 2],
    [width, edge, 0, depth / 2 - edge / 2],
    [edge, depth, -width / 2 + edge / 2, 0],
    [edge, depth, width / 2 - edge / 2, 0],
  ]) {
    const side = decal(new THREE.PlaneGeometry(w, d), line, 0.011);
    side.position.x = x;
    side.position.z = z;
    group.add(side);
  }
  // Clock faces in the corners, out of the way of what the machines sweep.
  const hands: THREE.Object3D[] = [];
  const radius = Math.min(0.42, width / 6, depth / 6);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const face = new THREE.Group();
    face.position.set(sx * (width / 2 - radius - 0.2), 0.012, sz * (depth / 2 - radius - 0.2));
    face.add(decal(new THREE.RingGeometry(radius * 0.86, radius, 28), line, 0));
    const hand = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(radius * 0.14, radius * 0.8), line);
    bar.rotation.x = -Math.PI / 2;
    bar.position.z = -radius * 0.36;
    hand.add(bar);
    face.add(hand);
    group.add(face);
    hands.push(hand);
  }
  const place = (rate: number, time: number): void => {
    rateColor(rate, tint.color);
    rateColor(rate, line.color);
    for (const hand of hands) hand.rotation.y = -time * HAND_TURN;
  };
  place(def.rate ?? 1, 0);
  return {
    object: group,
    update(part, { alpha }) {
      const zone = part as TimeZone;
      place(zone.rate, zone.now + zone.rate * alpha);
    },
  };
}

/**
 * The beat (SPEC v6 3.4): a row of lamps over whatever keeps it, one for each beat of
 * its pattern. A lamp for a beat the signal is on stands bright and one for a beat it
 * is off stands dark, and the lamp of the beat the hole is in is the big one. So a gate
 * shows, ahead of time, how long it will stay as it is.
 */
function pulseView(def: PulseDef): PartView {
  const group = new THREE.Group();
  group.position.set(def.at[0], def.at[1] + 1.25, def.at[2]);
  group.rotation.y = headingYaw((def.heading ?? 90) - 90);
  const beats = def.pattern.length;
  const on = glow(0x7dffb0);
  const off = glow(0xff4d6d);
  const lamps = def.pattern.map((open, i) => {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), open ? on : off);
    lamp.position.x = (i - (beats - 1) / 2) * 0.36;
    group.add(lamp);
    return lamp;
  });
  const place = (beat: number): void => lamps.forEach((lamp, i) => lamp.scale.setScalar(i === beat ? 1.9 : 1));
  place(0);
  let shown = 0;
  return {
    object: group,
    update(part) {
      const { beat } = part as Pulse;
      if (beat === shown) return;
      shown = beat;
      place(beat);
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
  registerPartView('valve', valveView);
  registerPartView('water', waterView);
  registerPartView('float', floatView);
  registerPartView('crumble', crumbleView);
  registerPartView('belt', beltView);
  registerPartView('dial', dialView);
  registerPartView('timeZone', timeZoneView);
  registerPartView('pulse', pulseView);
  registerPartView('tunnel', tunnelView);
  registerPartView('train', trainView);
  registerPartView('rotor', rotorView);
}
