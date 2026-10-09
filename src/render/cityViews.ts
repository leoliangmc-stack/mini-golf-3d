import * as THREE from 'three';
import type { Vec3 } from '../core/types';
import { KIOSK_HEIGHT, KIOSK_REACH, TRAIN_SEAT, type Train, type Tunnel } from '../game/field/city';
import { VALVE_HEIGHT, VALVE_POST, type Valve } from '../game/field/elements';
import type { Part } from '../game/field/field';
import { ROTOR_HEIGHT, ROTOR_THICKNESS, type Rotor } from '../game/field/maze';
import type { FieldDef, RotorDef, TrainDef, TunnelDef, TunnelMouthDef, ValveDef } from '../level/field';
import type { MoverDef } from '../level/schema';
import { getSurface } from '../physics/surfaces';
import type { Zone, ZoneDef } from '../physics/zones';
import { numberParam } from '../physics/zones';
import { coasterNeed, coasterTracks, isCoaster, type Track } from '../physics/zones/coaster';
import { DEFAULT_COLOR, DEFAULT_RADIUS } from '../physics/zones/tunnel';

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

interface ZonePicture {
  object: THREE.Object3D;
  update?(zone: Zone, alpha: number): void;
}

const RAD = Math.PI / 180;
const STEEL = 0x4c5663;
const DARK = 0x2a3038;
/** How far below the course the ground of a Chapter 7 world lies: where trestles stand. */
const GROUND_Y = -3.6;

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

/** Rotation about +Y that turns a model built facing +Z to face a compass heading (0 is -Z, 90 is +X). */
const facingYaw = (heading: number): number => Math.atan2(Math.sin(heading * RAD), -Math.cos(heading * RAD));
const ease = (from: number, to: number, rate: number, dt: number): number => from + (to - from) * (1 - Math.exp(-rate * dt));
/** The short way round from one angle to another. */
const turnTo = (from: number, to: number, rate: number, dt: number): number =>
  from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * (1 - Math.exp(-rate * dt));

/** A flat chevron in the XY plane, pointing along +Y. Lay it down to point it along the ground. */
function chevron(): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.3, -0.25);
  shape.lineTo(0, 0.05);
  shape.lineTo(0.3, -0.25);
  shape.lineTo(0.3, -0.05);
  shape.lineTo(0, 0.25);
  shape.lineTo(-0.3, -0.05);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/** A post with a handle on it: the lever of a tunnel mouth, or of a set of points. */
function leverPost(at: Vec3, knob: number): { group: THREE.Group; handle: THREE.Group; top: THREE.Group } {
  const group = new THREE.Group();
  group.position.set(at[0], at[1], at[2]);
  const pipe = solid(new THREE.CylinderGeometry(VALVE_POST * 0.8, VALVE_POST, VALVE_HEIGHT, 12), lambert(0x59626d), 0, VALVE_HEIGHT / 2);
  const handle = new THREE.Group();
  handle.position.y = VALVE_HEIGHT * 0.55;
  handle.add(
    solid(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), lambert(DARK), 0, 0.25, 0),
    solid(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshLambertMaterial({ color: knob }), 0, 0.52, 0),
  );
  const top = new THREE.Group();
  top.position.y = VALVE_HEIGHT + 0.07;
  top.add(solid(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 20), lambert(DARK)));
  group.add(pipe, handle, top);
  return { group, handle, top };
}

/** An arrow lying on a lever's top plate, built pointing along +Z. */
function plateArrow(color: number): THREE.Group {
  const paint = new THREE.MeshLambertMaterial({ color });
  const arrow = new THREE.Group();
  const head = solid(new THREE.ConeGeometry(0.16, 0.24, 3), paint, 0, 0.04, 0.2);
  head.rotation.set(Math.PI / 2, 0, 0);
  head.scale.z = 0.2;
  arrow.add(solid(new THREE.BoxGeometry(0.1, 0.03, 0.34), paint, 0, 0.04, -0.07), head);
  return arrow;
}

// --- Subway: a tunnel mouth that turns ---------------------------------------------

/**
 * A subway line (SPEC v7 3.2): a kiosk at each end with a mouth in it. A mouth that
 * can be turned goes round its kiosk to face the way a ball will come out; chevrons on
 * the ground show that way brightly, the way the next knock will turn it faintly, and
 * any other only just. Its lever carries an arrow that points the same way.
 */
export function tunnelView(def: TunnelDef): PartPicture {
  const group = new THREE.Group();
  const radius = def.radius ?? DEFAULT_RADIUS;
  const color = def.color ?? DEFAULT_COLOR;
  const dark = new THREE.MeshBasicMaterial({ color: 0x120e0b });
  const paint = new THREE.MeshLambertMaterial({ color });
  const arrowGeometry = chevron();
  const ends = [def.a, def.b].map((end: TunnelMouthDef) => {
    const reach = end.reach ?? KIOSK_REACH;
    const kiosk = new THREE.Group();
    kiosk.position.set(end.at[0], end.at[1], end.at[2]);
    kiosk.add(
      solid(new THREE.CylinderGeometry(reach, reach, KIOSK_HEIGHT, 24), lambert(getSurface('kiosk').color, false), 0, KIOSK_HEIGHT / 2),
      solid(new THREE.CylinderGeometry(reach * 1.25, reach * 1.32, 0.12, 24), paint, 0, KIOSK_HEIGHT + 0.06),
      solid(new THREE.ConeGeometry(reach * 1.1, 0.3, 24), lambert(DARK, false), 0, KIOSK_HEIGHT + 0.27),
    );
    // The mouth: an arch on the kiosk's side, on a turntable. Local +Z is the way it faces.
    const turner = new THREE.Group();
    const hollow = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius * 0.8, 0.5, 20, 1, false, Math.PI / 2, Math.PI), dark);
    hollow.rotation.x = Math.PI / 2;
    hollow.position.z = reach - 0.21;
    const frame = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.84, 0.07, 8, 20, Math.PI), paint);
    frame.position.z = reach + 0.05;
    frame.castShadow = true;
    turner.add(hollow, frame);
    kiosk.add(turner);
    // One pair of chevrons for each way it can face.
    const marks = end.facings.map((heading) => {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
      const way = new THREE.Group();
      way.rotation.y = facingYaw(heading);
      for (const out of [0.6, 1.05]) {
        const arrow = new THREE.Mesh(arrowGeometry, material);
        arrow.rotation.x = Math.PI / 2;
        arrow.position.set(0, 0.03, reach + out);
        arrow.scale.setScalar(0.85);
        way.add(arrow);
      }
      kiosk.add(way);
      return material;
    });
    group.add(kiosk);
    let lever: { handle: THREE.Group; pointer: THREE.Group } | null = null;
    if (end.lever && end.facings.length > 1) {
      const post = leverPost(end.lever, color);
      const pointer = plateArrow(color);
      post.top.add(pointer);
      group.add(post.group);
      lever = { handle: post.handle, pointer };
    }
    const yaw = facingYaw(end.facings[end.start ?? 0]);
    turner.rotation.y = yaw;
    if (lever) {
      lever.pointer.rotation.y = yaw;
      lever.handle.rotation.set(0, yaw, 0);
      lever.handle.rotateX(0.55);
    }
    return { end, turner, marks, lever, yaw };
  });
  return {
    object: group,
    update(part, { dt }) {
      const tunnel = part as Tunnel;
      ends.forEach((view, i) => {
        const index = tunnel.index[i];
        const count = view.end.facings.length;
        view.yaw = turnTo(view.yaw, facingYaw(view.end.facings[index]), 12, dt);
        view.turner.rotation.y = view.yaw;
        view.marks.forEach((material, k) => {
          material.opacity = k === index ? 0.9 : count > 1 && k === (index + 1) % count ? 0.32 : 0.1;
        });
        if (!view.lever) return;
        view.lever.pointer.rotation.y = view.yaw;
        view.lever.handle.rotation.set(0, view.yaw, 0);
        view.lever.handle.rotateX(0.55);
      });
    },
  };
}

// --- Railway: points, tracks and a train --------------------------------------------

type WhenLike = string | { all?: readonly string[]; none?: readonly string[] } | undefined;
const names = (when: WhenLike, id: string): boolean =>
  when !== undefined && (typeof when === 'string' ? when === id : (when.all ?? []).includes(id));

/**
 * The lever of a set of points (SPEC v7 3.3): a post with a handle that is thrown one
 * way or the other, and a lamp on top in the colour of the line the points are set for.
 */
export function pointsView(def: ValveDef, field: FieldDef): PartPicture {
  // The train whose points these are, and its two lines: the one this lever sets, and the one it stands for otherwise.
  const train = field.parts.find((part): part is TrainDef => part.kind === 'train' && part.lines.some((line) => names(line.when, def.id)));
  const thrown = train?.lines.find((line) => names(line.when, def.id))?.color ?? 0xffb020;
  const idle = train?.lines.find((line) => line.when === undefined)?.color ?? 0x3f8fe0;
  const post = leverPost(def.at, 0xe5484d);
  const lampMaterial = new THREE.MeshBasicMaterial({ color: def.open ? thrown : idle });
  post.top.add(solid(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 20), lampMaterial, 0, 0.05));
  let lean = def.open ? 1 : 0;
  const place = (): void => {
    post.handle.rotation.set(0, 0, 0);
    post.handle.rotateZ((0.5 - lean) * 1.3);
  };
  place();
  return {
    object: post.group,
    update(part, { dt }) {
      const open = (part as Valve).open;
      lean = ease(lean, open ? 1 : 0, 10, dt);
      lampMaterial.color.setHex(open ? thrown : idle);
      place();
    },
  };
}

/** A stretch of track from one point to another: a bed, two rails and sleepers, with trestles under it. */
function trackStretch(a: THREE.Vector3, b: THREE.Vector3, into: THREE.Group, bed: THREE.Material, rail: THREE.Material, tie: THREE.Material): void {
  const length = a.distanceTo(b);
  if (length < 1e-6) return;
  const stretch = new THREE.Group();
  stretch.position.copy(a).add(b).multiplyScalar(0.5);
  stretch.lookAt(b);
  stretch.add(solid(new THREE.BoxGeometry(0.62, 0.06, length + 0.3), bed, 0, -0.05, 0));
  for (const side of [-1, 1]) stretch.add(solid(new THREE.BoxGeometry(0.05, 0.05, length + 0.3), rail, side * 0.2, 0.01, 0));
  const ties = Math.max(1, Math.round(length / 0.45));
  for (let i = 0; i < ties; i++) stretch.add(solid(new THREE.BoxGeometry(0.56, 0.035, 0.1), tie, 0, -0.012, ((i + 0.5) / ties - 0.5) * length));
  into.add(stretch);
  const posts = Math.max(1, Math.round(length / 2.6));
  for (let i = 0; i < posts; i++) {
    const at = a.clone().lerp(b, (i + 0.5) / posts);
    const height = at.y - GROUND_Y - 0.08;
    into.add(solid(new THREE.CylinderGeometry(0.09, 0.13, height, 6), bed, at.x, GROUND_Y + height / 2, at.z));
  }
}

/**
 * A train (SPEC v7 3.3): its track to each station, a ring on the ground where a ball
 * boards, in the colour of the station the points are set for, a ring of each
 * station's own colour where a ball is set down, and an open wagon that carries the
 * ball in plain sight.
 */
export function trainView(def: TrainDef): PartPicture {
  const group = new THREE.Group();
  const bed = lambert(0x5b5148);
  const rail = lambert(0xb9c0c8);
  const tie = lambert(0x7a5a3c);
  const home = new THREE.Vector3(...def.home);
  const colors = def.lines.map((line) => line.color ?? 0x3f8fe0);
  def.lines.forEach((line, i) => {
    const points = [home, ...(line.via ?? []).map((p) => new THREE.Vector3(...p)), new THREE.Vector3(...line.stop)];
    for (let k = 1; k < points.length; k++) trackStretch(points[k - 1], points[k], group, bed, rail, tie);
    // The buffer at the end of the line, and the ring where the ball is set down.
    const last = points[points.length - 1];
    const before = points[points.length - 2];
    const along = last.clone().sub(before).setY(0).normalize();
    const buffer = solid(new THREE.BoxGeometry(0.7, 0.3, 0.12), lambert(colors[i]), last.x + along.x * 0.75, last.y + 0.12, last.z + along.z * 0.75);
    buffer.rotation.y = Math.atan2(along.x, along.z);
    const ring = decal(new THREE.RingGeometry(0.34, 0.46, 32), glow(colors[i], 0.9), 0.016);
    ring.position.set(line.drop[0], line.drop[1] + 0.016, line.drop[2]);
    const sign = solid(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), lambert(STEEL), line.drop[0] + along.x * 0.7, line.drop[1] + 0.55, line.drop[2] + along.z * 0.7);
    const disc = solid(new THREE.SphereGeometry(0.16, 12, 8), lambert(colors[i], false), line.drop[0] + along.x * 0.7, line.drop[1] + 1.2, line.drop[2] + along.z * 0.7);
    group.add(buffer, ring, sign, disc);
  });

  // The platform: a ring a ball boards in, and chevrons toward the wagon.
  const radius = def.radius ?? 0.5;
  const platformMaterial = glow(colors[0], 0.95);
  const platform = decal(new THREE.RingGeometry(radius * 0.72, radius, 36), platformMaterial, 0.016);
  platform.position.set(def.board[0], def.board[1] + 0.016, def.board[2]);
  const pad = decal(new THREE.CircleGeometry(radius * 0.72, 30), glow(0xffffff, 0.18), 0.014);
  pad.position.set(def.board[0], def.board[1] + 0.014, def.board[2]);
  const toward = Math.atan2(def.home[0] - def.board[0], def.home[2] - def.board[2]);
  const pointerMaterial = glow(colors[0], 0.95);
  const pointer = new THREE.Mesh(chevron(), pointerMaterial);
  pointer.rotation.set(Math.PI / 2, 0, 0);
  const pointerTurn = new THREE.Group();
  pointerTurn.position.set(def.board[0], def.board[1] + 0.03, def.board[2]);
  pointerTurn.rotation.y = toward;
  pointer.scale.setScalar(0.7);
  pointerTurn.add(pointer);
  group.add(platform, pad, pointerTurn);

  // The wagon: open, so the ball can be seen riding in it. Built facing +Z.
  const wagon = new THREE.Group();
  const body = lambert(0xd9433f);
  const trim = new THREE.MeshLambertMaterial({ color: colors[0] });
  wagon.add(
    solid(new THREE.BoxGeometry(0.66, 0.12, 0.95), lambert(DARK), 0, TRAIN_SEAT - 0.06, 0),
    solid(new THREE.BoxGeometry(0.06, 0.22, 0.95), body, -0.33, TRAIN_SEAT + 0.1, 0),
    solid(new THREE.BoxGeometry(0.06, 0.22, 0.95), body, 0.33, TRAIN_SEAT + 0.1, 0),
    solid(new THREE.BoxGeometry(0.72, 0.22, 0.06), body, 0, TRAIN_SEAT + 0.1, 0.475),
    solid(new THREE.BoxGeometry(0.72, 0.22, 0.06), body, 0, TRAIN_SEAT + 0.1, -0.475),
    // A stripe along each side in the colour of the line it is set for. The top stays open.
    solid(new THREE.BoxGeometry(0.03, 0.08, 0.97), trim, -0.365, TRAIN_SEAT + 0.12, 0),
    solid(new THREE.BoxGeometry(0.03, 0.08, 0.97), trim, 0.365, TRAIN_SEAT + 0.12, 0),
  );
  for (const x of [-0.26, 0.26]) {
    for (const z of [-0.3, 0.3]) {
      const wheel = solid(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12), lambert(STEEL), x, 0.13, z);
      wheel.rotation.z = Math.PI / 2;
      wagon.add(wheel);
    }
  }
  wagon.position.copy(home);
  const first = def.lines.find((line) => line.when === undefined) ?? def.lines[0];
  const start = first.via?.[0] ?? first.stop;
  wagon.rotation.y = Math.atan2(start[0] - def.home[0], start[2] - def.home[2]);
  group.add(wagon);

  return {
    object: group,
    update(part, { alpha }) {
      const train = part as Train;
      const { prev: a, position: b } = train;
      wagon.position.set(a.x + (b.x - a.x) * alpha, a.y + (b.y - a.y) * alpha, a.z + (b.z - a.z) * alpha);
      wagon.rotation.y = Math.atan2(train.heading.x, train.heading.z);
      const color = colors[train.stage === 'home' ? train.line : train.running];
      platformMaterial.color.setHex(color);
      pointerMaterial.color.setHex(color);
      trim.color.setHex(color);
      platformMaterial.opacity = train.stage === 'home' ? 0.95 : 0.3;
      pointerMaterial.opacity = train.stage === 'home' ? 0.95 : 0.3;
    },
  };
}

/** A train that crosses the course (SPEC v7 3.3): the moving part's own box, with a roof, windows and a stripe. */
export function trainLook(def: MoverDef, body: THREE.Mesh): THREE.Group {
  const [width, height, depth] = def.size;
  const group = new THREE.Group().add(body);
  const roof = solid(new THREE.BoxGeometry(width * 0.98, height * 0.14, depth * 0.86), lambert(DARK), 0, height / 2 + height * 0.07, 0);
  const stripe = solid(new THREE.BoxGeometry(width * 1.004, height * 0.12, depth * 1.02), lambert(0xf2c230), 0, -height * 0.22, 0);
  const windows = solid(new THREE.BoxGeometry(width * 0.9, height * 0.26, depth * 1.03), lambert(0x1c2733), 0, height * 0.16, 0);
  group.add(roof, stripe, windows);
  for (const end of [-1, 1]) {
    const lamp = solid(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }), end * (width / 2 + 0.01), -height * 0.05, 0);
    group.add(lamp);
  }
  return group;
}

// --- Carnival: a roller coaster ----------------------------------------------------

/** One run of track as a tube through its points, with posts down to the ground under the low stretches of it. */
function coasterRun(way: Track, from: number, color: number, into: THREE.Group, loops: readonly Vec3[]): void {
  const points = way.points.slice(from).map((p) => new THREE.Vector3(p.x, p.y + 0.02, p.z));
  if (points.length < 2) return;
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 3, 0.07, 8, false), lambert(color, false));
  tube.castShadow = true;
  into.add(tube);
  const steel = lambert(STEEL);
  const inLoop = (index: number): boolean => loops.some(([first, last]) => index > first && index < last);
  for (let i = from; i < way.points.length; i += 5) {
    if (inLoop(i)) continue;
    const p = way.points[i];
    const height = p.y - GROUND_Y - 0.06;
    into.add(solid(new THREE.CylinderGeometry(0.05, 0.08, height, 6), steel, p.x, GROUND_Y + height / 2, p.z));
  }
  // A loop stands on two posts of its own, one under each of its sides.
  for (const [first, last] of loops) {
    if (first < from) continue;
    for (const index of [Math.round(first + (last - first) / 4), Math.round(first + ((last - first) * 3) / 4)]) {
      const side = way.points[index];
      const height = side.y - GROUND_Y - 0.06;
      into.add(solid(new THREE.CylinderGeometry(0.06, 0.09, height, 6), steel, side.x, GROUND_Y + height / 2, side.z));
    }
  }
}

/** How fast the gauge at an entry reads at the end of its scale, in m/s: a full-power stroke. */
const GAUGE_FULL = 18;
/** Half the sweep of the gauge's scale, in radians. */
const GAUGE_SWEEP = Math.PI * 0.75;
const gaugeAngle = (speed: number): number => (Math.min(1, Math.max(0, speed / GAUGE_FULL)) * 2 - 1) * GAUGE_SWEEP;

/**
 * A roller coaster (SPEC v7 3.4): the track, a gate over the entry, and beside it a
 * gauge. The gauge's scale is red up to the speed a ball has to come in at and green
 * from there on, and its needle swings to the speed the last ball did come in at.
 * Nothing is drawn on the power bar: how hard to strike is for the player to judge.
 */
export function coasterView(def: ZoneDef): ZonePicture {
  const group = new THREE.Group();
  const tracks = coasterTracks(def);
  const color = numberParam(def, 'color', 0xe5484d);
  coasterRun(tracks.main, 0, color, group, tracks.loops);
  if (tracks.high) coasterRun(tracks.high, tracks.mainPoints - 1, 0x2fbf71, group, []);
  if (tracks.low) coasterRun(tracks.low, tracks.mainPoints - 1, 0x8f9aa3, group, []);

  const [a, b] = tracks.main.points;
  const yaw = Math.atan2(b.x - a.x, b.z - a.z);
  // The entry: an arch to roll in under, and chevrons into it.
  const entry = new THREE.Group();
  entry.position.set(a.x, a.y, a.z);
  entry.rotation.y = yaw;
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.06, 8, 20, Math.PI), lambert(color, false));
  arch.castShadow = true;
  entry.add(arch);
  const marks = glow(color, 0.85);
  for (const back of [0.55, 1]) {
    const mark = new THREE.Mesh(chevron(), marks);
    mark.rotation.x = Math.PI / 2;
    mark.position.set(0, 0.03, -back);
    mark.scale.setScalar(0.8);
    entry.add(mark);
  }
  // The gauge, on a post to one side, leaning back so it reads from above.
  const need = coasterNeed(def);
  const gauge = new THREE.Group();
  gauge.position.set(-0.95, 0, -0.2);
  gauge.add(solid(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 8), lambert(STEEL), 0, 0.45, 0));
  const dial = new THREE.Group();
  dial.position.y = 1.05;
  // Facing back toward a ball on its way in, and leaning back.
  dial.rotation.set(0.9, Math.PI, 0);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshBasicMaterial({ color: 0xf7f2e6, side: THREE.DoubleSide }));
  const mid = Math.PI / 2;
  const split = gaugeAngle(need);
  // Angles on the dial run clockwise from its left end, so a faster ball reads further right.
  const arc = (from: number, to: number, paint: number): THREE.Mesh => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 32, 1, mid - to, to - from), new THREE.MeshBasicMaterial({ color: paint, side: THREE.DoubleSide }));
    ring.position.z = 0.004;
    return ring;
  };
  const needle = new THREE.Group();
  needle.position.z = 0.01;
  const hand = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.36), new THREE.MeshBasicMaterial({ color: DARK, side: THREE.DoubleSide }));
  hand.position.y = 0.18;
  needle.add(hand, new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), new THREE.MeshBasicMaterial({ color: DARK, side: THREE.DoubleSide })));
  needle.rotation.z = -gaugeAngle(0);
  dial.add(face, arc(-GAUGE_SWEEP, split, 0xe5484d), arc(split, GAUGE_SWEEP, 0x2fbf71), needle);
  gauge.add(dial);
  entry.add(gauge);
  group.add(entry);

  let shown = 0;
  let last = performance.now();
  return {
    object: group,
    update(zone) {
      if (!isCoaster(zone)) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      shown = ease(shown, zone.gauge.last ?? 0, 8, dt);
      needle.rotation.z = -gaugeAngle(shown);
    },
  };
}

// --- Maze: a group of walls on a pivot ----------------------------------------------

const ROTOR_READY = 0xffffff;
const ROTOR_SPENT = 0x8f9aa3;
const ROTOR_BLOCKED = 0xe5484d;

/**
 * A group of walls the player can turn (SPEC v7 3.5): bright arms on a hub, and on the
 * ground the circle they sweep, with arrows going the way a tap will turn them. While
 * a tap would work the circle is white and beats gently. It is grey when the hole's
 * turns are used up, and red while a ball lies inside it.
 */
export function rotorView(def: RotorDef): PartPicture {
  const group = new THREE.Group();
  group.position.set(def.at[0], def.at[1], def.at[2]);
  const height = def.height ?? ROTOR_HEIGHT;
  const thickness = def.thickness ?? ROTOR_THICKNESS;
  const paint = new THREE.MeshLambertMaterial({ color: getSurface(def.surface ?? 'rotor').color, emissive: 0xff8a00, emissiveIntensity: 0.25 });
  const spinner = new THREE.Group();
  for (const heading of def.arms) {
    const arm = new THREE.Group();
    arm.rotation.y = facingYaw(heading);
    arm.add(solid(new THREE.BoxGeometry(thickness, height, def.length + thickness / 2), paint, 0, height / 2, (def.length - thickness / 2) / 2));
    spinner.add(arm);
  }
  spinner.add(solid(new THREE.CylinderGeometry(thickness * 0.9, thickness * 0.9, height + 0.1, 16), lambert(DARK, false), 0, (height + 0.1) / 2));
  const cap = solid(new THREE.CylinderGeometry(thickness * 0.55, thickness * 0.55, 0.05, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, height + 0.125);
  spinner.add(cap);
  // What the arms sweep, and which way a tap sends them.
  const ringMaterial = glow(ROTOR_READY, 0.5);
  const ring = decal(new THREE.RingGeometry(def.length - 0.05, def.length + 0.02, 64), ringMaterial, 0.015);
  const heads = new THREE.Group();
  const point = new THREE.Shape();
  point.moveTo(-0.17, -0.16);
  point.lineTo(0, 0.2);
  point.lineTo(0.17, -0.16);
  point.closePath();
  const headGeometry = new THREE.ShapeGeometry(point);
  for (let i = 0; i < 4; i++) {
    // Seen from above, clockwise is the way compass headings grow: an arrowhead at
    // heading h on the circle points along heading h + 90.
    const at = i * 90 + 45;
    const holder = new THREE.Group();
    holder.position.set(Math.sin(at * RAD) * def.length, 0.02, -Math.cos(at * RAD) * def.length);
    holder.rotation.y = facingYaw(at + 90);
    const head = new THREE.Mesh(headGeometry, ringMaterial);
    head.rotation.x = Math.PI / 2;
    holder.add(head);
    heads.add(holder);
  }
  group.add(spinner, ring, heads);
  const quarterYaw = (quarter: number): number => -quarter * (Math.PI / 2);
  spinner.rotation.y = quarterYaw(def.start ?? 0);
  return {
    object: group,
    update(part, { time }) {
      const rotor = part as Rotor;
      // From where it stood to where it stands, easing out.
      const swing = rotor.swing;
      const eased = 1 - (1 - swing) * (1 - swing);
      spinner.rotation.y = quarterYaw(rotor.quarter - 1 + eased);
      const state = rotor.state;
      const beat = 0.5 + 0.5 * Math.sin(time * 4);
      ringMaterial.color.setHex(state === 'ready' ? ROTOR_READY : state === 'blocked' ? ROTOR_BLOCKED : ROTOR_SPENT);
      ringMaterial.opacity = state === 'ready' ? 0.45 + 0.4 * beat : state === 'blocked' ? 0.7 : 0.25;
      paint.emissiveIntensity = state === 'ready' ? 0.2 + 0.25 * beat : 0.05;
      heads.visible = state !== 'spent';
    },
  };
}
