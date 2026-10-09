import * as THREE from 'three';
import { goalAnchor, goalPins } from '../game/goal';
import { compileHole } from '../level/compile';
import type { WorldDef } from '../level/schema';
import { FollowCamera } from './camera';
import { buildFieldView } from './fieldViews';
import { framingPoints } from './framing';
import { buildHoleView, disposeHoleView } from './holeView';
import { buildMoverView } from './moverView';
import { buildCrateView, buildPinView } from './propViews';
import { getTheme } from './theme';
import { buildZoneView } from './zoneViews';

/** Linear light to an sRGB byte, since render targets are not colour-converted for us. */
const toSrgb = (byte: number): number => {
  const c = byte / 255;
  return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
};

/**
 * Renders a small picture of a world's first hole and returns it as an image URL,
 * or null if the device cannot do it. Used for the world cards.
 */
export function renderThumbnail(
  renderer: THREE.WebGLRenderer,
  world: WorldDef,
  width = 360,
  height = 220,
): string | null {
  const hole = world.holes[0];
  const theme = getTheme(world.theme);
  const view = buildHoleView(compileHole(hole), hole).group;
  for (const mover of hole.movers ?? []) {
    const mesh = buildMoverView(mover);
    mesh.position.set(...mover.position);
    mesh.rotation.y = ((mover.yaw ?? 0) * Math.PI) / 180;
    view.add(mesh);
  }
  for (const zone of hole.zones) {
    const zoneView = buildZoneView(zone, hole);
    if (zoneView) view.add(zoneView.object);
  }
  for (const crate of hole.crates ?? []) view.add(buildCrateView(crate));
  for (const pin of goalPins(hole.goal)) view.add(buildPinView(pin.at));
  if (hole.field) view.add(buildFieldView(hole.field).group);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.sky);
  const sun = new THREE.DirectionalLight(theme.sun, theme.sunIntensity);
  sun.position.set(8, 16, 10);
  scene.add(view, new THREE.HemisphereLight(theme.ambientSky, theme.ambientGround, theme.ambientIntensity), sun);
  if (theme.sea) {
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshLambertMaterial({ color: theme.sea.color }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = theme.sea.y;
    scene.add(sea);
  }

  const camera = new FollowCamera();
  camera.setViewport(width, height);
  camera.configure(hole.camera);
  const [tx, ty, tz] = hole.tee;
  const tee = { x: tx, y: ty, z: tz };
  camera.snapTo(tee, goalAnchor(hole.goal), framingPoints(hole, tee));

  const target = new THREE.WebGLRenderTarget(width, height, { samples: 4 });
  const pixels = new Uint8Array(width * height * 4);
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera.camera);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  } catch {
    return null;
  } finally {
    renderer.setRenderTarget(null);
    target.dispose();
    disposeHoleView(view);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const image = context.createImageData(width, height);
  // WebGL rows run bottom to top.
  for (let y = 0; y < height; y++) {
    const from = (height - 1 - y) * width * 4;
    const to = y * width * 4;
    for (let x = 0; x < width * 4; x += 4) {
      image.data[to + x] = toSrgb(pixels[from + x]);
      image.data[to + x + 1] = toSrgb(pixels[from + x + 1]);
      image.data[to + x + 2] = toSrgb(pixels[from + x + 2]);
      image.data[to + x + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.82);
}
