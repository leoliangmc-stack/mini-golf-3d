import * as THREE from 'three';
import type { Vec3 } from '../core/types';
import type { TierSettings } from './quality';
import type { ThemeDef } from './theme';

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  /** Registers a callback for viewport size changes; it is also called once immediately. */
  onResize(fn: (width: number, height: number) => void): void;
  applyTheme(theme: ThemeDef): void;
  /** Aims the shadow-casting light so its shadow map covers exactly this box. */
  fitShadows(bounds: { min: Vec3; max: Vec3 }): void;
  applyQuality(settings: TierSettings): void;
}

/** Direction the sunlight comes from. */
const SUN_DIRECTION = new THREE.Vector3(8, 16, 10).normalize();

export interface StageOptions {
  /**
   * Multisampling is decided when the renderer is made and cannot change after. Off on
   * a handheld, where the screen's own density hides the jaggies and the fill rate is
   * what runs out first.
   */
  antialias: boolean;
}

export function createStage(canvas: HTMLCanvasElement, { antialias }: StageOptions = { antialias: true }): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  // The picture of the far side of a hall is cut off at the edge of its skirt (render/strangeViews.ts).
  renderer.localClippingEnabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const background = new THREE.Color();
  scene.background = background;

  const ambient = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 4;
  scene.add(ambient, sun, sun.target);

  const seaMaterial = new THREE.MeshLambertMaterial({ transparent: true });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), seaMaterial);
  sea.rotation.x = -Math.PI / 2;
  sea.receiveShadow = true;
  scene.add(sea);

  const resizeListeners: ((w: number, h: number) => void)[] = [];
  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    for (const fn of resizeListeners) fn(w, h);
  };
  window.addEventListener('resize', resize);
  resize();

  return {
    renderer,
    scene,
    onResize(fn) {
      resizeListeners.push(fn);
      fn(window.innerWidth, window.innerHeight);
    },
    applyTheme(theme) {
      background.setHex(theme.sky);
      ambient.color.setHex(theme.ambientSky);
      ambient.groundColor.setHex(theme.ambientGround);
      ambient.intensity = theme.ambientIntensity;
      sun.color.setHex(theme.sun);
      sun.intensity = theme.sunIntensity;
      sea.visible = theme.sea !== undefined;
      if (theme.sea) {
        sea.position.y = theme.sea.y;
        seaMaterial.color.setHex(theme.sea.color);
        seaMaterial.opacity = theme.sea.opacity ?? 1;
      }
    },
    applyQuality(settings) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatio));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      sun.castShadow = settings.shadows;
      if (sun.shadow.mapSize.x !== settings.shadowMapSize) {
        sun.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
    },
    fitShadows({ min, max }) {
      const center = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
      const radius = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 + 1;
      sun.target.position.copy(center);
      sun.position.copy(center).addScaledVector(SUN_DIRECTION, radius + 10);
      const cam = sun.shadow.camera;
      cam.left = cam.bottom = -radius;
      cam.right = cam.top = radius;
      cam.near = 1;
      cam.far = 2 * radius + 20;
      cam.updateProjectionMatrix();
    },
  };
}
