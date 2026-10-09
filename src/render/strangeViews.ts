import * as THREE from 'three';
import type { Part } from '../game/field/field';
import type { Echo, EchoPlate, Recording } from '../game/field/strange';
import { goalCups } from '../game/goal';
import { compileHole } from '../level/compile';
import type { EchoDef, EchoPlateDef } from '../level/field';
import type { HoleDef, MirrorDef, MoverDef } from '../level/schema';
import type { Ball } from '../physics/ball';
import type { Mover } from '../physics/movers';
import { getSurface } from '../physics/surfaces';
import type { Zone, ZoneDef } from '../physics/zones';
import { hallOf } from '../physics/zones/wrap';

/** What a part's picture needs to know each frame besides the part itself. The same as fieldViews.ViewFrame. */
interface Frame {
  alpha: number;
  dt: number;
  time: number;
}

interface PartPicture {
  object: THREE.Object3D;
  update?(part: Part, frame: Frame): void;
}

/** What a zone's picture may be told each frame besides the zone. The same as zoneViews.ZoneScene. */
interface Scene {
  balls: readonly Ball[];
  time: number;
}

interface ZonePicture {
  object: THREE.Object3D;
  update?(zone: Zone, alpha: number, scene?: Scene): void;
}

const lambert = (color: number, flat = true): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color, flatShading: flat });
const glow = (color: number, opacity = 1): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide });

/** A flat shape lying on the ground, facing up. */
function decal(geometry: THREE.BufferGeometry, material: THREE.Material, y: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

const ease = (from: number, to: number, rate: number, dt: number): number => from + (to - from) * (1 - Math.exp(-rate * dt));

// --- Bridges that come and go ---------------------------------------------------

const PHANTOM_WARN = 0.8;
/** Seconds before it comes back that the outline of a bridge that is gone starts to brighten. */
const PHANTOM_HERALD = 0.6;

/**
 * A bridge that comes and goes (SPEC v8 3.2): a slab of pale light with a bright edge.
 * In its last moments it blinks, faster and faster; gone, only its outline is left, so
 * that where it will be can still be seen, and the outline brightens just before it is
 * back. What is drawn is the part's own clock and nothing else.
 */
export function phantomLook(def: MoverDef, body: THREE.Mesh): THREE.Group {
  const phantom = def.phantom!;
  const [width, height, depth] = def.size;
  const group = new THREE.Group().add(body);
  const color = getSurface(def.surface).color;
  const material = body.material as THREE.MeshLambertMaterial;
  material.transparent = true;
  material.opacity = 0.92;
  material.emissive = new THREE.Color(color);
  material.emissiveIntensity = 0.3;
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xf2fffd, transparent: true, opacity: 0.95 });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth)), edgeMaterial);
  group.add(edges);
  const warn = phantom.warn ?? PHANTOM_WARN;

  group.userData.phantom = (mover: Mover): void => {
    const { cycle, present } = mover;
    if (present) {
      const left = (phantom.shown - cycle) * phantom.period;
      let there = 1;
      if (left < warn) {
        // Three blinks, each shorter than the one before.
        const u = 1 - left / warn;
        there = 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(u * u * 6 * Math.PI));
      }
      body.visible = true;
      body.castShadow = there > 0.6;
      material.opacity = 0.92 * there;
      edgeMaterial.opacity = 0.35 + 0.6 * there;
    } else {
      // Gone, a ghost of it is left: enough to see where it will be, too little to take for a bridge.
      const until = (1 - cycle) * phantom.period;
      const herald = cycle >= phantom.shown && until < PHANTOM_HERALD ? 1 - until / PHANTOM_HERALD : 0;
      body.visible = true;
      body.castShadow = false;
      material.opacity = 0.07 + 0.2 * herald;
      edgeMaterial.opacity = 0.3 + 0.5 * herald;
    }
  };
  return group;
}

// --- Halls with joined edges ----------------------------------------------------

const EDGE_GLOW = 0x7ff6ff;
/** How pale the picture of the other side is: this much of the way from its own colour to white. */
const GHOST_FADE = 0.45;
const GHOST_OPACITY = 0.5;
/** A copy of a wall is drawn this much thinner and lower, so that it hides inside a real wall standing in the same place. */
const GHOST_SHRINK = 0.94;

/**
 * A hall with joined edges (SPEC v8 3.3): a bright line along each edge that leads to
 * the one across from it, and beyond the line a pale picture of what lies inside the
 * other: its walls, the cup, and any ball that is there. A ball rolling up to a line
 * can be seen coming toward the far one.
 *
 * The pictures are copies moved across by the width of the hall and cut off at the
 * edge of the skirt. They are drawn only: the ground a ball crosses on is real ground.
 */
export function wrapView(def: ZoneDef, hole?: HoleDef): ZonePicture {
  const { min, max, y, x: joinedX, z: joinedZ, skirt } = hallOf(def);
  const width = max[0] - min[0];
  const depth = max[1] - min[1];
  const group = new THREE.Group();

  const lineMaterial = new THREE.MeshBasicMaterial({ color: EDGE_GLOW, transparent: true, opacity: 0.9, depthWrite: false });
  const edgeLine = (cx: number, cz: number, lengthX: number, lengthZ: number): void => {
    const line = decal(new THREE.PlaneGeometry(lengthX, lengthZ), lineMaterial, y + 0.016);
    line.position.x = cx;
    line.position.z = cz;
    group.add(line);
  };
  const midX = (min[0] + max[0]) / 2;
  const midZ = (min[1] + max[1]) / 2;
  if (joinedX) {
    edgeLine(min[0], midZ, 0.14, depth);
    edgeLine(max[0], midZ, 0.14, depth);
  }
  if (joinedZ) {
    edgeLine(midX, min[1], width, 0.14);
    edgeLine(midX, max[1], width, 0.14);
  }

  /** One strip of skirt, and the balls drawn on it. */
  const strips: { dx: number; dz: number; x0: number; x1: number; z0: number; z1: number; balls: THREE.Mesh[] }[] = [];
  if (hole) {
    const compiled = compileHole(hole);
    const cups = goalCups(hole.goal);
    const ballGeometry = new THREE.IcosahedronGeometry(0.1, 2);
    for (const sx of joinedX ? [-1, 0, 1] : [0]) {
      for (const sz of joinedZ ? [-1, 0, 1] : [0]) {
        if (sx === 0 && sz === 0) continue;
        const x0 = sx > 0 ? max[0] : sx < 0 ? min[0] - skirt : min[0];
        const x1 = sx > 0 ? max[0] + skirt : sx < 0 ? min[0] : max[0];
        const z0 = sz > 0 ? max[1] : sz < 0 ? min[1] - skirt : min[1];
        const z1 = sz > 0 ? max[1] + skirt : sz < 0 ? min[1] : max[1];
        const dx = sx * width;
        const dz = sz * depth;
        // Whatever is drawn on this strip is cut off at its four sides.
        const planes = [
          new THREE.Plane(new THREE.Vector3(1, 0, 0), -x0),
          new THREE.Plane(new THREE.Vector3(-1, 0, 0), x1),
          new THREE.Plane(new THREE.Vector3(0, 0, 1), -z0),
          new THREE.Plane(new THREE.Vector3(0, 0, -1), z1),
        ];
        const materials = new Map<number, THREE.MeshLambertMaterial>();
        const pale = (color: number): THREE.MeshLambertMaterial => {
          let material = materials.get(color);
          if (!material) {
            material = new THREE.MeshLambertMaterial({
              color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), GHOST_FADE),
              transparent: true,
              opacity: GHOST_OPACITY,
              depthWrite: false,
              clippingPlanes: planes,
            });
            materials.set(color, material);
          }
          return material;
        };
        const reaches = (cx: number, cz: number, radius: number): boolean =>
          cx + radius > x0 && cx - radius < x1 && cz + radius > z0 && cz - radius < z1;

        for (const box of compiled.boxes) {
          const cx = box.center[0] + dx;
          const cz = box.center[2] + dz;
          if (!reaches(cx, cz, Math.hypot(box.halfExtents[0], box.halfExtents[2]))) continue;
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(box.halfExtents[0] * 2, box.halfExtents[1] * 2 * GHOST_SHRINK, box.halfExtents[2] * 2 * GHOST_SHRINK),
            pale(getSurface(box.surface).color),
          );
          mesh.position.set(cx, box.center[1], cz);
          mesh.quaternion.set(box.rotation[0], box.rotation[1], box.rotation[2], box.rotation[3]);
          group.add(mesh);
        }
        for (const c of compiled.cylinders) {
          const cx = c.center[0] + dx;
          const cz = c.center[2] + dz;
          if (!reaches(cx, cz, c.radius)) continue;
          const mesh = new THREE.Mesh(new THREE.CylinderGeometry(c.radius, c.radius, c.halfHeight * 2, 16), pale(getSurface(c.surface).color));
          mesh.position.set(cx, c.center[1], cz);
          group.add(mesh);
        }
        for (const cup of cups) {
          const cx = cup.position[0] + dx;
          const cz = cup.position[2] + dz;
          if (!reaches(cx, cz, cup.radius)) continue;
          // The cup as it looks from afar: a dark disc, a pole and a flag.
          const flag = new THREE.Group();
          flag.position.set(cx, cup.position[1], cz);
          const disc = decal(new THREE.CircleGeometry(cup.radius, 24), pale(0x14202b), 0.02);
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 6), pale(0xffffff));
          pole.position.y = 0.65;
          const cloth = new THREE.BufferGeometry();
          cloth.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.3, 0, 0, 1.0, 0, 0.42, 1.15, 0], 3));
          cloth.computeVertexNormals();
          const clothMaterial = pale(0xff5a4f);
          clothMaterial.side = THREE.DoubleSide;
          flag.add(disc, pole, new THREE.Mesh(cloth, clothMaterial));
          group.add(flag);
        }
        // Room for the player's ball and a shadow.
        const balls = [0, 1].map(() => {
          const mesh = new THREE.Mesh(ballGeometry, pale(0xffffff));
          mesh.visible = false;
          group.add(mesh);
          return mesh;
        });
        strips.push({ dx, dz, x0, x1, z0, z1, balls });
      }
    }
  }

  return {
    object: group,
    update(_zone, alpha, scene) {
      if (!scene) return;
      lineMaterial.opacity = 0.7 + 0.25 * Math.sin(scene.time * 3);
      for (const strip of strips) {
        strip.balls.forEach((mesh, i) => {
          const ball = scene.balls[i];
          mesh.visible = false;
          if (!ball || !ball.body.isEnabled()) return;
          const { prevPosition: a, position: b } = ball.pose;
          const px = a.x + (b.x - a.x) * alpha + strip.dx;
          const pz = a.z + (b.z - a.z) * alpha + strip.dz;
          const py = a.y + (b.y - a.y) * alpha;
          if (px < strip.x0 || px > strip.x1 || pz < strip.z0 || pz > strip.z1 || Math.abs(py - y) > 1) return;
          mesh.visible = true;
          mesh.position.set(px, py, pz);
          mesh.scale.setScalar(ball.props.radius / 0.1);
        });
      }
    },
  };
}

// --- The mirror -----------------------------------------------------------------

/** How high the pane stands above the low wall it is set on, and how high that wall is. */
const PANE_HEIGHT = 1.25;
const PANE_FOOT = 0.6;

/**
 * The mirror of a hole that has a shadow ball (SPEC v8 3.4): a tall pane on a gilt
 * frame, standing along the line the two sides are reflections about. It is a picture
 * of a mirror, not one: thin, pale and see-through, so that it hides nothing.
 */
export function mirrorView(mirror: MirrorDef): THREE.Object3D {
  const group = new THREE.Group();
  const [from, to] = mirror.span;
  const length = Math.abs(to - from);
  const middle = (from + to) / 2;
  const y = mirror.y ?? 0;
  // Built along +Z, then turned for a mirror that stands across the course.
  const pane = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, PANE_HEIGHT, length),
    new THREE.MeshBasicMaterial({ color: 0xd8f4ff, transparent: true, opacity: 0.17, depthWrite: false, side: THREE.DoubleSide }),
  );
  pane.position.y = PANE_FOOT + PANE_HEIGHT / 2;
  const gilt = lambert(0xe2b84a);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, length + 0.1), gilt);
  rail.position.y = PANE_FOOT + PANE_HEIGHT;
  group.add(pane, rail);
  for (const end of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, PANE_FOOT + PANE_HEIGHT + 0.12, 0.16), gilt);
    post.position.set(0, (PANE_FOOT + PANE_HEIGHT + 0.12) / 2, (end * length) / 2);
    post.castShadow = true;
    group.add(post);
  }
  // A few slanting streaks of light, as on glass.
  const streak = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const count = Math.max(2, Math.round(length / 3));
  for (let i = 0; i < count; i++) {
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.16, PANE_HEIGHT * 1.1), streak);
    mark.rotation.y = Math.PI / 2;
    mark.rotation.x = 0.5;
    mark.position.set(0, PANE_FOOT + PANE_HEIGHT / 2, ((i + 0.5) / count - 0.5) * length);
    group.add(mark);
  }
  if (mirror.axis === 'x') group.position.set(mirror.at, y, middle);
  else {
    group.rotation.y = Math.PI / 2;
    group.position.set(middle, y, mirror.at);
  }
  return group;
}

// --- Echoes ---------------------------------------------------------------------

const ECHO_TINT = 0xa8ecff;
const ECHO_BALL = 0xe4f8ff;
/** The most dots the path of the last stroke is drawn with. */
const PATH_DOTS = 150;

/**
 * An echo zone (SPEC v8 3.5): rippled ground, the path the last stroke took across it
 * as a line of dots, and the echo itself, a pale ball with a ring under it. The dots
 * are what the next stroke will set going.
 */
export function echoView(def: EchoDef): PartPicture {
  const group = new THREE.Group();
  const y = def.y ?? 0;
  const width = def.max[0] - def.min[0];
  const depth = def.max[1] - def.min[1];
  const cx = (def.min[0] + def.max[0]) / 2;
  const cz = (def.min[1] + def.max[1]) / 2;

  const tint = decal(new THREE.PlaneGeometry(width, depth), glow(ECHO_TINT, 0.16), y + 0.011);
  tint.position.x = cx;
  tint.position.z = cz;
  group.add(tint);
  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(def.min[0], y + 0.02, def.min[1]),
      new THREE.Vector3(def.max[0], y + 0.02, def.min[1]),
      new THREE.Vector3(def.max[0], y + 0.02, def.max[1]),
      new THREE.Vector3(def.min[0], y + 0.02, def.max[1]),
    ]),
    new THREE.LineBasicMaterial({ color: 0xe0f8ff, transparent: true, opacity: 0.75 }),
  );
  group.add(outline);
  // Ripples: rings spreading out from points all over it, each a little out of step with the next.
  const rippleMaterial = glow(0xffffff, 0.3);
  const rippleGeometry = new THREE.RingGeometry(0.88, 1, 28);
  const ripples: { mesh: THREE.Mesh; phase: number }[] = [];
  const cols = Math.max(1, Math.round(width / 1.5));
  const rows = Math.max(1, Math.round(depth / 1.5));
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const mesh = decal(rippleGeometry, rippleMaterial, y + 0.014);
      mesh.position.x = def.min[0] + ((col + 0.5) / cols) * width;
      mesh.position.z = def.min[1] + ((row + 0.5) / rows) * depth;
      group.add(mesh);
      ripples.push({ mesh, phase: ((col * 5 + row * 3) % 7) / 7 });
    }
  }
  const rippleReach = Math.min(0.62, width / cols / 2, depth / rows / 2);

  const dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.045, 8), glow(0xffffff, 0.55), PATH_DOTS);
  dots.count = 0;
  dots.frustumCulled = false;
  group.add(dots);
  const ball = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.1, 2),
    new THREE.MeshBasicMaterial({ color: ECHO_BALL, transparent: true, opacity: 0.6, depthWrite: false }),
  );
  const halo = decal(new THREE.RingGeometry(0.15, 0.2, 24), glow(ECHO_BALL, 0.7), 0);
  ball.visible = halo.visible = false;
  group.add(ball, halo);

  let drawn: Recording | null = null;
  const placing = new THREE.Object3D();
  placing.rotation.x = -Math.PI / 2;
  const drawPath = (rec: Recording | null): void => {
    drawn = rec;
    const n = rec?.at.length ?? 0;
    const step = Math.max(1, Math.ceil(n / PATH_DOTS));
    let count = 0;
    for (let i = 0; rec && i < n && count < PATH_DOTS; i += step) {
      placing.position.set(rec.x[i], y + 0.018, rec.z[i]);
      placing.updateMatrix();
      dots.setMatrixAt(count++, placing.matrix);
    }
    dots.count = count;
    dots.instanceMatrix.needsUpdate = true;
  };

  return {
    object: group,
    update(part, { alpha, time }) {
      const echo = part as Echo;
      if (echo.heard !== drawn) drawPath(echo.heard);
      for (const { mesh, phase } of ripples) {
        const u = (time * 0.35 + phase) % 1;
        mesh.scale.setScalar(Math.max(1e-3, rippleReach * (0.25 + 0.75 * u)));
      }
      rippleMaterial.opacity = 0.22 + 0.1 * Math.sin(time * 2.1);
      const now = echo.now;
      ball.visible = halo.visible = now !== null;
      if (!now) return;
      const was = echo.prev ?? now;
      ball.position.set(was.x + (now.x - was.x) * alpha, was.y + (now.y - was.y) * alpha, was.z + (now.z - was.z) * alpha);
      halo.position.set(ball.position.x, y + 0.02, ball.position.z);
      halo.scale.setScalar(1 + 0.18 * Math.sin(time * 9));
    },
  };
}

const SILVER = 0xd3dae3;
const SILVER_LIT = 0xffffff;

/**
 * An echo plate (SPEC v8 3.5): silver, with rings on its face like ripples on water, so
 * that it cannot be taken for a plate a ball can press. One that stays down once
 * pressed has a stud at its middle; one that must be stood on has none.
 */
export function echoPlateView(def: EchoPlateDef): PartPicture {
  const radius = def.radius ?? 0.45;
  const group = new THREE.Group();
  group.position.set(def.at[0], def.at[1], def.at[2]);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.86, radius * 0.86, 0.06, 32), lambert(SILVER, false));
  face.position.y = 0.035;
  face.receiveShadow = true;
  const rimMaterial = glow(SILVER);
  const rim = decal(new THREE.RingGeometry(radius * 0.86, radius, 36), rimMaterial, 0.012);
  const markMaterial = glow(0x7f8b99);
  const marks = new THREE.Group();
  for (const share of [0.62, 0.42]) marks.add(decal(new THREE.RingGeometry(radius * share - 0.025, radius * share, 32), markMaterial, 0));
  if (def.mode === 'latch') marks.add(decal(new THREE.CircleGeometry(radius * 0.14, 16), markMaterial, 0));
  group.add(face, rim, marks);
  const dim = new THREE.Color(0x7f8b99);
  const lit = new THREE.Color(0x35c9ff);
  let sunk = 0;
  return {
    object: group,
    update(part, { dt, time }) {
      const plate = part as EchoPlate;
      sunk = ease(sunk, plate.pressed || plate.on ? 1 : 0, 18, dt);
      face.position.y = 0.035 - sunk * 0.045;
      marks.position.y = face.position.y + 0.034;
      rimMaterial.color.setHex(plate.on ? SILVER_LIT : SILVER);
      markMaterial.color.copy(plate.on ? lit : dim);
      // A slow shimmer while it waits, so that it reads as something alive.
      rim.scale.setScalar(plate.on ? 1 : 1 + 0.02 * Math.sin(time * 3));
    },
  };
}
