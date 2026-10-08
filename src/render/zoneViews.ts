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

export function registerBuiltinZoneViews(): void {
  registerZoneView('grow', (def) => padView(def, GROW_GREEN, 'grow'));
  registerZoneView('shrink', (def) => padView(def, SHRINK_PURPLE, 'shrink'));
  registerZoneView('split', (def) => padView(def, SPLIT_CYAN, 'split'));
  registerZoneView('launcher', launcherView);
  registerZoneView('magnet', magnetView);
  registerZoneView('gravity', gravityView);
  registerZoneView('tunnelPair', tunnelView);
  registerZoneView('timeBonus', timeBonusView);
}
