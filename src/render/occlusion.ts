import * as THREE from 'three';

/** Something big enough to hide the ball, and the space it takes up. */
export interface Occluder {
  object: THREE.Object3D;
  bounds: THREE.Box3;
}

/** How solid a faded object stays. */
const SEE_THROUGH = 0.26;
/** Higher fades faster. An object covers ~63% of the way every 1/RATE seconds. */
const RATE = 9;
/**
 * Only things that stand at least this far above the target can hide it. That leaves
 * out low rails, and the floor a ball has just dropped below on its way out of bounds.
 */
const CLEARANCE = 0.6;
/** The ray stops this far short of the target, so what the target rests on never counts. */
const SHORT = 0.3;

interface Item extends Occluder {
  materials: { material: THREE.Material; opacity: number; transparent: boolean }[];
  /** 1 is fully solid. */
  shown: number;
}

/**
 * Keeps a target visible: every frame a ray is cast from the eye to the target, and
 * whatever it passes through on the way turns see-through until it is out of the way
 * again. Knows nothing about golf; give it any set of objects and any target.
 *
 * Cheap by construction: a box test per object, and an exact test only for the few
 * objects whose box the ray actually crosses.
 */
export class OcclusionFader {
  private items: Item[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly direction = new THREE.Vector3();
  private readonly hits: THREE.Intersection[] = [];

  /** Replaces the set of objects that may be faded. Each gets materials of its own. */
  setOccluders(occluders: readonly Occluder[]): void {
    this.items = occluders.map((occluder) => {
      const materials: Item['materials'] = [];
      occluder.object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        // A material shared with something else would fade that too.
        const own = (Array.isArray(child.material) ? child.material : [child.material]).map((m: THREE.Material) => m.clone());
        child.material = Array.isArray(child.material) ? own : own[0];
        for (const material of own) {
          materials.push({ material, opacity: material.opacity, transparent: material.transparent });
        }
      });
      return { ...occluder, materials, shown: 1 };
    });
  }

  update(eye: THREE.Vector3, target: THREE.Vector3, dt: number): void {
    const { raycaster, direction } = this;
    const distance = direction.subVectors(target, eye).length();
    if (distance < 1e-6) return;
    raycaster.set(eye, direction.divideScalar(distance));
    raycaster.far = distance - SHORT;
    const step = 1 - Math.exp(-RATE * dt);

    for (const item of this.items) {
      let hidden = false;
      if (item.bounds.max.y >= target.y + CLEARANCE && raycaster.ray.intersectsBox(item.bounds)) {
        this.hits.length = 0;
        hidden = raycaster.intersectObject(item.object, true, this.hits).length > 0;
      }
      const goal = hidden ? SEE_THROUGH : 1;
      if (item.shown === goal) continue;
      item.shown += (goal - item.shown) * step;
      if (Math.abs(item.shown - goal) < 0.01) item.shown = goal;
      for (const entry of item.materials) {
        const { material } = entry;
        material.opacity = entry.opacity * item.shown;
        const transparent = entry.transparent || item.shown < 1;
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
      }
    }
  }
}
