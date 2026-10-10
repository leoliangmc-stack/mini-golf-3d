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

/**
 * One mesh of an occluder and its two looks. A material that turns `transparent` is
 * a different shader program to the renderer, built on the spot, so each mesh keeps a
 * see-through twin of its material ready and swaps between the two instead.
 */
interface Slot {
  mesh: THREE.Mesh;
  /** The material as built, drawn while the object is solid. */
  solid: THREE.Material | THREE.Material[];
  /** The same with blending on, drawn while the object is faded. */
  faded: THREE.Material | THREE.Material[];
  /** Each faded material with the opacity it had as built. */
  opacities: { material: THREE.Material; opacity: number }[];
}

interface Item extends Occluder {
  slots: Slot[];
  /** 1 is fully solid. */
  shown: number;
}

const list = (material: THREE.Material | THREE.Material[]): THREE.Material[] =>
  Array.isArray(material) ? material : [material];

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
    // The twins of the last set are nobody else's to free.
    for (const item of this.items) {
      for (const slot of item.slots) for (const material of list(slot.faded)) material.dispose();
    }
    this.items = occluders.map((occluder) => {
      const slots: Slot[] = [];
      occluder.object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        // A material shared with something else would fade that too.
        const solid = list(child.material).map((m: THREE.Material) => m.clone());
        const faded = solid.map((m) => {
          const twin = m.clone();
          twin.transparent = true;
          return twin;
        });
        child.material = Array.isArray(child.material) ? solid : solid[0];
        slots.push({
          mesh: child,
          solid: child.material,
          faded: Array.isArray(child.material) ? faded : faded[0],
          opacities: faded.map((material) => ({ material, opacity: material.opacity })),
        });
      });
      return { ...occluder, slots, shown: 1 };
    });
  }

  /**
   * Builds the shader programs of the see-through look now, so that the first fade in
   * play does not stall the frame while they are built. Call once the occluders are in
   * `scene`; the solid look is compiled along the way.
   */
  warm(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    for (const item of this.items) for (const slot of item.slots) slot.mesh.material = slot.faded;
    try {
      renderer.compile(scene, camera);
    } finally {
      for (const item of this.items) for (const slot of item.slots) slot.mesh.material = slot.solid;
    }
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
      const fading = item.shown < 1;
      for (const slot of item.slots) {
        slot.mesh.material = fading ? slot.faded : slot.solid;
        if (fading) for (const entry of slot.opacities) entry.material.opacity = entry.opacity * item.shown;
      }
    }
  }
}
