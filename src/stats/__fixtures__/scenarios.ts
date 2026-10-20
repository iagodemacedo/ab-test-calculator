// Test inputs. Reference scenarios come from reference.json (scripts/reference/generate.py), so
// the numbers a test feeds in and the numbers it expects share one source.
import { expect } from "vitest";
import { equalSplit, GROUP_IDS, toFraction, toLift } from "../index";
import type {
  AnalysisInput,
  AnalysisResult,
  Confidence,
  Fraction,
  GroupCount,
  Hypothesis,
  Power,
  PretestInput,
  PretestResult,
  RelativeLift,
  Settings,
} from "../index";
import data from "./reference.json";

export const reference = data;
export type AnalysisScenario = (typeof data.analysis)[number];
export type PretestScenario = (typeof data.pretest)[number];

export function fraction(x: number): Fraction {
  const f = toFraction(x);
  if (f === null) throw new Error(`not a fraction: ${x}`);
  return f;
}

export function lift(x: number): RelativeLift {
  const l = toLift(x);
  if (l === null) throw new Error(`not a lift: ${x}`);
  return l;
}

function groupCount(n: number): GroupCount {
  if (n === 2 || n === 3 || n === 4 || n === 5) return n;
  throw new Error(`unsupported group count: ${n}`);
}

export function settings(overrides: Partial<Settings> = {}): Settings {
  return { confidence: 0.95, power: 0.8, hypothesis: "two-sided", bonferroni: true, ...overrides };
}

function parseSettings(s: { confidence: number; power: number; hypothesis: string; bonferroni: boolean }): Settings {
  const confidence = ([0.9, 0.95, 0.99] as const).find((c) => c === s.confidence);
  const power = ([0.8, 0.9] as const).find((p) => p === s.power);
  const hypothesis = (["two-sided", "one-sided"] as const).find((h) => h === s.hypothesis);
  if (confidence === undefined || power === undefined || hypothesis === undefined) throw new Error("bad settings in reference.json");
  return { confidence: confidence satisfies Confidence, power: power satisfies Power, hypothesis: hypothesis satisfies Hypothesis, bonferroni: s.bonferroni };
}

/** groups: [users, conversions] per group, control first. */
export function analysisInput(groups: readonly (readonly [number, number])[], overrides: Partial<AnalysisInput> = {}): AnalysisInput {
  return {
    days: 14,
    trafficShare: fraction(1),
    groups: groups.map(([users, conversions], i) => ({
      id: GROUP_IDS[i]!,
      name: i === 0 ? "Controle" : `Variante ${GROUP_IDS[i]}`,
      users,
      conversions,
    })),
    intendedSplit: equalSplit(groupCount(groups.length)),
    method: "bayesian",
    sequential: { enabled: false },
    referenceLift: lift(0.1),
    plannedSamplePerVariant: null,
    revenue: null,
    ...overrides,
  };
}

export function fromReference(s: AnalysisScenario): { input: AnalysisInput; settings: Settings } {
  const seq = s.input.sequential;
  const revenue = s.input.revenue;
  const input = analysisInput(
    s.input.groups.map((g) => [g.users, g.conversions] as const),
    {
      days: s.input.days,
      trafficShare: fraction(s.input.trafficShare),
      intendedSplit: s.input.intendedSplit.map(fraction),
      referenceLift: lift(s.input.referenceLift),
      method: "ztest",
      sequential: seq ? { enabled: true, plannedLooks: seq[0]!, currentLook: seq[1]! } : { enabled: false },
      plannedSamplePerVariant: seq ? seq[2]! : null,
      revenue: revenue ? { valuePerConversion: revenue[0]!, currency: "BRL", horizonMonths: 6 } : null,
    },
  );
  return { input, settings: parseSettings(s.settings) };
}

export function pretestFromReference(s: PretestScenario, mode: PretestInput["mode"]): { input: PretestInput; settings: Settings } {
  return {
    input: {
      weeklyTraffic: s.input.weeklyTraffic,
      weeklyConversions: s.input.weeklyConversions,
      groups: groupCount(s.input.groups),
      trafficShare: fraction(s.input.trafficShare),
      horizonWeeks: s.input.horizonWeeks,
      mode,
      targetLift: lift(s.input.targetLift),
      looks: { kind: "fixed", count: s.input.looks },
    },
    settings: parseSettings(s.settings),
  };
}

export function pretestInput(overrides: Partial<PretestInput> = {}): PretestInput {
  return {
    weeklyTraffic: 10000,
    weeklyConversions: 300,
    groups: 2,
    trafficShare: fraction(1),
    horizonWeeks: 4,
    mode: "mde-by-week",
    targetLift: lift(0.1),
    looks: { kind: "single" },
    ...overrides,
  };
}

export function ok(result: AnalysisResult): Extract<AnalysisResult, { kind: "ok" }> {
  if (result.kind !== "ok") throw new Error(`expected an ok analysis, got ${result.kind}`);
  return result;
}

export function okPlan(result: PretestResult): Extract<PretestResult, { kind: "ok" }> {
  if (result.kind !== "ok") throw new Error(`expected an ok pre-test, got ${result.kind}: ${result.reason}`);
  return result;
}

/** |actual - expected| <= tolerance, with both numbers in the failure message. */
export function near(actual: number, expected: number, tolerance: number, label = ""): void {
  expect(Math.abs(actual - expected), `${label} actual ${actual} vs expected ${expected} (tolerance ${tolerance})`).toBeLessThanOrEqual(tolerance);
}

/** Relative closeness for deterministic quantities; reference.json keeps 10 significant digits. */
export function close(actual: number, expected: number, label = "", relative = 1e-7): void {
  near(actual, expected, Math.max(relative * Math.abs(expected), 1e-12), label);
}

/**
 * Monte Carlo tolerance for E[max(c - v, 0)]: only the share q = 1 - P(beat) of draws carries
 * loss, so the standard error is roughly loss * sqrt(2 / (q * draws)). Four of them, plus 2%.
 */
export function lossTolerance(loss: number, pBeat: number, draws = 50_000): number {
  const q = Math.max(1 - pBeat, 1 / draws);
  return 4 * loss * Math.sqrt(2 / (q * draws)) + 0.02 * loss + 1e-9;
}

/** Monte Carlo tolerance for a probability estimated from 50,000 draws: 4 standard errors. */
export function mcTolerance(p: number, draws = 50_000): number {
  return Math.max(4 * Math.sqrt((p * (1 - p)) / draws), 1e-3);
}
