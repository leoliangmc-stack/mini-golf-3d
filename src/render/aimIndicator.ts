import * as THREE from 'three';
import type { XYZ } from '../core/types';

const MIN_LENGTH = 0.45;
const MAX_LENGTH = 1.5;

/**
 * Marks the ball on the ground. Idle, a slow pulsing ring says "your turn" and makes a
 * small ball easy to find; while aiming, a short arrow shows shot direction only. The
 * arrow deliberately says nothing about bounces, slopes or force fields (SPEC 2.4).
 */
export class AimIndicator {
  readonly object = new THREE.Group();
  private readonly arrow = new THREE.Group();
  private readonly shaft: THREE.Mesh;
  private readonly head: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  private readonly ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  private pulse = 0;

  /** `tint`: one colour for the ring and the arrow both, for the indicator of a shadow ball (SPEC v8 3.4). */
  constructor(private readonly tint?: number) {
    if (tint !== undefined) {
      this.arrowMaterial.color.setHex(tint);
      this.arrowMaterial.opacity = 0.75;
      this.ringMaterial.color.setHex(tint);
    }
    this.shaft = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 1), this.arrowMaterial);
    this.head = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.26, 3), this.arrowMaterial);
    this.head.rotation.x = Math.PI / 2;
    this.arrow.add(this.shaft, this.head);

    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), this.ringMaterial);
    this.ring.rotation.x = -Math.PI / 2;

    this.object.add(this.arrow, this.ring);
    this.object.visible = false;
  }

  hide(): void {
    this.object.visible = false;
  }

  /** Idle state: a ring breathing around the ball. */
  showReady(ball: XYZ, ballRadius: number, frameDt: number): void {
    this.place(ball, ballRadius);
    this.arrow.visible = false;
    this.ring.visible = true;
    this.pulse = (this.pulse + frameDt * 0.9) % 1;
    const wave = 0.5 - 0.5 * Math.cos(this.pulse * Math.PI * 2);
    this.ring.scale.setScalar(ballRadius * (2.6 + 0.9 * wave));
    this.ringMaterial.opacity = 0.85 - 0.45 * wave;
  }

  showAim(ball: XYZ, dir: XYZ, power: number, ballRadius: number): void {
    this.place(ball, ballRadius);
    this.ring.visible = false;
    this.arrow.visible = true;
    const length = MIN_LENGTH + (MAX_LENGTH - MIN_LENGTH) * power;
    // Local +Z points along the shot.
    this.arrow.rotation.y = Math.atan2(dir.x, dir.z);
    const start = ballRadius * 1.6;
    this.shaft.scale.z = length;
    this.shaft.position.z = start + length / 2;
    this.head.position.z = start + length + 0.1;
    if (this.tint === undefined) this.arrowMaterial.color.setHSL(0.33 * (1 - power), 0.9, 0.62);
  }

  private place(ball: XYZ, ballRadius: number): void {
    this.object.visible = true;
    this.object.position.set(ball.x, ball.y - ballRadius + 0.03, ball.z);
  }
}
