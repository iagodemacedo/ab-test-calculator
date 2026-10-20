// Standard normal distribution: CDF (Hart 1968 / West 2005, double precision) and
// quantile (Acklam's rational approximation polished with one Halley step).

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/** P(Z > x), accurate far into the tail (needed for boundaries near z = 5). */
export function upperTail(x: number): number {
  const ax = Math.abs(x);
  let tail: number;
  if (ax > 37) {
    tail = 0;
  } else {
    const e = Math.exp(-0.5 * ax * ax);
    if (ax < 7.07106781186547) {
      let num = 3.52624965998911e-2 * ax + 0.700383064443688;
      num = num * ax + 6.37396220353165;
      num = num * ax + 33.912866078383;
      num = num * ax + 112.079291497871;
      num = num * ax + 221.213596169931;
      num = num * ax + 220.206867912376;
      let den = 8.83883476483184e-2 * ax + 1.75566716318264;
      den = den * ax + 16.064177579207;
      den = den * ax + 86.7807322029461;
      den = den * ax + 296.564248779674;
      den = den * ax + 637.333633378831;
      den = den * ax + 793.826512519948;
      den = den * ax + 440.413735824752;
      tail = (e * num) / den;
    } else {
      let den = ax + 0.65;
      den = ax + 4 / den;
      den = ax + 3 / den;
      den = ax + 2 / den;
      den = ax + 1 / den;
      tail = e / den / SQRT_2PI;
    }
  }
  return x >= 0 ? tail : 1 - tail;
}

export function normalCdf(x: number): number {
  return upperTail(-x);
}

const A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
const B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

function acklamLower(p: number): number {
  // Only called with p <= 0.5, so the upper-tail branch of Acklam's algorithm is not needed.
  if (p < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((C[0]! * q + C[1]!) * q + C[2]!) * q + C[3]!) * q + C[4]!) * q + C[5]!) /
      ((((D[0]! * q + D[1]!) * q + D[2]!) * q + D[3]!) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((A[0]! * r + A[1]!) * r + A[2]!) * r + A[3]!) * r + A[4]!) * r + A[5]!) * q) /
    (((((B[0]! * r + B[1]!) * r + B[2]!) * r + B[3]!) * r + B[4]!) * r + 1);
}

/** z with P(Z > z) = q. Works from the small tail so q = 1e-12 keeps full precision. */
export function zUpper(q: number): number {
  if (q <= 0) return Number.POSITIVE_INFINITY;
  if (q >= 1) return Number.NEGATIVE_INFINITY;
  const lower = Math.min(q, 1 - q);
  let x = acklamLower(lower);
  const e = normalCdf(x) - lower;
  const u = e * SQRT_2PI * Math.exp(0.5 * x * x);
  x -= u / (1 + (x * u) / 2);
  return q <= 0.5 ? -x : x;
}

export function normalQuantile(p: number): number {
  return -zUpper(p);
}
