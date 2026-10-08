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
      if (e.button !== 2) return;
      rightDrag = { id: e.pointerId, x: e.clientX };
      // Without capture a release over a HUD button never reaches the canvas, and the
      // camera would go on following the mouse with no button held.
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // Then the drag simply ends at the edge of the canvas.
      }
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
    // Down to two fingers again from three: start measuring afresh from where they
    // are now, or the first move would apply everything that happened in between.
    if (touches.size === 2) measure();
    if (rightDrag?.id === e.pointerId) rightDrag = null;
  };
  target.addEventListener('pointerup', release);
  target.addEventListener('pointercancel', release);
  target.addEventListener('lostpointercapture', release);
  // A release the page never sees (the window losing focus, the app being switched
  // away from mid-gesture) must not leave a finger or a button counted as held.
  const forget = () => {
    touches.clear();
    rightDrag = null;
  };
  window.addEventListener('blur', forget);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) forget();
  });

  target.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      camera.zoomBy(Math.exp(e.deltaY * 0.0015));
    },
    { passive: false },
  );
}
