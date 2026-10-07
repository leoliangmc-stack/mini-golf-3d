/** A drag in screen pixels, turned into a pull direction and a power in 0..1. */
export interface Pull {
  /** Unit vector of the drag on screen (x right, y down). The shot goes the opposite way. */
  x: number;
  y: number;
  power: number;
}

export function dragToPull(dx: number, dy: number, maxDragPx: number): Pull {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 0, y: 0, power: 0 };
  return { x: dx / len, y: dy / len, power: Math.min(1, len / maxDragPx) };
}

/**
 * How long a drag is full power: a fraction of the shorter screen side, but never
 * less than a fixed length so small phones keep some resolution. Mutable for tuning.
 */
export const INPUT = { fullDragFraction: 0.3, fullDragMinPx: 110 };

export interface SlingshotHandlers {
  /** Whether a new aim may start right now. */
  canAim(): boolean;
  /** Called while dragging, and with null when the aim ends or is cancelled. */
  onAim(pull: Pull | null): void;
  onRelease(pull: Pull): void;
}

/**
 * Slingshot aiming: press anywhere, drag back, release to shoot. Mouse, touch and pen
 * all arrive as Pointer Events, so there is a single code path for every device.
 */
export function attachSlingshot(target: HTMLElement, handlers: SlingshotHandlers): () => void {
  const active = new Set<number>();
  let aiming: { id: number; x: number; y: number } | null = null;

  const maxDrag = () =>
    Math.max(INPUT.fullDragMinPx, INPUT.fullDragFraction * Math.min(window.innerWidth, window.innerHeight));

  const cancel = () => {
    if (!aiming) return;
    aiming = null;
    handlers.onAim(null);
  };

  const onDown = (e: PointerEvent) => {
    active.add(e.pointerId);
    // A second finger means a camera gesture, not a shot.
    if (active.size > 1) return cancel();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!handlers.canAim()) return;
    aiming = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety (keeps the drag alive outside the canvas); aiming works without it.
    }
    handlers.onAim(dragToPull(0, 0, maxDrag()));
  };

  const onMove = (e: PointerEvent) => {
    if (aiming?.id !== e.pointerId) return;
    handlers.onAim(dragToPull(e.clientX - aiming.x, e.clientY - aiming.y, maxDrag()));
  };

  const onUp = (e: PointerEvent) => {
    active.delete(e.pointerId);
    if (aiming?.id !== e.pointerId) return;
    const pull = dragToPull(e.clientX - aiming.x, e.clientY - aiming.y, maxDrag());
    aiming = null;
    handlers.onAim(null);
    handlers.onRelease(pull);
  };

  const onCancel = (e: PointerEvent) => {
    active.delete(e.pointerId);
    if (aiming?.id === e.pointerId) cancel();
  };

  const block = (e: Event) => e.preventDefault();

  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', onUp);
  target.addEventListener('pointercancel', onCancel);
  target.addEventListener('contextmenu', block);
  // iOS Safari ignores user-scalable=no; these stop pinch and double-tap zoom.
  document.addEventListener('gesturestart', block);
  document.addEventListener('dblclick', block);

  return () => {
    target.removeEventListener('pointerdown', onDown);
    target.removeEventListener('pointermove', onMove);
    target.removeEventListener('pointerup', onUp);
    target.removeEventListener('pointercancel', onCancel);
    target.removeEventListener('contextmenu', block);
    document.removeEventListener('gesturestart', block);
    document.removeEventListener('dblclick', block);
  };
}
