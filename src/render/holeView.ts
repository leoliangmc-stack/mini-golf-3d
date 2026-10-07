import * as THREE from 'three';
import type { CompiledBody, CompiledGround, CompiledHole } from '../level/compile';
import type { CupDef } from '../level/schema';
import { getSurface } from '../physics/surfaces';

/** How much darker the sides of the ground are than its top. */
const SIDE_SHADE = 0.68;

/** Builds the visible course from the same compiled geometry the physics uses. */
export function buildHoleView(compiled: CompiledHole, cup: CupDef): THREE.Group {
  const group = new THREE.Group();
  if (compiled.ground) group.add(buildGround(compiled.ground));
  if (compiled.bodies.length > 0) group.add(buildBodies(compiled.bodies));
  for (const box of compiled.boxes) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(box.halfExtents[0] * 2, box.halfExtents[1] * 2, box.halfExtents[2] * 2),
      new THREE.MeshLambertMaterial({ color: getSurface(box.surface).color }),
    );
    mesh.position.set(box.center[0], box.center[1], box.center[2]);
    mesh.quaternion.set(box.rotation[0], box.rotation[1], box.rotation[2], box.rotation[3]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  for (const c of compiled.cylinders) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(c.radius, c.radius, c.halfHeight * 2, 20),
      new THREE.MeshLambertMaterial({ color: getSurface(c.surface).color, flatShading: true }),
    );
    mesh.position.set(c.center[0], c.center[1], c.center[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.add(buildCup(cup));
  return group;
}

/** Frees the GPU resources of a view built by buildHoleView. */
export function disposeHoleView(group: THREE.Group): void {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      material.dispose();
    }
  });
}

function buildGround(ground: CompiledGround): THREE.Mesh {
  const { vertices, indices, triangleSurfaces } = ground;
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();

  for (let tri = 0; tri < triangleSurfaces.length; tri++) {
    const corners = [0, 1, 2].map((k) => {
      const v = indices[tri * 3 + k] * 3;
      return [vertices[v], vertices[v + 1], vertices[v + 2]] as const;
    });
    // Two-tone checker (1 m squares) so the eye can read ball speed on a flat colour.
    const cx = (corners[0][0] + corners[1][0] + corners[2][0]) / 3;
    const cz = (corners[0][2] + corners[1][2] + corners[2][2]) / 3;
    const dark = (Math.floor(cx) + Math.floor(cz)) & 1;
    color.setHex(getSurface(triangleSurfaces[tri]).color).multiplyScalar(dark ? 0.93 : 1);
    for (const c of corners) {
      positions.push(c[0], c[1], c[2]);
      colors.push(color.r, color.g, color.b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

/** Sides and underside of every ground piece, as one mesh. The ground mesh is the top. */
function buildBodies(bodies: readonly CompiledBody[]): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();

  for (const body of bodies) {
    color.setHex(getSurface(body.surface).color).multiplyScalar(SIDE_SHADE);
    const top = body.top;
    const bottom = top.map((p) => [p[0], body.bottomY, p[2]] as const);
    const quad = (a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[]) => {
      for (const p of [a, b, c, a, c, d]) {
        positions.push(p[0], p[1], p[2]);
        colors.push(color.r, color.g, color.b);
      }
    };
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad(top[i], bottom[i], bottom[j], top[j]);
    }
    quad(bottom[0], bottom[3], bottom[2], bottom[1]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

function buildCup(cup: CupDef): THREE.Group {
  const group = new THREE.Group();
  group.position.set(cup.position[0], cup.position[1], cup.position[2]);

  const hole = new THREE.Mesh(
    new THREE.CircleGeometry(cup.radius, 32),
    new THREE.MeshBasicMaterial({ color: 0x14202b }),
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.004;

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(cup.radius, cup.radius + 0.03, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.005;

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 1.3, 8),
    new THREE.MeshLambertMaterial({ color: 0xf4f4f4 }),
  );
  pole.position.y = 0.65;
  pole.castShadow = true;

  const flagShape = new THREE.BufferGeometry();
  flagShape.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 1.3, 0, 0, 1.0, 0, 0.42, 1.15, 0], 3),
  );
  flagShape.computeVertexNormals();
  const flag = new THREE.Mesh(
    flagShape,
    new THREE.MeshLambertMaterial({ color: 0xff5a4f, side: THREE.DoubleSide }),
  );
  flag.castShadow = true;

  group.add(hole, rim, pole, flag);
  return group;
}
