// Two-proportion Z test with unpooled standard errors, as in ABTestGuide (PRD section 6).
import { normalCdf, upperTail } from "./normal";
import { zCritical } from "./sample-size";
import type { Hypothesis, ZTestResult } from "./types";

export interface Counts {
  users: number;
  conversions: number;
}

export function rate(g: Counts): number {
  return g.conversions / g.users;
}

export function standardError(g: Counts): number {
  const p = rate(g);
  return Math.sqrt((p * (1 - p)) / g.users);
}

function zScore(diff: number, se: number): number {
  if (se > 0) return diff / se;
  // Both groups at 0% or 100%: no sampling noise left, so the difference is either nothing or certain.
  return diff === 0 ? 0 : Math.sign(diff) * Number.POSITIVE_INFINITY;
}

export function zTest(control: Counts, variant: Counts, alpha: number, hypothesis: Hypothesis): ZTestResult {
  const pc = rate(control);
  const diff = rate(variant) - pc;
  const se = Math.hypot(standardError(control), standardError(variant));
  const z = zScore(diff, se);
  const twoSided = hypothesis === "two-sided";
  const pValue = twoSided ? 2 * upperTail(Math.abs(z)) : upperTail(z);
  const zCrit = zCritical(alpha, hypothesis);
  const ciAbsolute: [number, number] = twoSided
    ? [diff - zCrit * se, diff + zCrit * se]
    : [diff - zCrit * se, Number.POSITIVE_INFINITY];
  return {
    lift: pc > 0 ? diff / pc : null,
    absoluteDiff: diff,
    z,
    pValue,
    significant: pValue < alpha,
    ciAbsolute,
    ciRelative: pc > 0 ? [ciAbsolute[0] / pc, ciAbsolute[1] / pc] : null,
    observedPower: normalCdf(Math.abs(z) - zCrit),
  };
}
