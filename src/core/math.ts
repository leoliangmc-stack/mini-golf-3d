/**
 * Math for the simulation.
 *
 * JavaScript leaves the accuracy of Math.sin, Math.cos, Math.atan2, Math.hypot and `**`
 * to the engine, and engines do differ in the last bit. A replay must not (SPEC v3 3):
 * the same inputs have to end in the same place in Node and in every browser.
 * Everything here is built from + - * / and Math.sqrt, which IEEE 754 pins down exactly.
 *
 * Simulation code (core/, physics/, game/, level/) uses these and never the functions
 * above; tests/determinism.test.ts enforces it. Drawing and sound may use Math freely.
 */

/** pi/2 split in two, so that subtracting a multiple of it loses nothing. */
const HALF_PI_HIGH = 1.5707963267341256;
const HALF_PI_LOW = 6.077100506506192e-11;
const TWO_OVER_PI = 0.6366197723675814;

/** sin on [-pi/4, pi/4]. */
function sinKernel(x: number): number {
  const z = x * x;
  const tail =
    -1.66666666666666324348e-1 +
    z *
      (8.33333333332248946124e-3 +
        z *
          (-1.98412698298579493134e-4 +
            z * (2.75573137070700676789e-6 + z * (-2.50507602534068634195e-8 + z * 1.58969099521155010221e-10))));
  return x + x * z * tail;
}

/** cos on [-pi/4, pi/4]. */
function cosKernel(x: number): number {
  const z = x * x;
  const tail =
    4.16666666666666019037e-2 +
    z *
      (-1.38888888888741095749e-3 +
        z *
          (2.48015872894767294178e-5 +
            z * (-2.75573143513906633035e-7 + z * (2.0875723212981748279e-9 + z * -1.13596475577881948265e-11))));
  return 1 - 0.5 * z + z * z * tail;
}

/** Splits an angle into a quarter turn count and a remainder in [-pi/4, pi/4]. */
function reduce(x: number): { rest: number; quarter: number } {
  const turns = Math.round(x * TWO_OVER_PI);
  return { rest: x - turns * HALF_PI_HIGH - turns * HALF_PI_LOW, quarter: ((turns % 4) + 4) % 4 };
}

/** Sine of an angle in radians. Meant for the angles a game has: up to a few hundred turns. */
export function sin(x: number): number {
  const { rest, quarter } = reduce(x);
  if (quarter === 0) return sinKernel(rest);
  if (quarter === 1) return cosKernel(rest);
  if (quarter === 2) return -sinKernel(rest);
  return -cosKernel(rest);
}

/** Cosine of an angle in radians. */
export function cos(x: number): number {
  const { rest, quarter } = reduce(x);
  if (quarter === 0) return cosKernel(rest);
  if (quarter === 1) return -sinKernel(rest);
  if (quarter === 2) return -cosKernel(rest);
  return sinKernel(rest);
}

/** Length of a vector. */
export function hypot(x: number, y: number, z = 0): number {
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Sine and cosine of half an angle, from the sine and cosine of the whole angle
 * (-pi..pi). Lets a rotation be built from a direction without an arctangent.
 */
export function halfAngle(sinFull: number, cosFull: number): { sin: number; cos: number } {
  if (cosFull >= 0) {
    const c = Math.sqrt((1 + cosFull) / 2);
    return { sin: sinFull / (2 * c), cos: c };
  }
  const s = (sinFull >= 0 ? 1 : -1) * Math.sqrt((1 - cosFull) / 2);
  return { sin: s, cos: sinFull / (2 * s) };
}
