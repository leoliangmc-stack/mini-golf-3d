/** Physics step length in seconds. All gameplay time is counted in ticks of this size. */
export const FIXED_DT = 1 / 60;

const MAX_STEPS_PER_FRAME = 5;

/**
 * Fixed-step loop: `step` runs zero or more times per frame at exactly FIXED_DT,
 * `render` runs once with the interpolation factor between the last two steps.
 * Returns a function that stops the loop.
 */
export function startLoop(
  step: () => void,
  render: (alpha: number, frameDt: number) => void,
): () => void {
  let last = performance.now();
  let acc = 0;
  let raf = 0;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, 0.25);
    last = now;
    // After a long stall, drop the backlog instead of fast-forwarding the simulation.
    acc = Math.min(acc + frameDt, MAX_STEPS_PER_FRAME * FIXED_DT);
    while (acc >= FIXED_DT) {
      step();
      acc -= FIXED_DT;
    }
    render(acc / FIXED_DT, frameDt);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
