import * as THREE from 'three';
import type { MoverDef } from '../level/schema';
import type { Mover } from '../physics/movers';
import { getSurface } from '../physics/surfaces';

const EBONY = 0x2b2633;

/**
 * A run of piano keys (SPEC v6 3.4): the block itself, with the gaps between its white
 * keys drawn along the way the ball rolls and the black keys set at their far end.
 */
function keysLook(def: MoverDef, body: THREE.Mesh): THREE.Group {
  const [width, height, depth] = def.size;
  const group = new THREE.Group().add(body);
  const dark = new THREE.MeshLambertMaterial({ color: EBONY });
  const keys = Math.max(3, Math.round(width / 0.48));
  const top = height / 2;
  for (let i = 1; i < keys; i++) {
    const x = (i / keys - 0.5) * width;
    const gap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, depth * 0.98), dark);
    gap.position.set(x, top + 0.002, 0);
    group.add(gap);
    // Black keys sit over the gaps, two then three, as on a keyboard, flat enough to roll over unnoticed.
    if (i % 7 === 3 || i % 7 === 0) continue;
    const black = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.014, depth * 0.36), dark);
    black.position.set(x, top + 0.004, -depth * 0.3);
    group.add(black);
  }
  // A red felt line where the keys meet the floor they rise to.
  const felt = new THREE.Mesh(new THREE.BoxGeometry(width, 0.012, 0.08), new THREE.MeshLambertMaterial({ color: 0xc8344f }));
  felt.position.set(0, top + 0.003, -depth / 2 + 0.05);
  group.add(felt);
  return group;
}

/** The hand of a clock (SPEC v6 3.5): a bar with a boss at its middle and a bright tip at each end. */
function handLook(def: MoverDef, body: THREE.Mesh): THREE.Group {
  const [width, height, depth] = def.size;
  const group = new THREE.Group().add(body);
  const brass = new THREE.MeshLambertMaterial({ color: 0xe2b84a, flatShading: true });
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(depth * 0.95, depth * 1.1, height * 1.3, 16), brass);
  hub.castShadow = true;
  group.add(hub);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.28, height * 1.02, depth * 1.04), brass);
    tip.position.x = side * (width / 2 - 0.14);
    group.add(tip);
  }
  return group;
}

/** The visible shape of a moving part: a box, dressed up if its data asks for a look. */
export function buildMoverView(def: MoverDef): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(def.size[0], def.size[1], def.size[2]),
    new THREE.MeshLambertMaterial({ color: getSurface(def.surface).color }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (def.look === 'keys') return keysLook(def, mesh);
  if (def.look === 'hand') return handLook(def, mesh);
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
