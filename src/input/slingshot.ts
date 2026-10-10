/** A drag in screen pixels, turned into a pull direction and a power in 0..1. */
export interface Pull {
  /** Unit vector of the drag on screen (x right, y down). The shot goes the opposite way. */
  x: number;
  y: number;
  power: number;
}

/**
 * Input feel, mutable for tuning. A drag is full power at a fraction of the shorter screen
 * side, but never less than a fixed length so small phones keep some resolution. Where the
 * screen edge is closer than that, full power comes `edgeMarginPx` short of the edge
 * instead, though never in less than `minRoomFraction` of the usual length.
 */
export const INPUT = { fullDragFraction: 0.3, fullDragMinPx: 110, edgeMarginPx: 20, minRoomFraction: 0.35 };

/** How long a drag is full power when nothing is in the way. */
export function fullDragPx(width: number, height: number): number {
  return Math.max(INPUT.fullDragMinPx, INPUT.fullDragFraction * Math.min(width, height));
}

/**
 * How far a drag that starts at (x, y) and heads along (dx, dy) can go before the finger
 * comes within the edge margin of a width by height screen.
 */
export function dragRoom(x: number, y: number, dx: number, dy: number, width: number, height: number): number {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return Infinity;
  const margin = INPUT.edgeMarginPx;
  const along = (from: number, step: number, size: number) =>
    step > 0 ? (size - margin - from) / step : step < 0 ? (margin - from) / step : Infinity;
  return Math.max(0, Math.min(along(x, dx / len, width), along(y, dy / len, height)));
}

/**
 * Power grows with the length of the drag and is full at `fullPx`. With less room than
 * that (the camera parks the ball near the bottom edge, and a pull toward the cup heads
 * straight for it), full power lands where the room ends: gentle pulls keep their usual
 * rate and the missing length is made up toward the end.
 *
 * The first `deadPx` of a drag count for nothing: that is the distance a press may
 * waver and still be a tap (see `TAP`), and a drag only just past it must not play
 * the weakest stroke there is, which a thumb that meant to tap a wall would then do.
 */
export function dragToPull(dx: number, dy: number, fullPx: number, roomPx = fullPx, deadPx = 0): Pull {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 0, y: 0, power: 0 };
  const pulled = Math.max(0, len - deadPx);
  const full = fullPx - deadPx;
  // The floor keeps a twitch right at the edge from being a full shot.
  const reach = Math.min(full, Math.max(roomPx - deadPx, INPUT.minRoomFraction * full));
  const t = pulled / reach;
  const power = t >= 1 ? 1 : pulled / full + (1 - reach / full) * t * t;
  return { x: dx / len, y: dy / len, power };
}

export interface SlingshotHandlers {
  /** Whether a new aim may start right now. */
  canAim(): boolean;
  /** Called while dragging, and with null when the aim ends or is cancelled. */
  onAim(pull: Pull | null): void;
  onRelease(pull: Pull): void;
  /**
   * A press and release on the spot: not a stroke. Used to pick a ball (SPEC v3 2.4)
   * and to turn a wall group (SPEC v7 3.5). `quick` is false for a press that was held:
   * that is still no stroke, but neither is it someone tapping a thing on purpose.
   */
  onTap?(x: number, y: number, quick: boolean): void;
}

/**
 * Input feel for telling a tap from a drag, mutable for tuning (SPEC v7 7.5).
 *
 * A press that never moves further than the slop is no stroke, however long it is
 * held: a finger that only wavers in place must not play one of nearly no power. It is
 * a tap, something done on purpose to a thing on the course, only if it also ends
 * within `maxMs`: a finger that came down to aim and thought better of it is neither.
 * A finger gets more slop than a mouse: its pad rolls on the glass as it presses.
 */
export const TAP = { slopPx: 10, touchSlopPx: 16, maxMs: 350 };

/** How far a press of this kind may wander and still be a tap. */
export function slopFor(pointerType: string): number {
  return pointerType === 'mouse' ? TAP.slopPx : TAP.touchSlopPx;
}

/**
 * What a press that has ended was (SPEC v7 3.5). `farPx` is the furthest it ever got
 * from where it came down, not where it ended: a drag that comes back to its start is
 * still a drag. Mouse, touch and pen are all judged by this one rule.
 *
 * - `drag`: an aim. Releasing it plays a stroke, if it has the power.
 * - `tap`: quick and on the spot. Never a stroke.
 * - `hold`: on the spot but not quick. Neither a stroke nor a tap.
 */
export function classifyPress(farPx: number, heldMs: number, slopPx = TAP.slopPx): 'tap' | 'hold' | 'drag' {
  if (farPx > slopPx) return 'drag';
  return heldMs <= TAP.maxMs ? 'tap' : 'hold';
}

/**
 * Slingshot aiming: press anywhere, drag back, release to shoot. Mouse, touch and pen
 * all arrive as Pointer Events, so there is a single code path for every device.
 */
export function attachSlingshot(target: HTMLElement, handlers: SlingshotHandlers): () => void {
  const active = new Set<number>();
  /** The press that may become an aim. `aiming` is set once it has moved past its slop. */
  let press: { id: number; x: number; y: number; far: number; at: number; slop: number; aiming: boolean } | null = null;

  const pullTo = (from: { x: number; y: number; slop: number }, e: PointerEvent): Pull => {
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    const { innerWidth: width, innerHeight: height } = window;
    return dragToPull(dx, dy, fullDragPx(width, height), dragRoom(from.x, from.y, dx, dy, width, height), from.slop);
  };

  const cancel = () => {
    if (!press) return;
    const wasAiming = press.aiming;
    press = null;
    if (wasAiming) handlers.onAim(null);
  };

  const onDown = (e: PointerEvent) => {
    active.add(e.pointerId);
    // A second finger means a camera gesture, not a shot.
    if (active.size > 1) return cancel();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!handlers.canAim()) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, far: 0, at: e.timeStamp, slop: slopFor(e.pointerType), aiming: false };
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety (keeps the drag alive outside the canvas); aiming works without it.
    }
    // The aim itself waits for the finger to move: a tap, and the first finger of a
    // two-finger camera gesture, must not flash the power bar or cut a showcase short.
  };

  const onMove = (e: PointerEvent) => {
    if (press?.id !== e.pointerId) return;
    press.far = Math.max(press.far, Math.hypot(e.clientX - press.x, e.clientY - press.y));
    if (press.far <= press.slop && !press.aiming) return;
    press.aiming = true;
    handlers.onAim(pullTo(press, e));
  };

  const onUp = (e: PointerEvent) => {
    active.delete(e.pointerId);
    if (press?.id !== e.pointerId) return;
    const pull = pullTo(press, e);
    const far = Math.max(press.far, Math.hypot(e.clientX - press.x, e.clientY - press.y));
    const kind = classifyPress(far, e.timeStamp - press.at, press.slop);
    const wasAiming = press.aiming;
    press = null;
    if (wasAiming) handlers.onAim(null);
    // A press on the spot is never a stroke, however it is read: picking a ball or
    // turning a wall must not play one. And a drag is never a tap.
    if (kind === 'drag') handlers.onRelease(pull);
    else handlers.onTap?.(e.clientX, e.clientY, kind === 'tap');
  };

  const onCancel = (e: PointerEvent) => {
    active.delete(e.pointerId);
    if (press?.id === e.pointerId) cancel();
  };

  // A release the page never sees (the window losing focus, the app being switched
  // away from under a finger) would otherwise leave a ghost pointer in `active`, and
  // every press after it would count as a second finger: no stroke could be played.
  const forget = () => {
    active.clear();
    cancel();
  };
  const onHidden = () => {
    if (document.hidden) forget();
  };
  // The screen turning under a finger, or a split-screen window changing shape, ends
  // the drag: a release that arrives after the course has gone must not play a stroke
  // nobody saw.
  const upright = window.matchMedia('(orientation: portrait)');

  const block = (e: Event) => e.preventDefault();

  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', onUp);
  target.addEventListener('pointercancel', onCancel);
  target.addEventListener('lostpointercapture', onCancel);
  target.addEventListener('contextmenu', block);
  window.addEventListener('blur', forget);
  document.addEventListener('visibilitychange', onHidden);
  upright.addEventListener('change', forget);
  // iOS Safari ignores user-scalable=no; these stop pinch and double-tap zoom.
  document.addEventListener('gesturestart', block);
  document.addEventListener('dblclick', block);

  return () => {
    target.removeEventListener('pointerdown', onDown);
    target.removeEventListener('pointermove', onMove);
    target.removeEventListener('pointerup', onUp);
    target.removeEventListener('pointercancel', onCancel);
    target.removeEventListener('lostpointercapture', onCancel);
    target.removeEventListener('contextmenu', block);
    window.removeEventListener('blur', forget);
    document.removeEventListener('visibilitychange', onHidden);
    upright.removeEventListener('change', forget);
    document.removeEventListener('gesturestart', block);
    document.removeEventListener('dblclick', block);
  };
}
