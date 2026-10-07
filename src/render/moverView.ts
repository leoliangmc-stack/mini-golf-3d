import * as THREE from 'three';
import type { MoverDef } from '../level/schema';
import type { Mover } from '../physics/movers';
import { getSurface } from '../physics/surfaces';

/** The visible box of a moving part. */
export function buildMoverView(def: MoverDef): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(def.size[0], def.size[1], def.size[2]),
    new THREE.MeshLambertMaterial({ color: getSurface(def.surface).color }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Places the box between the mover's last two physics poses. */
export function updateMoverView(mesh: THREE.Object3D, mover: Mover, alpha: number): void {
  const { prevPose: a, pose: b } = mover;
  mesh.position.set(
    a.position.x + (b.position.x - a.position.x) * alpha,
    a.position.y + (b.position.y - a.position.y) * alpha,
    a.position.z + (b.position.z - a.position.z) * alpha,
  );
  mesh.rotation.y = a.yaw + (b.yaw - a.yaw) * alpha;
}
