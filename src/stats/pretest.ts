// Pre-test planning (PRD sections 3 and 4): MDE by week (Mode A), sample and duration for a
// target lift (Mode B), the sequential design for the planned looks, and the plan handed over
// to the analysis tab.
import { maxLift, minimumDetectableEffect, sampleSize, testDesign } from "./sample-size";
import type { TestDesign } from "./sample-size";
import { nominalP, obfDesign } from "./sequential";
import type {
  LookPlan,
  Plan,
  PretestAlert,
  PretestInput,
  PretestResult,
  RelativeLift,
  SequentialDesign,
  Settings,
  WeekRow,
} from "./types";

const MDE_ALERT = 0.1;
const DAYS_PER_WEEK = 7;
const MAX_WEEKS = 12;

/**
 * Round up, ignoring floating-point noise: a sample that is exactly w weeks of traffic can
 * come out as 21.000000000000004 days, which must stay 21 for Mode A and Mode B to agree.
 */
function ceilExact(x: number): number {
  return Math.ceil(x * (1 - 1e-12));
}

function dailyVisitorsInTest(input: PretestInput): number {
  return (input.weeklyTraffic / DAYS_PER_WEEK) * input.trafficShare;
}

function durationDays(samplePerVariant: number, input: PretestInput): number {
  return ceilExact((samplePerVariant * input.groups) / dailyVisitorsInTest(input));
}

function lookCount(looks: LookPlan, planWeeks: number): number {
  switch (looks.kind) {
    case "single":
      return 1;
    case "weekly":
      return planWeeks;
    case "fixed":
      return looks.count;
  }
}

function sequentialDesign(looks: number, fixedSample: number, design: TestDesign): SequentialDesign | null {
  if (looks < 2 || !Number.isFinite(fixedSample)) return null;
  const obf = obfDesign(looks, design);
  const max = fixedSample * obf.inflationFactor;
  return {
    looks,
    inflationFactor: obf.inflationFactor,
    maxSamplePerVariant: ceilExact(max),
    boundaries: obf.fractions.map((t, k) => ({
      look: k + 1,
      informationFraction: t,
      visitorsPerVariant: ceilExact(max * t),
      zBoundary: obf.boundaries[k]!,
      nominalP: nominalP(obf.boundaries[k]!, design.hypothesis),
    })),
  };
}

export function planPretest(input: PretestInput, settings: Settings): PretestResult {
  if (!(input.weeklyConversions > 0)) return { kind: "invalid", reason: "no-conversions" };
  const p = input.weeklyConversions / input.weeklyTraffic;
  if (input.mode === "target-lift" && input.targetLift > maxLift(p)) return { kind: "invalid", reason: "lift-exceeds-100-percent" };

  const design = testDesign(settings, input.groups);
  const weeklyPerVariant = (input.weeklyTraffic * input.trafficShare) / input.groups;
  const weeks: WeekRow[] = Array.from({ length: input.horizonWeeks }, (_, i) => {
    const visitorsPerVariant = weeklyPerVariant * (i + 1);
    const mde = minimumDetectableEffect(p, visitorsPerVariant, design);
    return {
      week: i + 1,
      visitorsPerVariant,
      mdeRelative: mde as RelativeLift,
      mdeAbsolute: mde * p,
      aboveMdeAlert: mde > MDE_ALERT,
    };
  });

  const n = sampleSize(p, input.targetLift, design);
  const days = durationDays(n, input);
  const targetLift = {
    samplePerVariant: ceilExact(n),
    totalSample: ceilExact(n) * input.groups,
    days,
    weeks: days / DAYS_PER_WEEK,
  };

  const modeA = input.mode === "mde-by-week";
  const planWeeks = modeA ? input.horizonWeeks : Math.ceil(days / DAYS_PER_WEEK);
  const fixedSample = modeA ? weeks[weeks.length - 1]!.visitorsPerVariant : n;

  const alerts: PretestAlert[] = [];
  if (modeA && weeks.every((w) => w.aboveMdeAlert)) alerts.push({ kind: "all-weeks-above-mde" });
  if (!modeA && days > MAX_WEEKS * DAYS_PER_WEEK) alerts.push({ kind: "duration-over-12-weeks", days });
  if (!modeA && days < DAYS_PER_WEEK) alerts.push({ kind: "duration-under-7-days", days });

  return {
    kind: "ok",
    settings,
    baselineRate: p,
    alpha: design.alpha,
    weeks,
    targetLift,
    sequential: sequentialDesign(lookCount(input.looks, planWeeks), fixedSample, design),
    alerts,
  };
}

/** "Usar esse plano". selectedWeek picks the Mode A row (null = target-lift mode or last week). */
export function toPlan(
  input: PretestInput,
  result: Extract<PretestResult, { kind: "ok" }>,
  selectedWeek: number | null,
  now: Date,
): Plan {
  const design = testDesign(result.settings, input.groups);
  let referenceLift: RelativeLift;
  let fixedSample: number;
  let planWeeks: number;
  if (input.mode === "mde-by-week") {
    const week = selectedWeek !== null && selectedWeek >= 1 && selectedWeek <= result.weeks.length ? selectedWeek : result.weeks.length;
    const row = result.weeks[week - 1]!;
    referenceLift = row.mdeRelative;
    fixedSample = row.visitorsPerVariant;
    planWeeks = week;
  } else {
    referenceLift = input.targetLift;
    fixedSample = sampleSize(result.baselineRate, input.targetLift, design);
    planWeeks = Math.ceil(result.targetLift.days / DAYS_PER_WEEK);
  }
  const looks = lookCount(input.looks, planWeeks);
  const inflation =
    looks < 2 ? 1 : result.sequential?.looks === looks ? result.sequential.inflationFactor : obfDesign(looks, design).inflationFactor;
  const maxSample = fixedSample * inflation;
  return {
    createdAt: now.toISOString(),
    groups: input.groups,
    trafficShare: input.trafficShare,
    referenceLift,
    samplePerVariant: ceilExact(maxSample),
    days: durationDays(maxSample, input),
    looks: Math.max(1, looks),
  };
}
