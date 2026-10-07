import * as THREE from 'three';
import type { Game } from '../app/game';

const ZONE_COLORS: Record<string, number> = { outOfBounds: 0xff4d4d };

export interface Overlays {
  setColliders(visible: boolean): void;
  setZones(visible: boolean): void;
}

/** Wireframes of what the physics actually sees, drawn over the scene. */
export function createOverlays(game: Game): Overlays {
  const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthTest: false });
  const colliders = new THREE.LineSegments(new THREE.BufferGeometry(), material);
  colliders.frustumCulled = false;
  colliders.renderOrder = 10;
  colliders.visible = false;

  const zones = new THREE.Group();
  zones.visible = false;
  game.stage.scene.add(colliders, zones);

  const rebuildZones = () => {
    for (const child of [...zones.children]) {
      zones.remove(child);
      (child as THREE.LineSegments).geometry.dispose();
    }
    for (const zone of game.hole.zones) {
      const { shape } = zone;
      const solid =
        shape.kind === 'box'
          ? new THREE.BoxGeometry(shape.halfExtents[0] * 2, shape.halfExtents[1] * 2, shape.halfExtents[2] * 2)
          : new THREE.SphereGeometry(shape.radius, 16, 10);
      const lines = new THREE.LineSegments(
        new THREE.EdgesGeometry(solid),
        new THREE.LineBasicMaterial({ color: ZONE_COLORS[zone.type] ?? 0xffd23d }),
      );
      solid.dispose();
      lines.position.set(shape.center[0], shape.center[1], shape.center[2]);
      zones.add(lines);
    }
  };

  game.on((event) => {
    if (event.type === 'hole') rebuildZones();
  });
  rebuildZones();

  game.onFrame(() => {
    if (!colliders.visible) return;
    // Rapier hands back fresh buffers every call, so the geometry is rebuilt each frame.
    const buffers = game.session.world.raw.debugRender();
    colliders.geometry.dispose();
    colliders.geometry = new THREE.BufferGeometry();
    colliders.geometry.setAttribute('position', new THREE.BufferAttribute(buffers.vertices, 3));
    colliders.geometry.setAttribute('color', new THREE.BufferAttribute(buffers.colors, 4));
  });

  return {
    setColliders(visible) {
      colliders.visible = visible;
    },
    setZones(visible) {
      zones.visible = visible;
    },
  };
}
