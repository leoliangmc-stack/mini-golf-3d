/** The camera actions gestures can drive. */
export interface CameraControls {
  rotateBy(degrees: number): void;
  zoomBy(factor: number): void;
}

const DEG = 180 / Math.PI;

/**
 * Player camera control (SPEC 2.4): two fingers twist to rotate and pinch to zoom; on a
 * desktop, right-drag rotates and the wheel zooms. One finger or the left button is
 * always a stroke, handled elsewhere.
 */
export function attachCameraGestures(target: HTMLElement, camera: CameraControls): void {
  const touches = new Map<number, { x: number; y: number }>();
  let lastAngle = 0;
  let lastSpread = 0;
  let rightDrag: { id: number; x: number } | null = null;

  const measure = () => {
    const [a, b] = [...touches.values()];
    lastAngle = Math.atan2(b.y - a.y, b.x - a.x);
    lastSpread = Math.hypot(b.x - a.x, b.y - a.y);
  };

  target.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') {
      if (e.button === 2) rightDrag = { id: e.pointerId, x: e.clientX };
      return;
    }
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) measure();
  });

  target.addEventListener('pointermove', (e) => {
    if (rightDrag?.id === e.pointerId) {
      // Like turning a turntable by its near edge.
      camera.rotateBy(-(e.clientX - rightDrag.x) * 0.35);
      rightDrag.x = e.clientX;
      return;
    }
    const touch = touches.get(e.pointerId);
    if (!touch) return;
    touch.x = e.clientX;
    touch.y = e.clientY;
    if (touches.size !== 2) return;
    const previousAngle = lastAngle;
    const previousSpread = lastSpread;
    measure();
    let turned = lastAngle - previousAngle;
    if (turned > Math.PI) turned -= 2 * Math.PI;
    if (turned < -Math.PI) turned += 2 * Math.PI;
    camera.rotateBy(turned * DEG);
    if (lastSpread > 1) camera.zoomBy(previousSpread / lastSpread);
  });

  const release = (e: PointerEvent) => {
    touches.delete(e.pointerId);
    if (rightDrag?.id === e.pointerId) rightDrag = null;
  };
  target.addEventListener('pointerup', release);
  target.addEventListener('pointercancel', release);

  target.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      camera.zoomBy(Math.exp(e.deltaY * 0.0015));
    },
    { passive: false },
  );
}
