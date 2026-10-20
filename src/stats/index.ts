// Public API of the statistics engine. Pure functions, no DOM, no network (AGENTS.md restriction 3).
import type {
  AnalysisInput,
  AnalysisResult,
  Fraction,
  GroupCount,
  Plan,
  PretestInput,
  PretestResult,
  RelativeLift,
  Settings,
} from "./types";

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

/** PRD sections 3 and 4. */
export function planPretest(_input: PretestInput, _settings: Settings): PretestResult {
  throw new Error("not implemented");
}

/** "Usar esse plano". selectedWeek picks the Mode A row (null = target-lift mode or last week). */
export function toPlan(
  _input: PretestInput,
  _result: Extract<PretestResult, { kind: "ok" }>,
  _selectedWeek: number | null,
  _now: Date,
): Plan {
  throw new Error("not implemented");
}

/** PRD sections 5 to 9. Deterministic: the same input always returns the same result. */
export function analyze(_input: AnalysisInput, _settings: Settings): AnalysisResult {
  throw new Error("not implemented");
}
