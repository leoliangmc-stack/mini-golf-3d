import * as THREE from 'three';
import type { XYZ } from '../core/types';

const SECONDS = 0.6;

/** A short blast where the ball was: a fireball that swells and thins, and a ring racing out over the ground. */
export class Explosion {
  readonly object = new THREE.Group();
  private readonly fire = new THREE.MeshBasicMaterial({ color: 0xff8a2b, transparent: true, depthWrite: false });
  private readonly core = new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, depthWrite: false });
  private readonly shock = new THREE.MeshBasicMaterial({
    color: 0xffd08a,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  private readonly ball: THREE.Mesh;
  private readonly heart: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  /** 0..1 through the blast, or negative when there is none. */
  private age = -1;

  constructor() {
    this.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), this.fire);
    this.heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), this.core);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), this.shock);
    this.ring.rotation.x = -Math.PI / 2;
    this.object.add(this.ball, this.heart, this.ring);
    this.object.visible = false;
  }

  start(at: XYZ): void {
    this.object.position.set(at.x, at.y, at.z);
    this.object.visible = true;
    this.age = 0;
  }

  stop(): void {
    this.age = -1;
    this.object.visible = false;
  }

  update(frameDt: number): void {
    if (this.age < 0) return;
    this.age += frameDt / SECONDS;
    if (this.age >= 1) return this.stop();
    const out = 1 - (1 - this.age) ** 3;
    this.ball.scale.setScalar(0.2 + 1.3 * out);
    this.heart.scale.setScalar(0.2 + 0.9 * out);
    this.ring.scale.setScalar(0.3 + 3.2 * out);
    this.fire.opacity = 0.85 * (1 - this.age);
    this.core.opacity = 1 - this.age;
    this.shock.opacity = 0.7 * (1 - this.age);
  }
}
