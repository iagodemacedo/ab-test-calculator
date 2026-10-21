// Public API of the statistics engine. Pure functions, no DOM, no network (AGENTS.md restriction 3).
import type { Fraction, GroupCount, RelativeLift } from "./types";

export * from "./types";

/** Boundary constructor: returns null unless 0 < x <= 1. */
export function toFraction(x: number): Fraction | null {
  return Number.isFinite(x) && x > 0 && x <= 1 ? (x as Fraction) : null;
}

/** Boundary constructor: returns null unless x > 0 and finite. */
export function toLift(x: number): RelativeLift | null {
  return Number.isFinite(x) && x > 0 ? (x as RelativeLift) : null;
}

export function equalSplit(groups: GroupCount): Fraction[] {
  return Array.from({ length: groups }, () => (1 / groups) as Fraction);
}

export { planPretest, toPlan } from "./pretest";
export { analyze } from "./analyze";
