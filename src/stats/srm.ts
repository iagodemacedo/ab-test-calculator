// Sample Ratio Mismatch: chi-square goodness of fit of observed users against the intended
// split, groups - 1 degrees of freedom (PRD section 8).
import { upperTail } from "./normal";

const SRM_THRESHOLD = 0.01;

/** P(X > x) for X ~ chi-square with integer df, in closed form. */
function chiSquareSurvival(x: number, df: number): number {
  if (!(x > 0)) return 1;
  const half = x / 2;
  const e = Math.exp(-half);
  if (df % 2 === 0) {
    let term = 1;
    let sum = 1;
    for (let i = 1; i < df / 2; i++) {
      term *= half / i;
      sum += term;
    }
    return e * sum;
  }
  let term = Math.sqrt(x) * Math.sqrt(2 / Math.PI);
  let sum = 0;
  for (let i = 1; i <= (df - 1) / 2; i++) {
    sum += term;
    term *= x / (2 * i + 1);
  }
  return 2 * upperTail(Math.sqrt(x)) + e * sum;
}

export function srm(users: readonly number[], split: readonly number[]): { chiSquare: number; pValue: number; mismatch: boolean } {
  const total = users.reduce((a, b) => a + b, 0);
  let chiSquare = 0;
  users.forEach((observed, i) => {
    const expected = total * split[i]!;
    chiSquare += ((observed - expected) * (observed - expected)) / expected;
  });
  const pValue = chiSquareSurvival(chiSquare, users.length - 1);
  return { chiSquare, pValue, mismatch: pValue < SRM_THRESHOLD };
}
