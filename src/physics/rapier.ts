import RAPIER from '@dimforge/rapier3d-deterministic';

/**
 * The physics engine. Its WASM is a file of its own, fetched and compiled while this
 * module loads (vite-plugin-wasm), so by the time anything imports RAPIER it is ready:
 * a build that embedded it in the script as text was three quarters of the download,
 * could not be compiled while it was still arriving, and was fetched again by every
 * returning player whenever a line of the game changed. `initPhysics` stays as the one
 * place to wait on, should loading ever become a step again.
 */
export function initPhysics(): Promise<void> {
  return Promise.resolve();
}

export { RAPIER };
