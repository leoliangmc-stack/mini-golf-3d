import * as THREE from 'three';
import type { Zone, ZoneDef } from '../physics/zones';
import { numberParam, vectorParam } from '../physics/zones';
import { headingVector, tunnelColor, tunnelEnds, tunnelRadius } from '../physics/zones/tunnel';

/** What the player sees of a zone. */
export interface ZoneView {
  object: THREE.Object3D;
  /** Called every frame with the live zone, by views that show its state. */
  update?(zone: Zone): void;
}

/** Builds the view of a zone. Zones without a registered view are invisible. */
export type ZoneViewBuilder = (def: ZoneDef) => ZoneView;

const registry = new Map<string, ZoneViewBuilder>();

export function registerZoneView(type: string, build: ZoneViewBuilder): void {
  registry.set(type, build);
}

export function buildZoneView(def: ZoneDef): ZoneView | null {
  return registry.get(def.type)?.(def) ?? null;
}

const UP = new THREE.Vector3(0, 1, 0);

/** A flat chevron in the XY plane, pointing along +Y. Lay it down to point it along the ground. */
function chevronGeometry(): THREE.ShapeGeometry {
  const chevron = new THREE.Shape();
  chevron.moveTo(-0.3, -0.25);
  chevron.lineTo(0, 0.05);
  chevron.lineTo(0.3, -0.25);
  chevron.lineTo(0.3, -0.05);
  chevron.lineTo(0, 0.25);
  chevron.lineTo(-0.3, -0.05);
  chevron.closePath();
  return new THREE.ShapeGeometry(chevron);
}

/** A cannon: a barrel from the mouth on the ground up to the point the ball is fired from. */
function launcherView(def: ZoneDef): ZoneView {
  const group = new THREE.Group();
  const mouth = new THREE.Vector3(...def.shape.center);
  const exit = new THREE.Vector3(...vectorParam(def, 'exit'));
  const direction = new THREE.Vector3(...vectorParam(def, 'direction')).normalize();
  const radius = def.shape.kind === 'sphere' ? def.shape.radius : 0.4;
  const iron = new THREE.MeshLambertMaterial({ color: 0x343a44, flatShading: true });

  // The breech swallows the ball; it is exactly as big as the zone.
  const breech = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 10), iron);
  breech.position.copy(mouth);

  const barrelLength = exit.distanceTo(mouth) + 0.5;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.8, barrelLength, 14), iron);
  barrel.position.copy(mouth).addScaledVector(direction, barrelLength / 2);
  barrel.quaternion.setFromUnitVectors(UP, direction);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.66, 0.05, 8, 18),
    new THREE.MeshLambertMaterial({ color: 0xd9a441 }),
  );
  rim.position.copy(mouth).addScaledVector(direction, barrelLength);
  rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);

  for (const mesh of [breech, barrel, rim]) {
    mesh.castShadow = true;
    group.add(mesh);
  }
  return { object: group };
}

const RED = 0xe5484d;
const BLUE = 0x3b82f6;

/** Rings on the ground out to the edge of the field: red pulls, blue pushes. */
function magnetView(def: ZoneDef): ZoneView {
  const group = new THREE.Group();
  const reach = def.shape.kind === 'sphere' ? def.shape.radius : 1;
  const attracts = numberParam(def, 'strength') > 0;
  const material = new THREE.MeshBasicMaterial({
    color: attracts ? RED : BLUE,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (const share of [1, 0.72, 0.44]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(reach * share - 0.05, reach * share, 48), material);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
  }
  group.position.set(def.shape.center[0], def.shape.center[1] + 0.02, def.shape.center[2]);
  return { object: group };
}

/** A tinted volume with arrows on its floor showing which way things fall inside it. */
function gravityView(def: ZoneDef): ZoneView {
  const group = new THREE.Group();
  if (def.shape.kind !== 'box') return { object: group };
  const [gx, gy, gz] = vectorParam(def, 'gravity');
  const sideways = Math.hypot(gx, gz);
  // Pink and cyan for the two sideways pulls, green for "lighter than normal".
  const color = sideways < 0.5 ? 0x5dff9b : gx > 0 || (gx === 0 && gz > 0) ? 0xff4fa3 : 0x37d6ff;
  const [hx, hy, hz] = def.shape.halfExtents;

  const volume = new THREE.Mesh(
    new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.13, depthWrite: false }),
  );
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(volume.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }),
  );
  group.add(volume, edges);

  const arrowMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const arrowGeometry = chevronGeometry();
  // Arrows lie on the course floor (y = 0 in the world), wherever the box is centred.
  const floorY = 0.03 - def.shape.center[1];
  const heading = sideways < 0.5 ? null : Math.atan2(gx, gz);
  for (let x = -hx + 0.75; x < hx; x += 1.5) {
    for (let z = -hz + 0.75; z < hz; z += 1.5) {
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
      if (heading === null) {
        // Lighter gravity: chevrons stand upright, pointing up or down with the pull.
        arrow.position.set(x, floorY + 0.6, z);
        arrow.rotation.z = gy > 0 ? 0 : Math.PI;
      } else {
        // Lay the chevron flat (its +Y becomes +Z), then turn it to face the pull.
        arrow.position.set(x, floorY, z);
        arrow.rotation.set(Math.PI / 2, heading, 0, 'YXZ');
      }
      group.add(arrow);
    }
  }
  group.position.set(...def.shape.center);
  return { object: group };
}

/**
 * Both mouths of a tunnel: a dark hollow with a frame in the pair's colour, so the
 * player can tell which two belong together, and chevrons on the ground pointing the
 * way a ball comes out.
 */
function tunnelView(def: ZoneDef): ZoneView {
  const group = new THREE.Group();
  const radius = tunnelRadius(def);
  const color = tunnelColor(def);
  const dark = new THREE.MeshBasicMaterial({ color: 0x120e0b });
  const frameMaterial = new THREE.MeshLambertMaterial({ color });
  const arrowMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const arrowGeometry = chevronGeometry();

  for (const end of tunnelEnds(def)) {
    const dir = headingVector(end.facing);
    // Local +Z is the way the mouth faces.
    const mouth = new THREE.Group();
    mouth.position.set(end.at[0], end.at[1], end.at[2]);
    mouth.rotation.y = Math.atan2(dir.x, dir.z);

    // An arch reaching back into whatever the mouth is set in.
    const hollow = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.8, radius * 0.8, 0.5, 20, 1, false, Math.PI / 2, Math.PI),
      dark,
    );
    hollow.rotation.x = Math.PI / 2;
    hollow.position.z = -0.21;
    const frame = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.84, 0.07, 8, 20, Math.PI), frameMaterial);
    frame.position.z = 0.05;
    frame.castShadow = true;
    mouth.add(hollow, frame);

    for (const out of [0.6, 1.05]) {
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
      arrow.rotation.x = Math.PI / 2;
      arrow.position.set(0, 0.03, out);
      arrow.scale.setScalar(0.85);
      mouth.add(arrow);
    }
    group.add(mouth);
  }
  return { object: group };
}

const CLOCK_GREEN = 0x2fbf71;
const CLOCK_SPENT = 0x9aa3ad;

/** A clock face on the ground with a small one floating over it. Both go grey once it has been used. */
function timeBonusView(def: ZoneDef): ZoneView {
  const group = new THREE.Group();
  const radius = def.shape.kind === 'sphere' ? def.shape.radius : Math.min(def.shape.halfExtents[0], def.shape.halfExtents[2]);
  const accent = new THREE.MeshBasicMaterial({ color: CLOCK_GREEN });
  const face = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false });
  const ink = new THREE.MeshBasicMaterial({ color: 0x1d2b3a });
  const flatOn = (mesh: THREE.Mesh, y: number): THREE.Mesh => {
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    return mesh;
  };

  const dial = flatOn(new THREE.Mesh(new THREE.CircleGeometry(radius * 0.86, 32), face), 0.02);
  const rim = flatOn(new THREE.Mesh(new THREE.RingGeometry(radius * 0.86, radius, 32), accent), 0.022);
  const hands = new THREE.Group();
  const minute = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, radius * 0.62), ink);
  minute.position.set(0, 0.03, -radius * 0.31);
  const hour = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.42, 0.01, 0.06), ink);
  hour.position.set(radius * 0.21, 0.03, 0);
  hands.add(minute, hour);

  // Something upright as well, so the clock reads from a low camera.
  const floating = new THREE.Group();
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 20), accent);
  floating.add(orb, band);
  floating.position.y = 0.75;

  group.add(dial, rim, hands, floating);
  group.position.set(def.shape.center[0], def.shape.center[1], def.shape.center[2]);

  let spent: boolean | null = null;
  return {
    object: group,
    update(zone) {
      const now = zone.spent ?? false;
      if (now !== spent) {
        spent = now;
        accent.color.setHex(now ? CLOCK_SPENT : CLOCK_GREEN);
        face.opacity = now ? 0.45 : 0.92;
        floating.visible = !now;
      }
      if (!now) {
        const t = performance.now() / 1000;
        floating.position.y = 0.75 + 0.08 * Math.sin(t * 2.4);
        floating.rotation.y = t * 1.6;
      }
    },
  };
}

const GROW_GREEN = 0x2fbf71;
const SHRINK_PURPLE = 0x9b5de5;
const SPLIT_CYAN = 0x18b6d9;

/**
 * A pad (SPEC v3 2.2, 2.4): a disc on the ground with a mark on it, and a ball above it
 * acting out what the pad does. The three are told apart by colour, by mark and by motion.
 */
function padView(def: ZoneDef, color: number, kind: 'grow' | 'shrink' | 'split'): ZoneView {
  const group = new THREE.Group();
  const radius = def.shape.kind === 'sphere' ? def.shape.radius : 0.45;
  const flatOn = (mesh: THREE.Mesh, y: number): THREE.Mesh => {
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    return mesh;
  };
  const fill = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, depthWrite: false });
  const solid = new THREE.MeshBasicMaterial({ color });
  const ink = new THREE.MeshBasicMaterial({ color: 0xffffff });
  group.add(
    flatOn(new THREE.Mesh(new THREE.CircleGeometry(radius * 0.9, 32), fill), 0.012),
    flatOn(new THREE.Mesh(new THREE.RingGeometry(radius * 0.9, radius, 32), solid), 0.014),
  );

  // The mark: plus for bigger, minus for smaller, a fork for two.
  const bar = (length: number, turn: number, x = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, 0.01, radius * 0.16), ink);
    mesh.position.set(x, 0.02, z);
    mesh.rotation.y = turn;
    return mesh;
  };
  if (kind === 'split') {
    group.add(bar(radius * 0.7, 1.1, -radius * 0.17, 0), bar(radius * 0.7, -1.1, radius * 0.17, 0));
  } else {
    group.add(bar(radius * 0.9, 0));
    if (kind === 'grow') group.add(bar(radius * 0.9, Math.PI / 2));
  }

  const skin = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const balls = [0, 1].map(() => new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), skin));
  balls[1].visible = kind === 'split';
  const floating = new THREE.Group();
  floating.add(...balls);
  floating.position.y = 0.8;
  group.add(floating);
  group.position.set(def.shape.center[0], def.shape.center[1] - 0.1, def.shape.center[2]);

  return {
    object: group,
    update() {
      // A loop of a second and a half: grow, shrink, or come apart, then start over.
      const t = (performance.now() / 1500) % 1;
      const ease = t * t * (3 - 2 * t);
      if (kind === 'split') {
        balls[0].position.x = -0.24 * ease;
        balls[1].position.x = 0.24 * ease;
      } else {
        balls[0].scale.setScalar(kind === 'grow' ? 0.6 + 1.1 * ease : 1.7 - 1.1 * ease);
      }
      floating.rotation.y = performance.now() / 900;
    },
  };
}

// --- Chapter 5: water and wind ---

const WATER_BLUE = 0x4fc3e8;

/** Seconds since the page opened. Pictures of water and wind keep their own time; the game does not see it. */
const now = (): number => performance.now() / 1000;

/**
 * Moving water: a tint over the ground it covers, and chevrons drifting along it at
 * the water's own pace, so which way it runs and how fast can be read at a glance.
 */
function currentView(def: ZoneDef): ZoneView {
  const group = new THREE.Group();
  if (def.shape.kind !== 'box') return { object: group };
  const [cx, cy, cz] = def.shape.center;
  const [hx, hy, hz] = def.shape.halfExtents;
  const [vx, , vz] = vectorParam(def, 'velocity');
  const speed = Math.hypot(vx, vz);
  const ground = cy - hy + 0.1;
  group.position.set(cx, ground, cz);

  const tint = new THREE.Mesh(
    new THREE.PlaneGeometry(hx * 2, hz * 2),
    new THREE.MeshBasicMaterial({ color: WATER_BLUE, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  tint.rotation.x = -Math.PI / 2;
  tint.position.y = 0.011;
  group.add(tint);
  if (speed < 1e-6) return { object: group };

  // A frame turned so that the water runs along its own -Z.
  const flow = new THREE.Group();
  flow.rotation.y = Math.atan2(-vx, -vz);
  group.add(flow);
  const alongX = Math.abs(vx) > Math.abs(vz);
  const halfAcross = alongX ? hz : hx;
  const halfAlong = alongX ? hx : hz;
  const spacing = 1.3;
  const lanes = Math.max(1, Math.round((halfAcross * 2) / 1.2));
  const rows = Math.max(1, Math.ceil((halfAlong * 2) / spacing));
  const geometry = chevronGeometry();
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false });
  const marks: { mesh: THREE.Mesh; offset: number }[] = [];
  for (let lane = 0; lane < lanes; lane++) {
    for (let row = 0; row < rows; row++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.setScalar(0.8);
      mesh.position.set(((lane + 0.5) / lanes - 0.5) * halfAcross * 2, 0.014, 0);
      flow.add(mesh);
      // Every other lane half a step on, so the marks do not march in ranks.
      marks.push({ mesh, offset: row * spacing + (lane % 2) * spacing * 0.5 });
    }
  }
  const length = rows * spacing;
  return {
    object: group,
    update() {
      const travelled = now() * speed;
      for (const { mesh, offset } of marks) {
        const along = (offset + travelled) % length;
        mesh.position.z = halfAlong - along;
        // Fades in at the head of the water and out at its foot, instead of popping.
        mesh.visible = along > 0.2 && along < halfAlong * 2 - 0.2;
      }
    },
  };
}

/** A column of bubbles: a ring on the ground where it takes a ball, and bubbles rising to where it lets go. */
function bubbleView(def: ZoneDef): ZoneView {
  const group = new THREE.Group();
  const [fx, fy, fz] = def.shape.center;
  const [, ty] = vectorParam(def, 'top');
  const radius = def.shape.kind === 'sphere' ? def.shape.radius : 0.5;
  const height = ty - fy;
  group.position.set(fx, fy - 0.1, fz);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.07, radius, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.014;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.8, radius, height, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xc9f3ff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
  );
  shaft.position.y = height / 2;
  group.add(ring, shaft);

  const glass = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
  const bubbles = Array.from({ length: 14 }, (_, i) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.05 + (i % 3) * 0.025, 8, 6), glass);
    group.add(mesh);
    return { mesh, phase: i / 14, angle: i * 2.4, reach: radius * (0.25 + 0.5 * ((i * 7) % 5) / 5) };
  });
  return {
    object: group,
    update() {
      const t = now();
      for (const bubble of bubbles) {
        const u = (t * 0.45 + bubble.phase) % 1;
        const swirl = bubble.angle + t * 1.5;
        bubble.mesh.position.set(Math.cos(swirl) * bubble.reach, u * height, Math.sin(swirl) * bubble.reach);
        bubble.mesh.scale.setScalar(0.6 + u * 0.8);
      }
    },
  };
}

const FLAKES = 70;

/**
 * Wind: a weathervane that points the way it blows and starts to swing just before it
 * changes, and snow in the air that goes with it. A calm lets both hang.
 */
function windView(def: ZoneDef): ZoneView {
  const group = new THREE.Group();
  const [vx, vy, vz] = vectorParam(def, 'vane');
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.7, 8), new THREE.MeshLambertMaterial({ color: 0x3d4652 }));
  post.position.set(vx, vy + 0.85, vz);
  post.castShadow = true;
  // The arrow is built pointing along -Z, which is a wind toward the north.
  const arrow = new THREE.Group();
  arrow.position.set(vx, vy + 1.75, vz);
  const red = new THREE.MeshLambertMaterial({ color: 0xe5484d });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.9), red);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 4), red);
  head.rotation.x = -Math.PI / 2;
  head.position.z = -0.55;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.26, 0.3), red);
  tail.position.z = 0.42;
  arrow.add(shaft, head, tail);
  group.add(post, arrow);

  // Snow in the air over the hole: it has no weight in the game, it only shows the wind.
  const box = def.shape.kind === 'box' ? def.shape : null;
  const positions = new Float32Array(FLAKES * 3);
  const seed = (i: number, k: number): number => {
    const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const [cx, , cz] = def.shape.center;
  const [hx, , hz] = box ? box.halfExtents : [6, 4, 6];
  const span = { x: Math.min(hx, 8), y: 4, z: Math.min(hz, 16) };
  for (let i = 0; i < FLAKES; i++) {
    positions[i * 3] = cx + (seed(i, 1) * 2 - 1) * span.x;
    positions[i * 3 + 1] = seed(i, 2) * span.y;
    positions[i * 3 + 2] = cz + (seed(i, 3) * 2 - 1) * span.z;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const flakes = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  flakes.frustumCulled = false;
  group.add(flakes);

  let yaw = 0;
  let last = now();
  const drift = { x: 0, z: 0 };
  return {
    object: group,
    update(zone) {
      const t = now();
      const dt = Math.min(0.1, t - last);
      last = t;
      const gust = (zone as Zone & { gust?: { x: number; z: number; turning: boolean } }).gust;
      if (!gust) return;
      const strength = Math.hypot(gust.x, gust.z);
      // Turn the short way round to the wind; in a calm, stay as it was.
      if (strength > 1e-6) {
        const target = Math.atan2(-gust.x, -gust.z);
        yaw += Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw)) * (1 - Math.exp(-6 * dt));
      }
      arrow.rotation.y = yaw + (gust.turning ? Math.sin(t * 22) * 0.35 : 0);
      arrow.rotation.x = strength > 1e-6 ? 0 : 0.5;

      // The snow takes up the wind over half a second, so a change is seen coming.
      const ease = 1 - Math.exp(-4 * dt);
      drift.x += (gust.x * 0.45 - drift.x) * ease;
      drift.z += (gust.z * 0.45 - drift.z) * ease;
      for (let i = 0; i < FLAKES; i++) {
        let x = positions[i * 3] + drift.x * dt;
        let y = positions[i * 3 + 1] - (0.5 + (i % 4) * 0.12) * dt;
        let z = positions[i * 3 + 2] + drift.z * dt;
        if (y < 0) y += span.y;
        if (x > cx + span.x) x -= span.x * 2;
        else if (x < cx - span.x) x += span.x * 2;
        if (z > cz + span.z) z -= span.z * 2;
        else if (z < cz - span.z) z += span.z * 2;
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

export function registerBuiltinZoneViews(): void {
  registerZoneView('current', currentView);
  registerZoneView('bubbleLift', bubbleView);
  registerZoneView('wind', windView);
  registerZoneView('grow', (def) => padView(def, GROW_GREEN, 'grow'));
  registerZoneView('shrink', (def) => padView(def, SHRINK_PURPLE, 'shrink'));
  registerZoneView('split', (def) => padView(def, SPLIT_CYAN, 'split'));
  registerZoneView('launcher', launcherView);
  registerZoneView('magnet', magnetView);
  registerZoneView('gravity', gravityView);
  registerZoneView('tunnelPair', tunnelView);
  registerZoneView('timeBonus', timeBonusView);
}
