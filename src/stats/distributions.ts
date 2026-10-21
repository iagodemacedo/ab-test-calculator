// Densities behind the CR and lift charts (PRD section 10, DESIGN.md section 6), so the UI only
// plots. Values are rounded to keep the result small; the same input always gives the same numbers.
import { quantile, type BayesComparison } from "./bayes";
import { upperTail, zUpper } from "./normal";
import type { Distributions, GroupData, LiftDistributions, RateDistributions } from "./types";
import { rate, standardError } from "./ztest";

const RATE_POINTS = 120;
const LIFT_BINS = 60;
const SPAN_SDS = 4;
const LIFT_TRIM = 0.001;
const DENSITY_DIGITS = 4;
const AXIS_DIGITS = 6;

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

function round(x: number, digits: number): number {
  return Number(x.toPrecision(digits));
}

/** ln Gamma(x) for x >= 1 (Lanczos, g = 7), which always holds for a Beta(1, 1) posterior. */
function lgamma(x: number): number {
  const z = x - 1;
  const t = z + 7.5;
  let sum = LANCZOS[0]!;
  for (let i = 1; i < LANCZOS.length; i++) sum += LANCZOS[i]! / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

/** k * ln(x), with 0 * ln(0) = 0 so a Beta(1, b) density is finite at x = 0. */
function xlogy(k: number, x: number): number {
  return k === 0 ? 0 : k * Math.log(x);
}

function normalPdf(x: number, mean: number, sd: number): number {
  const u = (x - mean) / sd;
  return Math.exp(-0.5 * u * u) / (sd * Math.sqrt(2 * Math.PI));
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function rateDistributions(groups: readonly GroupData[], bayes: BayesComparison, confidence: number): RateDistributions {
  const zCrit = zUpper((1 - confidence) / 2);
  const posteriors = groups.map((g) => {
    const a = 1 + g.conversions;
    const b = 1 + g.users - g.conversions;
    const mean = a / (a + b);
    const sd = Math.sqrt((a * b) / ((a + b) * (a + b) * (a + b + 1)));
    return { a, b, mean, sd, logNorm: lgamma(a + b) - lgamma(a) - lgamma(b), cr: rate(g), se: standardError(g) };
  });
  let lo = 1;
  let hi = 0;
  for (const p of posteriors) {
    lo = Math.min(lo, p.mean - SPAN_SDS * p.sd, p.se > 0 ? p.cr - SPAN_SDS * p.se : 1);
    hi = Math.max(hi, p.mean + SPAN_SDS * p.sd, p.se > 0 ? p.cr + SPAN_SDS * p.se : 0);
  }
  lo = clamp01(lo);
  hi = clamp01(hi);
  const step = (hi - lo) / (RATE_POINTS - 1);
  const x = Array.from({ length: RATE_POINTS }, (_, i) => lo + i * step);
  return {
    x: x.map((v) => round(v, AXIS_DIGITS)),
    groups: groups.map((g, i) => {
      const p = posteriors[i]!;
      const credible = bayes.rateIntervals[i]!;
      return {
        id: g.id,
        ztest:
          p.se > 0
            ? {
                density: x.map((v) => round(normalPdf(v, p.cr, p.se), DENSITY_DIGITS)),
                interval: [round(clamp01(p.cr - zCrit * p.se), AXIS_DIGITS), round(clamp01(p.cr + zCrit * p.se), AXIS_DIGITS)],
              }
            : null,
        bayes: {
          density: x.map((v) => round(Math.exp(xlogy(p.a - 1, v) + xlogy(p.b - 1, 1 - v) + p.logNorm), DENSITY_DIGITS)),
          interval: [round(credible[0], AXIS_DIGITS), round(credible[1], AXIS_DIGITS)],
        },
      };
    }),
  };
}

interface Histogram {
  counts: number[];
  above: number; // draws > 0
}

// Its own function so the loop over the draws never shares a frame with the payload's object
// literals: V8 13.6 (Node 24) gave those literals one shared double box when its OSR code for
// such a frame deoptimized (nodejs/node#66457).
function histogram(draws: Float64Array, width: number, first: number, bins: number): Histogram {
  const counts = new Array<number>(bins).fill(0);
  let above = 0;
  for (let i = 0; i < draws.length; i++) {
    const d = draws[i]!;
    if (d > 0) above++;
    const bin = Math.floor(d / width) - first;
    if (bin >= 0 && bin < bins) counts[bin]!++;
  }
  return { counts, above };
}

function liftDistributions(groups: readonly GroupData[], bayes: BayesComparison): LiftDistributions {
  const control = groups[0]!;
  const pc = rate(control);
  // Normal approximation implied by the engine's own Z test: the relative lift is taken as
  // N(diff / pc, se / pc) with the unpooled se of the difference, treating the control rate as
  // known. It is the same approximation that turns ciAbsolute into ciRelative.
  const normals = groups.slice(1).map((g) => {
    const se = Math.hypot(standardError(control), standardError(g));
    return se > 0 ? { mean: (rate(g) - pc) / pc, sd: se / pc } : null;
  });
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  normals.forEach((n, v) => {
    // quantile reorders the draws, which the histogram below does not mind.
    const draws = bayes.relativeLifts[v]!;
    lo = Math.min(lo, quantile(draws, LIFT_TRIM), n ? n.mean - SPAN_SDS * n.sd : lo);
    hi = Math.max(hi, quantile(draws, 1 - LIFT_TRIM), n ? n.mean + SPAN_SDS * n.sd : hi);
  });
  // Edges sit on multiples of the width, so 0 is an edge and no bin straddles it.
  const width = (hi - lo) / LIFT_BINS;
  const first = Math.floor(lo / width);
  const bins = Math.ceil(hi / width) - first;
  const edges = Array.from({ length: bins + 1 }, (_, i) => (first + i) * width);
  return {
    edges: edges.map((e) => round(e, AXIS_DIGITS)),
    variants: groups.slice(1).map((g, v) => {
      const draws = bayes.relativeLifts[v]!;
      const { counts, above } = histogram(draws, width, first, bins);
      const n = normals[v];
      return {
        id: g.id,
        ztest: n
          ? {
              density: counts.map((_, i) => round(normalPdf((edges[i]! + edges[i + 1]!) / 2, n.mean, n.sd), DENSITY_DIGITS)),
              massAboveZero: upperTail(-n.mean / n.sd),
            }
          : null,
        bayes: {
          density: counts.map((c) => round(c / (draws.length * width), DENSITY_DIGITS)),
          massAboveZero: above / draws.length,
        },
      };
    }),
  };
}

export function distributions(groups: readonly GroupData[], bayes: BayesComparison, confidence: number): Distributions {
  return {
    rate: rateDistributions(groups, bayes, confidence),
    lift: rate(groups[0]!) > 0 ? liftDistributions(groups, bayes) : null,
  };
}
