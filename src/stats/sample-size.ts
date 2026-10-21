// Fixed-sample size of a two-proportion test and its inverse, the minimum detectable effect
// (PRD section 3). Both modes of the pre-test and the achieved MDE of the analysis use these.
import { normalQuantile, zUpper } from "./normal";
import type { Hypothesis, Power, Settings } from "./types";

/** Error rates a single comparison is designed for, alpha already Bonferroni-corrected. */
export interface TestDesign {
  alpha: number;
  power: Power;
  hypothesis: Hypothesis;
}

function effectiveAlpha(settings: Settings, groups: number): number {
  const alpha = 1 - settings.confidence;
  return settings.bonferroni && groups >= 3 ? alpha / (groups - 1) : alpha;
}

export function testDesign(settings: Settings, groups: number): TestDesign {
  return { alpha: effectiveAlpha(settings, groups), power: settings.power, hypothesis: settings.hypothesis };
}

export function zCritical(alpha: number, hypothesis: Hypothesis): number {
  return zUpper(hypothesis === "two-sided" ? alpha / 2 : alpha);
}

/** Largest relative lift that keeps the variant rate at or below 100%. */
export function maxLift(p: number): number {
  return 1 / p - 1;
}

/** Visitors per variant, unrounded. Infinite when the lift cannot be represented at rate p. */
export function sampleSize(p: number, lift: number, design: TestDesign): number {
  if (!(p > 0) || !(lift > 0) || lift > maxLift(p)) return Number.POSITIVE_INFINITY;
  const p1 = p;
  const p2 = p * (1 + lift);
  const pBar = (p1 + p2) / 2;
  const za = zCritical(design.alpha, design.hypothesis);
  const zb = normalQuantile(design.power);
  const root = za * Math.sqrt(2 * pBar * (1 - pBar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return (root * root) / ((p2 - p1) * (p2 - p1));
}

/**
 * The relative lift whose sample size is exactly n. Returns the side of the bracket whose
 * sample size does not exceed n, so feeding the MDE back into sampleSize never asks for more
 * visitors than n: that is what makes Mode A and Mode B exact inverses after rounding up.
 */
export function minimumDetectableEffect(p: number, n: number, design: TestDesign): number {
  if (!(p > 0) || !(p < 1) || !(n > 0)) return Number.POSITIVE_INFINITY;
  const top = maxLift(p);
  if (sampleSize(p, top, design) > n) return Number.POSITIVE_INFINITY;
  let lo = Math.log(1e-9);
  let hi = Math.log(top);
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (sampleSize(p, Math.exp(mid), design) > n) lo = mid;
    else hi = mid;
  }
  return Math.min(Math.exp(hi), top);
}
