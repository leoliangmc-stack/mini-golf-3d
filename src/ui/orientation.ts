/**
 * Whether the device is held upright, which is when the game shows its "rotate" notice
 * instead of the course. The device decides, not the window: a split-screen window on
 * a tablet held sideways is taller than it is wide, and the notice would lock the
 * player out with nothing to rotate. Older browsers without `screen.orientation` go by
 * the window, which on a phone is the same thing.
 */
const viewport = window.matchMedia('(orientation: portrait)');

function read(): boolean {
  const device = screen.orientation?.type;
  return device ? device.startsWith('portrait') : viewport.matches;
}

let portrait = read();
const listeners: (() => void)[] = [];

function update(): void {
  const now = read();
  if (now === portrait) return;
  portrait = now;
  document.body.toggleAttribute('data-portrait', portrait);
  for (const listener of listeners) listener();
}

document.body.toggleAttribute('data-portrait', portrait);
screen.orientation?.addEventListener('change', update);
viewport.addEventListener('change', update);

/** True while the device is upright and the course cannot be seen. */
export function isPortrait(): boolean {
  return portrait;
}

/** Calls back whenever `isPortrait` changes. */
export function onOrientationChange(listener: () => void): void {
  listeners.push(listener);
}
