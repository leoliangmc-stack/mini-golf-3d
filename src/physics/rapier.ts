import RAPIER from '@dimforge/rapier3d-deterministic-compat';

let ready: Promise<void> | null = null;

/** Loads the Rapier WASM module. Safe to call more than once. */
export function initPhysics(): Promise<void> {
  return (ready ??= RAPIER.init());
}

export { RAPIER };
