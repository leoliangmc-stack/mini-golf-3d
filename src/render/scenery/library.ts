import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * What the design project's scene code draws with (`L` in src/render/scenery/design.js),
 * besides the parts of three.js it imports itself: coarser round shapes for a phone, the
 * rounded box, a mirror, and the room light that shines on everything.
 */
export interface DesignLibrary {
  T: Partial<typeof THREE>;
  RB: typeof RoundedBoxGeometry;
  Reflector: new (geometry: THREE.BufferGeometry, options: { color?: THREE.ColorRepresentation }) => THREE.Mesh;
  env: THREE.Texture;
}

/**
 * The design's mirror re-renders the whole scene every frame; here it is a still, glossy
 * sheet of its colour. The only one it has lies on a demonstration course the game
 * leaves out anyway.
 */
class StillMirror extends THREE.Mesh {
  constructor(geometry: THREE.BufferGeometry, { color = 0x7f7f7f }: { color?: THREE.ColorRepresentation } = {}) {
    super(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.05, metalness: 0.4 }));
  }
}

/**
 * Fewer segments for a round shape, by `detail` (1 keeps them all). Only shapes drawn
 * smooth lose any: a prism of three to ten sides (a roof, a pyramid, a crystal) is that
 * shape on purpose, and a smooth one never drops below eight.
 */
function segments(n: number | undefined, fallback: number, detail: number, least = 8): number {
  const count = n ?? fallback;
  if (detail >= 1 || count <= 10) return count;
  return Math.max(least, Math.round(count * detail));
}

/**
 * three.js's round geometries made coarser by `detail`, for the scene code to use in
 * place of its own. It builds hundreds of spheres and cylinders at 32 to 64 segments,
 * which a picture renders once and a phone would draw sixty times a second.
 */
function coarser(detail: number): Partial<typeof THREE> {
  if (detail >= 1) return {};
  class SphereGeometry extends THREE.SphereGeometry {
    constructor(radius?: number, width?: number, height?: number, ...rest: number[]) {
      super(radius, segments(width, 32, detail), segments(height, 16, detail, 6), ...rest);
    }
  }
  class CylinderGeometry extends THREE.CylinderGeometry {
    constructor(top?: number, bottom?: number, height?: number, radial?: number, ...rest: [number?, boolean?, number?, number?]) {
      super(top, bottom, height, segments(radial, 32, detail), ...rest);
    }
  }
  class ConeGeometry extends THREE.ConeGeometry {
    constructor(radius?: number, height?: number, radial?: number, ...rest: [number?, boolean?, number?, number?]) {
      super(radius, height, segments(radial, 32, detail), ...rest);
    }
  }
  class TorusGeometry extends THREE.TorusGeometry {
    constructor(radius?: number, tube?: number, radial?: number, tubular?: number, arc?: number) {
      super(radius, tube, segments(radial, 12, detail, 6), segments(tubular, 48, detail), arc);
    }
  }
  class CircleGeometry extends THREE.CircleGeometry {
    constructor(radius?: number, count?: number, ...rest: number[]) {
      super(radius, segments(count, 32, detail), ...rest);
    }
  }
  class LatheGeometry extends THREE.LatheGeometry {
    constructor(points?: THREE.Vector2[], count?: number, ...rest: number[]) {
      super(points, segments(count, 12, detail), ...rest);
    }
  }
  class CapsuleGeometry extends THREE.CapsuleGeometry {
    constructor(radius?: number, height?: number, cap?: number, radial?: number, ...rest: number[]) {
      super(radius, height, segments(cap, 4, detail, 2), segments(radial, 8, detail), ...rest);
    }
  }
  return {
    SphereGeometry,
    CylinderGeometry,
    ConeGeometry,
    TorusGeometry,
    CircleGeometry,
    LatheGeometry,
    CapsuleGeometry,
  };
}

const rooms = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

/** The light of a plain white room, as the design lit every scene by: made once per renderer. */
export function roomLight(renderer: THREE.WebGLRenderer): THREE.Texture {
  let texture = rooms.get(renderer);
  if (!texture) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    rooms.set(renderer, texture);
  }
  return texture;
}

export function designLibrary(env: THREE.Texture, detail: number): DesignLibrary {
  return { T: coarser(detail), RB: RoundedBoxGeometry, Reflector: StillMirror, env };
}
