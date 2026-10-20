// Group sequential design with Lan-DeMets O'Brien-Fleming alpha spending (PRD section 4).
//
// Spending follows gsDesign sfLDOF and ldbounds: a two-sided test of level alpha spends
// alpha/2 on each side, with alpha_side(t) = 2 - 2*Phi(z(1 - alpha_side/2) / sqrt(t)).
// Boundaries come from the Armitage-McPherson-Rowe recursion on the score scale
// S_k = Z_k * sqrt(t_k), integrated with Simpson's rule.
import { normalQuantile, upperTail, zUpper } from "./normal";
import type { TestDesign } from "./sample-size";
import type { Hypothesis } from "./types";

const NODES_PER_SD = 10;
const MASS_SDS = 8.5;

function sideAlpha(alpha: number, hypothesis: Hypothesis): number {
  return hypothesis === "two-sided" ? alpha / 2 : alpha;
}

/** Cumulative alpha spent by information fraction t, both sides together. */
function obfCumulativeSpend(alpha: number, hypothesis: Hypothesis, t: number): number {
  const side = sideAlpha(alpha, hypothesis);
  const perSide = 2 * upperTail(zUpper(side / 2) / Math.sqrt(t));
  return hypothesis === "two-sided" ? 2 * perSide : perSide;
}

export function nominalP(boundary: number, hypothesis: Hypothesis): number {
  return hypothesis === "two-sided" ? 2 * upperTail(boundary) : upperTail(boundary);
}

interface Crossing {
  upper: number;
  lower: number;
  /** d(upper + lower) / d(boundary), for Newton steps. */
  slope: number;
}

/**
 * Walks the looks in order. At each look `choose` receives the stopping probability as a
 * function of that look's boundary and returns the boundary to use; the walk then carries the
 * sub-density of the continuation region forward to the next look.
 */
function walk(
  t: readonly number[],
  hypothesis: Hypothesis,
  theta: number,
  choose: (k: number, crossing: (b: number) => Crossing) => number,
): void {
  const twoSided = hypothesis === "two-sided";
  let s = new Float64Array([0]);
  let mass = new Float64Array([1]);
  for (let k = 0; k < t.length; k++) {
    const tk = t[k]!;
    const d = tk - (k > 0 ? t[k - 1]! : 0);
    const sd = Math.sqrt(d);
    const drift = theta * d;
    const rootT = Math.sqrt(tk);
    const prevS = s;
    const prevMass = mass;
    const crossing = (b: number): Crossing => {
      const hi = b * rootT;
      let upper = 0;
      let lower = 0;
      let slope = 0;
      for (let i = 0; i < prevS.length; i++) {
        const w = prevMass[i]!;
        if (w === 0) continue;
        const xu = (hi - prevS[i]! - drift) / sd;
        upper += w * upperTail(xu);
        slope -= w * Math.exp(-0.5 * xu * xu);
        if (twoSided) {
          const xl = (hi + prevS[i]! + drift) / sd;
          lower += w * upperTail(xl);
          slope -= w * Math.exp(-0.5 * xl * xl);
        }
      }
      return { upper, lower, slope: (slope * rootT) / (sd * Math.sqrt(2 * Math.PI)) };
    };
    const b = choose(k, crossing);
    if (k + 1 === t.length) return;

    const center = theta * tk;
    const hi = Math.min(b * rootT, center + MASS_SDS * rootT);
    const lo = Math.max(twoSided ? -b * rootT : Number.NEGATIVE_INFINITY, center - MASS_SDS * rootT);
    const nextSd = Math.sqrt(t[k + 1]! - tk);
    const m0 = Math.max(2, Math.ceil(((hi - lo) * NODES_PER_SD) / Math.min(sd, nextSd)));
    const m = m0 + (m0 % 2);
    const h = (hi - lo) / m;
    const nextS = new Float64Array(m + 1);
    const density = new Float64Array(m + 1);
    for (let j = 0; j <= m; j++) nextS[j] = lo + j * h;

    // density(s_j) = sum_i mass_i * phi((s_j - mu_i) / sd) / sd. Along j the Gaussian obeys
    // phi(x + delta) = phi(x) * exp(-delta*x - delta^2/2), so one exp per source node suffices.
    const delta = h / sd;
    const shrink = Math.exp(-delta * delta);
    const reach = Math.ceil(MASS_SDS / delta);
    const norm = 1 / (sd * Math.sqrt(2 * Math.PI));
    for (let i = 0; i < prevS.length; i++) {
      const w = prevMass[i]! * norm;
      if (w === 0) continue;
      const mu = prevS[i]! + drift;
      const j0 = Math.min(m, Math.max(0, Math.round((mu - lo) / h)));
      const x0 = (nextS[j0]! - mu) / sd;
      const peak = w * Math.exp(-0.5 * x0 * x0);
      let value = peak;
      let ratio = Math.exp(-delta * x0 - (delta * delta) / 2);
      for (let j = j0; j <= Math.min(m, j0 + reach); j++) {
        density[j]! += value;
        value *= ratio;
        ratio *= shrink;
      }
      value = peak * Math.exp(delta * x0 - (delta * delta) / 2);
      ratio = Math.exp(delta * x0 - (delta * delta) / 2) * shrink;
      for (let j = j0 - 1; j >= Math.max(0, j0 - reach); j--) {
        density[j]! += value;
        value *= ratio;
        ratio *= shrink;
      }
    }
    const nextMass = new Float64Array(m + 1);
    for (let j = 0; j <= m; j++) {
      const simpson = j === 0 || j === m ? 1 : j % 2 === 1 ? 4 : 2;
      nextMass[j] = (simpson * h * density[j]!) / 3;
    }
    s = nextS;
    mass = nextMass;
  }
}

function solveBoundary(target: number, crossing: (b: number) => Crossing, guess: number): number {
  if (!(target > 0)) return Number.POSITIVE_INFINITY;
  let lo = 0;
  let hi = 40;
  let b = Math.min(hi, Math.max(lo, guess));
  for (let i = 0; i < 100; i++) {
    const c = crossing(b);
    const f = c.upper + c.lower - target;
    if (f > 0) lo = b;
    else hi = b;
    const newton = c.slope < 0 ? b - f / c.slope : Number.NaN;
    const next = newton > lo && newton < hi ? newton : (lo + hi) / 2;
    if (Math.abs(next - b) < 1e-12) return next;
    b = next;
  }
  return b;
}

/** Efficacy boundaries (|Z| for two-sided, Z for one-sided) for the given cumulative spend. */
function boundaries(t: readonly number[], cumulativeSpend: readonly number[], hypothesis: Hypothesis): number[] {
  const out: number[] = [];
  walk(t, hypothesis, 0, (k, crossing) => {
    const target = cumulativeSpend[k]! - (k > 0 ? cumulativeSpend[k - 1]! : 0);
    const guess = zUpper(hypothesis === "two-sided" ? target / 2 : target);
    const b = solveBoundary(target, crossing, guess);
    out.push(b);
    return b;
  });
  return out;
}

/** Probability of crossing an upper boundary at some look when the drift is theta. */
function rejectionProbability(t: readonly number[], b: readonly number[], hypothesis: Hypothesis, theta: number): number {
  let total = 0;
  walk(t, hypothesis, theta, (k, crossing) => {
    total += crossing(b[k]!).upper;
    return b[k]!;
  });
  return total;
}

/** Max sample of the sequential design over the fixed-sample size, at the requested power. */
function inflationFactor(t: readonly number[], b: readonly number[], design: TestDesign): number {
  const thetaFixed = zUpper(sideAlpha(design.alpha, design.hypothesis)) + normalQuantile(design.power);
  const f = (theta: number) => rejectionProbability(t, b, design.hypothesis, theta) - design.power;
  let x0 = thetaFixed;
  let x1 = thetaFixed * 1.02;
  let f0 = f(x0);
  let f1 = f(x1);
  for (let i = 0; i < 30 && Math.abs(x1 - x0) > 1e-10 && f1 !== f0; i++) {
    const x2 = x1 - (f1 * (x1 - x0)) / (f1 - f0);
    x0 = x1;
    f0 = f1;
    x1 = x2;
    f1 = f(x1);
  }
  return (x1 / thetaFixed) ** 2;
}

function equallySpaced(looks: number): number[] {
  return Array.from({ length: looks }, (_, j) => (j + 1) / looks);
}

export interface ObfDesign {
  fractions: number[];
  boundaries: number[];
  inflationFactor: number;
}

export function obfDesign(looks: number, design: TestDesign): ObfDesign {
  const fractions = equallySpaced(looks);
  const spend = fractions.map((t) => obfCumulativeSpend(design.alpha, design.hypothesis, t));
  const b = boundaries(fractions, spend, design.hypothesis);
  return { fractions, boundaries: b, inflationFactor: inflationFactor(fractions, b, design) };
}

/**
 * Boundary at look `look` of `plannedLooks` when the information reached so far is `fraction`
 * of the planned maximum. Earlier looks are taken as equally spaced up to now. The last planned
 * look, or any look at or past the maximum, is the final analysis and spends all remaining alpha.
 */
export function boundaryAtLook(
  look: number,
  plannedLooks: number,
  fraction: number,
  alpha: number,
  hypothesis: Hypothesis,
): { informationFraction: number; zBoundary: number; isFinal: boolean } {
  const informationFraction = Math.min(1, fraction);
  const isFinal = look >= plannedLooks || fraction >= 1;
  const k = Math.max(1, Math.min(look, plannedLooks));
  const t = Array.from({ length: k }, (_, j) => (informationFraction * (j + 1)) / k);
  const spend = t.map((x) => obfCumulativeSpend(alpha, hypothesis, x));
  if (isFinal) spend[k - 1] = alpha;
  const b = boundaries(t, spend, hypothesis);
  return { informationFraction, zBoundary: b[k - 1]!, isFinal };
}
