import * as THREE from 'three';
import type { CrateDef } from '../level/schema';
import { PIN, type Prop } from '../physics/props';
import { getSurface } from '../physics/surfaces';

const from = new THREE.Quaternion();
const to = new THREE.Quaternion();

/** Places a loose object's picture between its last two physics poses. Hidden once it is off the course. */
export function updatePropView(object: THREE.Object3D, prop: Prop, alpha: number): void {
  object.visible = prop.body.isEnabled();
  if (!object.visible) return;
  const { prevPose: a, pose: b } = prop;
  object.position.set(
    a.position.x + (b.position.x - a.position.x) * alpha,
    a.position.y + (b.position.y - a.position.y) * alpha,
    a.position.z + (b.position.z - a.position.z) * alpha,
  );
  from.set(a.rotation.x, a.rotation.y, a.rotation.z, a.rotation.w);
  to.set(b.rotation.x, b.rotation.y, b.rotation.z, b.rotation.w);
  object.quaternion.slerpQuaternions(from, to, alpha);
}

/** A crate: a box with darker bands round its edges, so it reads as something loose. */
export function buildCrateView(def: CrateDef): THREE.Object3D {
  const [width, height, depth] = def.size;
  const color = getSurface(def.surface).color;
  const group = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshLambertMaterial({ color, flatShading: true }),
  );
  box.castShadow = true;
  box.receiveShadow = true;
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(width * 1.005, height * 1.005, depth * 1.005)),
    new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.55) }),
  );
  group.add(box, frame);
  // Where it starts, for pictures taken without a simulation.
  group.position.set(def.at[0], def.at[1] + height / 2, def.at[2]);
  group.rotation.y = ((def.yaw ?? 0) * Math.PI) / 180;
  return group;
}

const PIN_WHITE = 0xfbfaf5;
const PIN_RED = 0xe5484d;

/** A bowling pin, as tall and wide as the cylinder the physics knocks over. */
export function buildPinView(at: readonly [number, number, number]): THREE.Object3D {
  const { radius: r, height: h } = PIN;
  const group = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: PIN_WHITE });
  // Belly, neck and head, turned on a lathe. Heights run from the foot of the pin.
  const profile = [
    [0.62, 0],
    [0.92, 0.1],
    [1, 0.3],
    [0.8, 0.5],
    [0.42, 0.68],
    [0.4, 0.76],
    [0.56, 0.88],
    [0.44, 0.97],
    [0, 1],
  ].map(([wide, tall]) => new THREE.Vector2(wide * r, (tall - 0.5) * h));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 14), white);
  body.castShadow = true;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.45, r * 0.47, h * 0.05, 14),
    new THREE.MeshLambertMaterial({ color: PIN_RED }),
  );
  band.position.y = (0.72 - 0.5) * h;
  group.add(body, band);
  group.position.set(at[0], at[1] + h / 2, at[2]);
  return group;
}
