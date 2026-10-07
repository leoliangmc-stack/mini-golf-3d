import * as THREE from 'three';
import type { ZoneDef } from '../physics/zones';
import { numberParam, vectorParam } from '../physics/zones';

/** Builds what the player sees of a zone. Zones without a registered view are invisible. */
export type ZoneViewBuilder = (def: ZoneDef) => THREE.Object3D;

const registry = new Map<string, ZoneViewBuilder>();

export function registerZoneView(type: string, build: ZoneViewBuilder): void {
  registry.set(type, build);
}

export function buildZoneView(def: ZoneDef): THREE.Object3D | null {
  return registry.get(def.type)?.(def) ?? null;
}

const UP = new THREE.Vector3(0, 1, 0);

/** A cannon: a barrel from the mouth on the ground up to the point the ball is fired from. */
function launcherView(def: ZoneDef): THREE.Object3D {
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
  return group;
}

const RED = 0xe5484d;
const BLUE = 0x3b82f6;

/** Rings on the ground out to the edge of the field: red pulls, blue pushes. */
function magnetView(def: ZoneDef): THREE.Object3D {
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
  return group;
}

/** A tinted volume with arrows on its floor showing which way things fall inside it. */
function gravityView(def: ZoneDef): THREE.Object3D {
  const group = new THREE.Group();
  if (def.shape.kind !== 'box') return group;
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
  // A flat chevron in the XZ plane, pointing along +Z.
  const chevron = new THREE.Shape();
  chevron.moveTo(-0.3, -0.25);
  chevron.lineTo(0, 0.05);
  chevron.lineTo(0.3, -0.25);
  chevron.lineTo(0.3, -0.05);
  chevron.lineTo(0, 0.25);
  chevron.lineTo(-0.3, -0.05);
  chevron.closePath();
  const arrowGeometry = new THREE.ShapeGeometry(chevron);
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
  return group;
}

export function registerBuiltinZoneViews(): void {
  registerZoneView('launcher', launcherView);
  registerZoneView('magnet', magnetView);
  registerZoneView('gravity', gravityView);
}
