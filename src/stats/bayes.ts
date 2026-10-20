// Bayesian comparison with a Beta(1, 1) prior, by Monte Carlo (PRD section 7).
// Beta draws are X / (X + Y) with gamma variates from Marsaglia-Tsang; the uniform source is
// sfc32 seeded with the posterior hash, so the same counts always give the same numbers.
import type { Hash128 } from "./hash";
import type { BayesResult } from "./types";
import type { Counts } from "./ztest";

const DRAWS = 50_000;

type Uniform = () => number;

function sfc32([s0, s1, s2, s3]: Hash128): Uniform {
  let a = s0 | 0;
  let b = s1 | 0;
  let c = s2 | 0;
  let d = s3 | 0;
  const next: Uniform = () => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return ((t >>> 0) + 0.5) / 4294967296;
  };
  for (let i = 0; i < 15; i++) next();
  return next;
}

function normalSource(uniform: Uniform): () => number {
  let spare = Number.NaN;
  return () => {
    if (!Number.isNaN(spare)) {
      const z = spare;
      spare = Number.NaN;
      return z;
    }
    let u: number;
    let v: number;
    let s: number;
    do {
      u = 2 * uniform() - 1;
      v = 2 * uniform() - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * f;
    return u * f;
  };
}

/** Gamma(shape, 1) for shape >= 1, which always holds under a Beta(1, 1) prior. */
function gammaSampler(uniform: Uniform, normal: () => number): (shape: number) => number {
  return (shape) => {
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      const x = normal();
      let v = 1 + c * x;
      if (v <= 0) continue;
      v = v * v * v;
      const u = uniform();
      const x2 = x * x;
      if (u < 1 - 0.0331 * x2 * x2) return d * v;
      if (Math.log(u) < 0.5 * x2 + d * (1 - v + Math.log(v))) return d * v;
    }
  };
}

/** Hoare quickselect: afterwards a[k] holds the k-th smallest value and a[k+1..] are >= it. */
function select(a: Float64Array, k: number): number {
  let lo = 0;
  let hi = a.length - 1;
  while (hi > lo) {
    const pivot = a[(lo + hi) >> 1]!;
    let i = lo;
    let j = hi;
    while (i <= j) {
      while (a[i]! < pivot) i++;
      while (a[j]! > pivot) j--;
      if (i <= j) {
        const tmp = a[i]!;
        a[i] = a[j]!;
        a[j] = tmp;
        i++;
        j--;
      }
    }
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else break;
  }
  return a[k]!;
}

/** Type 7 quantile (linear interpolation between order statistics), without a full sort. */
function quantile(values: Float64Array, q: number): number {
  const h = (values.length - 1) * q;
  const lo = Math.floor(h);
  const below = select(values, lo);
  if (lo + 1 >= values.length) return below;
  let above = Number.POSITIVE_INFINITY;
  for (let i = lo + 1; i < values.length; i++) if (values[i]! < above) above = values[i]!;
  return below + (h - lo) * (above - below);
}

/** One BayesResult per variant (groups[1..]); groups[0] is the control. */
export function compareBayes(groups: readonly Counts[], seed: Hash128, confidence: number): BayesResult[] {
  const uniform = sfc32(seed);
  const gamma = gammaSampler(uniform, normalSource(uniform));
  const draws = groups.map((g) => {
    const alpha = 1 + g.conversions;
    const beta = 1 + g.users - g.conversions;
    const out = new Float64Array(DRAWS);
    for (let i = 0; i < DRAWS; i++) {
      const x = gamma(alpha);
      out[i] = x / (x + gamma(beta));
    }
    return out;
  });

  const bestCount = new Array<number>(groups.length).fill(0);
  for (let i = 0; i < DRAWS; i++) {
    let best = 0;
    for (let g = 1; g < groups.length; g++) if (draws[g]![i]! > draws[best]![i]!) best = g;
    bestCount[best]!++;
  }

  const control = draws[0]!;
  const controlRate = groups[0]!.conversions / groups[0]!.users;
  const tail = (1 - confidence) / 2;
  return draws.slice(1).map((variant, v) => {
    let wins = 0;
    let loss = 0;
    const lift = new Float64Array(DRAWS);
    for (let i = 0; i < DRAWS; i++) {
      const c = control[i]!;
      const x = variant[i]!;
      if (x > c) wins++;
      else loss += c - x;
      lift[i] = (x - c) / c;
    }
    const expectedLossAbsolute = loss / DRAWS;
    return {
      probabilityToBeatControl: wins / DRAWS,
      probabilityToBeBest: bestCount[v + 1]! / DRAWS,
      expectedLossAbsolute,
      expectedLossRelative: controlRate > 0 ? expectedLossAbsolute / controlRate : null,
      credibleIntervalRelative: controlRate > 0 ? [quantile(lift, tail), quantile(lift, 1 - tail)] : null,
    };
  });
}
