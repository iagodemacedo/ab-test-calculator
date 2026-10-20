import { describe, expect, it } from "vitest";
import { planPretest, toPlan } from "./index";
import { close, fraction, lift, okPlan, pretestFromReference, pretestInput, reference, settings } from "./__fixtures__/scenarios";

describe("pre-test against the independent reference", () => {
  for (const scenario of reference.pretest) {
    it(`${scenario.name}: Mode A rows, Mode B sample and duration, sequential design`, () => {
      const { input, settings: s } = pretestFromReference(scenario, "target-lift");
      const result = okPlan(planPretest(input, s));
      close(result.baselineRate, scenario.baselineRate, "baseline");
      close(result.alpha, scenario.alpha, "alpha");
      expect(result.weeks).toHaveLength(scenario.weeks.length);
      result.weeks.forEach((row, i) => {
        const expected = scenario.weeks[i]!;
        close(row.visitorsPerVariant, expected.visitorsPerVariant, `week ${row.week} visitors`);
        close(row.mdeRelative, expected.mdeRelative, `week ${row.week} MDE`, 1e-6);
        close(row.mdeAbsolute, expected.mdeAbsolute, `week ${row.week} MDE abs`, 1e-6);
      });
      expect(result.targetLift.samplePerVariant).toBe(scenario.targetLift.samplePerVariant);
      expect(result.targetLift.days).toBe(scenario.targetLift.days);

      const seq = result.sequential!;
      close(seq.inflationFactor, scenario.sequential.inflationFactor, "inflation", 1e-5);
      expect(seq.maxSamplePerVariant).toBe(scenario.sequential.maxSamplePerVariant);
      seq.boundaries.forEach((b, k) => {
        const expected = scenario.sequential.boundaries[k]!;
        close(b.informationFraction, expected.informationFraction, `look ${b.look} t`);
        close(b.zBoundary, expected.zBoundary, `look ${b.look} z`, 1e-5);
        close(b.nominalP, expected.nominalP, `look ${b.look} p`, 1e-4);
      });
      expect(toPlan(input, result, null, new Date(0)).days).toBe(scenario.sequential.planDays);
    });
  }

  it("matches the hand-derived PRD fixture: MDE 34.40/23.79/19.23/16.55%, 53211 per variant, 75 days", () => {
    const result = okPlan(planPretest(pretestInput(), settings()));
    expect(result.weeks.map((w) => (w.mdeRelative * 100).toFixed(2))).toEqual(["34.40", "23.79", "19.23", "16.55"]);
    expect(result.weeks.map((w) => w.visitorsPerVariant)).toEqual([5000, 10000, 15000, 20000]);
    expect(result.targetLift).toMatchObject({ samplePerVariant: 53211, totalSample: 106422, days: 75 });
  });
});

describe("Mode A and Mode B are exact inverses", () => {
  for (const groups of [2, 3, 5] as const) {
    for (const hypothesis of ["two-sided", "one-sided"] as const) {
      it(`${groups} groups, ${hypothesis}: the MDE of week w as a target lift needs w weeks`, () => {
        const s = settings({ hypothesis });
        const base = pretestInput({ groups, horizonWeeks: 12, weeklyTraffic: 23456, weeklyConversions: 789, trafficShare: fraction(0.7) });
        const modeA = okPlan(planPretest(base, s));
        for (const row of modeA.weeks) {
          const modeB = okPlan(planPretest({ ...base, mode: "target-lift", targetLift: lift(row.mdeRelative) }, s));
          expect(modeB.targetLift.days, `week ${row.week}`).toBe(row.week * 7);
          expect(modeB.targetLift.samplePerVariant, `week ${row.week}`).toBe(Math.ceil(row.visitorsPerVariant - 1e-9));
        }
      });
    }
  }

  it("the display-rounded MDE of week 4 (16.55%) sits just below the true MDE, so it needs one day more than 4 weeks", () => {
    const result = okPlan(planPretest(pretestInput({ mode: "target-lift", targetLift: lift(0.1655) }), settings()));
    expect(result.targetLift.samplePerVariant).toBeGreaterThanOrEqual(20000);
    expect(result.targetLift.days).toBe(29);
  });
});

describe("pre-test alerts (PRD section 3)", () => {
  it("warns when every week of the horizon is above 10% MDE, and not when one week is below", () => {
    const small = okPlan(planPretest(pretestInput(), settings()));
    expect(small.weeks.every((w) => w.aboveMdeAlert)).toBe(true);
    expect(small.alerts).toEqual([{ kind: "all-weeks-above-mde" }]);

    const large = okPlan(planPretest(pretestInput({ weeklyTraffic: 100000, weeklyConversions: 3000 }), settings()));
    expect(large.weeks.map((w) => w.aboveMdeAlert)).toEqual([true, false, false, false]);
    expect(large.alerts).toEqual([]);
  });

  it("flags Mode B durations over 12 weeks with the real number of days", () => {
    const result = okPlan(planPretest(pretestInput({ mode: "target-lift", targetLift: lift(0.05) }), settings()));
    expect(result.targetLift.days).toBeGreaterThan(84);
    expect(result.alerts).toEqual([{ kind: "duration-over-12-weeks", days: result.targetLift.days }]);
  });

  it("flags Mode B durations under 7 days, and stays silent at 75 days", () => {
    const short = okPlan(planPretest(pretestInput({ mode: "target-lift", targetLift: lift(0.5) }), settings()));
    expect(short.targetLift.days).toBeLessThan(7);
    expect(short.alerts).toEqual([{ kind: "duration-under-7-days", days: short.targetLift.days }]);
    expect(okPlan(planPretest(pretestInput({ mode: "target-lift" }), settings())).alerts).toEqual([]);
  });
});

describe("pre-test edge cases (PRD section 3)", () => {
  it("refuses to plan without conversions", () => {
    expect(planPretest(pretestInput({ weeklyConversions: 0 }), settings())).toEqual({ kind: "invalid", reason: "no-conversions" });
  });

  it("accepts a base rate of 50% or more up to the lift that keeps the variant at 100%", () => {
    const high = pretestInput({ weeklyTraffic: 1000, weeklyConversions: 600, mode: "target-lift" });
    expect(okPlan(planPretest({ ...high, targetLift: lift(0.6) }, settings())).targetLift.samplePerVariant).toBeGreaterThan(0);
    expect(okPlan(planPretest({ ...high, targetLift: lift(2 / 3) }, settings())).targetLift.days).toBeGreaterThan(0);
    expect(planPretest({ ...high, targetLift: lift(0.7) }, settings())).toEqual({ kind: "invalid", reason: "lift-exceeds-100-percent" });
  });

  it("keeps computing with under 10% of traffic, the duration scaling inversely", () => {
    const full = okPlan(planPretest(pretestInput({ mode: "target-lift" }), settings()));
    const tenth = okPlan(planPretest(pretestInput({ mode: "target-lift", trafficShare: fraction(0.05) }), settings()));
    expect(tenth.targetLift.samplePerVariant).toBe(full.targetLift.samplePerVariant);
    expect(tenth.targetLift.days).toBeGreaterThan(20 * (full.targetLift.days - 1));
    expect(tenth.targetLift.days).toBeLessThanOrEqual(20 * full.targetLift.days);
  });

  it("applies Bonferroni to the pre-test alpha with 3+ groups, only when on", () => {
    expect(okPlan(planPretest(pretestInput({ groups: 3 }), settings())).alpha).toBeCloseTo(0.025, 12);
    expect(okPlan(planPretest(pretestInput({ groups: 3 }), settings({ bonferroni: false }))).alpha).toBeCloseTo(0.05, 12);
    expect(okPlan(planPretest(pretestInput({ groups: 5 }), settings())).alpha).toBeCloseTo(0.0125, 12);
  });

  it("shows no sequential design for a single look and a weekly design with one row per week", () => {
    expect(okPlan(planPretest(pretestInput(), settings())).sequential).toBeNull();
    const weekly = okPlan(planPretest(pretestInput({ looks: { kind: "weekly" } }), settings())).sequential!;
    expect(weekly.looks).toBe(4);
    expect(weekly.boundaries.map((b) => b.visitorsPerVariant).at(-1)).toBe(weekly.maxSamplePerVariant);
    expect(weekly.maxSamplePerVariant).toBeGreaterThan(20000);
  });

  it("Mode B weekly looks are one per week of the plan, inflating the 53211 sample", () => {
    const weekly = okPlan(planPretest(pretestInput({ mode: "target-lift", looks: { kind: "weekly" } }), settings())).sequential!;
    expect(weekly.looks).toBe(11);
    expect(weekly.maxSamplePerVariant).toBeGreaterThan(53211);
  });
});

describe("Usar esse plano (toPlan)", () => {
  const now = new Date("2026-10-20T12:00:00Z");

  it("Mode B carries the target lift, sample, duration and look plan", () => {
    const input = pretestInput({ mode: "target-lift" });
    const plan = toPlan(input, okPlan(planPretest(input, settings())), null, now);
    expect(plan).toEqual({ createdAt: "2026-10-20T12:00:00.000Z", groups: 2, trafficShare: 1, referenceLift: 0.1, samplePerVariant: 53211, days: 75, looks: 1 });
  });

  it("Mode A uses the chosen week, defaulting to the last one", () => {
    const input = pretestInput();
    const result = okPlan(planPretest(input, settings()));
    const week2 = toPlan(input, result, 2, now);
    expect(week2).toMatchObject({ referenceLift: result.weeks[1]!.mdeRelative, samplePerVariant: 10000, days: 14, looks: 1 });
    expect(toPlan(input, result, null, now)).toMatchObject({ referenceLift: result.weeks[3]!.mdeRelative, samplePerVariant: 20000, days: 28 });
  });

  it("falls back to the last week when the chosen week left the horizon", () => {
    const input = pretestInput({ horizonWeeks: 3 });
    const result = okPlan(planPretest(input, settings()));
    expect(toPlan(input, result, 4, now)).toMatchObject({ referenceLift: result.weeks[2]!.mdeRelative, days: 21 });
  });

  it("inflates the sample for a sequential plan, matching the pre-test's maximum", () => {
    const input = pretestInput({ mode: "target-lift", looks: { kind: "fixed", count: 4 } });
    const result = okPlan(planPretest(input, settings()));
    const plan = toPlan(input, result, null, now);
    expect(plan.looks).toBe(4);
    expect(plan.samplePerVariant).toBe(result.sequential!.maxSamplePerVariant);
  });

  it("weekly looks in Mode A follow the chosen week, not the horizon", () => {
    const input = pretestInput({ looks: { kind: "weekly" } });
    const result = okPlan(planPretest(input, settings()));
    const plan = toPlan(input, result, 2, now);
    expect(plan.looks).toBe(2);
    const twoLooks = reference.obf.find((o) => o.hypothesis === "two-sided" && o.looks === 2)!;
    expect(plan.samplePerVariant).toBe(Math.ceil(10000 * twoLooks.inflationFactor["0.8"] - 1e-6));
  });
});
