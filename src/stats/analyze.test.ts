import { describe, expect, it } from "vitest";
import { analyze } from "./index";
import type { Verdict } from "./index";
import { analysisInput, close, fraction, fromReference, lift, lossTolerance, mcTolerance, near, ok, reference, settings } from "./__fixtures__/scenarios";

describe("analysis against the independent reference", () => {
  for (const scenario of reference.analysis) {
    it(scenario.name, () => {
      const { input, settings: s } = fromReference(scenario);
      const result = ok(analyze(input, s));
      close(result.alpha, scenario.alpha, "alpha");
      result.groups.forEach((g, i) => close(g.rate, scenario.rates[i]!, `rate ${g.id}`));
      close(result.srm.chiSquare, scenario.srm.chiSquare, "chi-square", 1e-6);
      close(result.srm.pValue, scenario.srm.pValue, "SRM p", 1e-6);
      expect(result.extraDays).toBe(scenario.extraDays);

      result.variants.forEach((v, i) => {
        const e = scenario.variants[i]!;
        expect(v.id).toBe(e.id);
        close(v.ztest.lift!, e.lift, `${v.id} lift`);
        close(v.ztest.absoluteDiff, e.absoluteDiff, `${v.id} diff`);
        close(v.ztest.z, e.z, `${v.id} z`);
        close(v.ztest.pValue, e.pValue, `${v.id} p`, 1e-6);
        close(v.ztest.ciAbsolute[0], e.ciAbsolute[0]!, `${v.id} CI low`, 1e-6);
        const upper = e.ciAbsolute[1];
        if (upper === null || upper === undefined) expect(v.ztest.ciAbsolute[1]).toBe(Number.POSITIVE_INFINITY);
        else close(v.ztest.ciAbsolute[1], upper, `${v.id} CI high`, 1e-6);
        close(v.ztest.observedPower, e.observedPower, `${v.id} observed power`, 1e-6);
        close(v.achievedMde, e.achievedMde!, `${v.id} achieved MDE`, 1e-6);
        expect(v.requiredSamplePerVariant).toBe(e.requiredSamplePerVariant);
        expect(v.verdictZ).toBe(e.verdictZ);
        expect(v.verdictBayes).toBe(e.verdictBayes);

        near(v.bayes.probabilityToBeatControl, e.probabilityToBeatControl, mcTolerance(e.probabilityToBeatControl), `${v.id} P(beat)`);
        near(v.bayes.probabilityToBeBest, e.probabilityToBeBest, mcTolerance(e.probabilityToBeBest), `${v.id} P(best)`);
        near(v.bayes.expectedLossAbsolute, e.expectedLossAbsolute, lossTolerance(e.expectedLossAbsolute, e.probabilityToBeatControl), `${v.id} loss`);
        const [lo, hi] = v.bayes.credibleIntervalRelative!;
        near(lo, e.credibleIntervalRelative[0]!, 0.004, `${v.id} credible low`);
        near(hi, e.credibleIntervalRelative[1]!, 0.004, `${v.id} credible high`);

        if ("sequential" in e && e.sequential) {
          const seq = v.sequential!;
          close(seq.informationFraction, e.sequential.informationFraction, `${v.id} t`);
          close(seq.zBoundary, e.sequential.zBoundary, `${v.id} boundary`, 1e-5);
          expect(seq.crossed).toBe(e.sequential.crossed);
          expect(seq.isFinal).toBe(e.sequential.isFinal);
        } else {
          expect(v.sequential).toBeNull();
        }
      });

      if ("revenue" in scenario && scenario.revenue) {
        const revenue = result.revenue!;
        close(revenue.monthlyVisitors, scenario.revenue.monthlyVisitors, "monthly visitors", 1e-9);
        revenue.perVariant.forEach((r, i) => {
          const e = scenario.revenue.perVariant[i]!;
          close(r.extraMonthlyConversions, e.extraMonthlyConversions, "extra conversions", 1e-9);
          close(r.monthlyContribution, e.monthlyContribution, "monthly contribution", 1e-9);
          close(r.horizonImpact, e.horizonImpact, "horizon impact", 1e-9);
        });
        revenue.forecast.forEach((f, i) => {
          expect(f.months).toHaveLength(6);
          close(f.months[5]!, scenario.revenue.forecastLastMonth[i]!, "forecast", 1e-9);
        });
      }
    });
  }

  it("matches the hand-derived PRD fixture to the displayed digits", () => {
    const fixture = analysisInput([[80000, 1600], [80000, 1696]]);
    const twoSided = ok(analyze({ ...fixture, method: "ztest" }, settings()));
    const v = twoSided.variants[0]!;
    expect(v.ztest.z.toFixed(4)).toBe("1.6897");
    expect(v.ztest.pValue.toFixed(4)).toBe("0.0911");
    expect((v.ztest.lift! * 100).toFixed(2)).toBe("6.00");
    expect((v.achievedMde * 100).toFixed(2)).toBe("10.04");
    expect(v.requiredSamplePerVariant).toBe(80682);
    expect(twoSided.extraDays).toBe(1);
    expect(v.verdict).toBe("underpowered");

    const oneSided = ok(analyze({ ...fixture, method: "ztest" }, settings({ hypothesis: "one-sided" }))).variants[0]!;
    expect(oneSided.ztest.pValue.toFixed(4)).toBe("0.0455");
    expect(oneSided.verdict).toBe("winner");

    const bayes = ok(analyze(fixture, settings())).variants[0]!;
    expect(bayes.bayes.probabilityToBeatControl).toBeGreaterThanOrEqual(0.95);
    expect(bayes.bayes.probabilityToBeatControl).toBeLessThan(0.959);
    expect(bayes.verdict).toBe("winner");
  });
});

describe("four verdict states for each method (PRD section 8)", () => {
  const cases: { name: string; groups: [number, number][]; hypothesis?: "one-sided"; z: Verdict; bayes: Verdict }[] = [
    { name: "clear winner", groups: [[80000, 1600], [80000, 1800]], z: "winner", bayes: "winner" },
    { name: "clear loser", groups: [[80000, 1600], [80000, 1450]], z: "loser", bayes: "loser" },
    { name: "no relevant difference with a large sample", groups: [[400000, 8000], [400000, 8040]], z: "no-difference", bayes: "no-difference" },
    { name: "underpowered small sample", groups: [[5000, 100], [5000, 105]], z: "underpowered", bayes: "underpowered" },
    { name: "Z underpowered while Bayes already sees a winner", groups: [[80000, 1600], [80000, 1696]], z: "underpowered", bayes: "winner" },
  ];
  for (const c of cases) {
    it(c.name, () => {
      const input = analysisInput(c.groups);
      const z = ok(analyze({ ...input, method: "ztest" }, settings())).variants[0]!;
      const b = ok(analyze({ ...input, method: "bayesian" }, settings())).variants[0]!;
      expect([z.verdictZ, z.verdictBayes, z.verdict]).toEqual([c.z, c.bayes, c.z]);
      expect([b.verdictZ, b.verdictBayes, b.verdict]).toEqual([c.z, c.bayes, c.bayes]);
    });
  }

  it("a one-sided Z test never calls a worse variant a loser", () => {
    const v = ok(analyze({ ...analysisInput([[80000, 1600], [80000, 1450]]), method: "ztest" }, settings({ hypothesis: "one-sided" }))).variants[0]!;
    expect(v.ztest.pValue).toBeGreaterThan(0.99);
    expect(v.verdictZ).not.toBe("loser");
    expect(v.verdictBayes).toBe("loser");
  });

  it("the reference lift moves the inconclusive split: MDE 10.04% is no-difference at a 12% target", () => {
    const v = ok(analyze({ ...analysisInput([[80000, 1600], [80000, 1696]]), method: "ztest", referenceLift: lift(0.12) }, settings())).variants[0]!;
    expect(v.verdict).toBe("no-difference");
  });

  it("an achieved MDE equal to the reference lift already counts as enough sample", () => {
    const input = { ...analysisInput([[80000, 1600], [80000, 1696]]), method: "ztest" as const };
    const mde = ok(analyze(input, settings())).variants[0]!.achievedMde;
    expect(ok(analyze({ ...input, referenceLift: lift(mde) }, settings())).variants[0]!.verdict).toBe("no-difference");
    expect(ok(analyze({ ...input, referenceLift: lift(mde * (1 - 1e-9)) }, settings())).variants[0]!.verdict).toBe("underpowered");
  });

  it("Bonferroni changes the Z verdict but not the Bayesian one", () => {
    const three = reference.analysis.find((s) => s.name === "three-group-bonferroni")!;
    const { input } = fromReference(three);
    const on = ok(analyze(input, settings())).variants[0]!;
    const off = ok(analyze(input, settings({ bonferroni: false }))).variants[0]!;
    expect([on.verdictZ, off.verdictZ]).toEqual(["underpowered", "winner"]);
    expect(on.bayes).toEqual(off.bayes);
  });
});

describe("analysis edge cases (PRD sections 5 to 7)", () => {
  it("returns empty without a second group and no-conversions when every group has 0 conversions", () => {
    const two = analysisInput([[1000, 10], [1000, 12]]);
    expect(analyze({ ...two, groups: two.groups.slice(0, 1), intendedSplit: [fraction(1)] }, settings())).toEqual({ kind: "empty" });
    expect(analyze(analysisInput([[1000, 0], [1000, 0], [900, 0]]), settings())).toEqual({ kind: "no-conversions" });
  });

  it("control with 0 conversions: no relative lift, absolute difference kept, Bayes still works", () => {
    const v = ok(analyze(analysisInput([[1000, 0], [1000, 10]]), settings())).variants[0]!;
    expect(v.ztest.lift).toBeNull();
    expect(v.ztest.ciRelative).toBeNull();
    close(v.ztest.absoluteDiff, 0.01);
    close(v.ztest.z, 0.01 / Math.sqrt((0.01 * 0.99) / 1000), "z uses only the variant SE");
    expect(v.bayes.probabilityToBeatControl).toBeGreaterThan(0.99);
    expect(v.bayes.expectedLossRelative).toBeNull();
    expect(v.bayes.credibleIntervalRelative).toBeNull();
  });

  it("identical variant: z = 0 and p-value 1, inconclusive", () => {
    const v = ok(analyze({ ...analysisInput([[50000, 1000], [50000, 1000]]), method: "ztest" }, settings())).variants[0]!;
    expect(v.ztest.z).toBe(0);
    expect(v.ztest.pValue).toBe(1);
    expect(["no-difference", "underpowered"]).toContain(v.verdict);
  });

  it("both groups at 100%: no noise and no difference gives z = 0, never NaN", () => {
    const v = ok(analyze(analysisInput([[50, 50], [40, 40]]), settings())).variants[0]!;
    expect(v.ztest.z).toBe(0);
    expect(v.ztest.pValue).toBe(1);
  });

  it("small samples still compute", () => {
    const result = ok(analyze(analysisInput([[20, 2], [20, 5]]), settings()));
    expect(Number.isFinite(result.variants[0]!.bayes.probabilityToBeatControl)).toBe(true);
  });

  it("accepts counts above 100 million in 64-bit floats", () => {
    const v = ok(analyze(analysisInput([[300_000_000, 6_000_000], [300_000_000, 6_030_000]]), settings())).variants[0]!;
    expect(v.ztest.pValue).toBeLessThan(1e-10);
    expect(v.verdict).toBe("winner");
    expect(Number.isFinite(v.achievedMde)).toBe(true);
  });

  it("probability to be best sums to 1 across groups with 5 groups", () => {
    const five = fromReference(reference.analysis.find((s) => s.name === "five-group-bonferroni")!);
    const result = ok(analyze(five.input, five.settings));
    const control = reference.analysis.find((s) => s.name === "five-group-bonferroni")!.probabilityToBeBestControl;
    const variantsBest = result.variants.reduce((sum, v) => sum + v.bayes.probabilityToBeBest, 0);
    near(1 - variantsBest, control, mcTolerance(control), "control P(best)");
  });

  it("extra days are null without the test duration", () => {
    expect(ok(analyze(analysisInput([[80000, 1600], [80000, 1696]], { days: null }), settings())).extraDays).toBeNull();
  });
});

describe("revenue (PRD section 9)", () => {
  const withRevenue = analysisInput([[80000, 1600], [80000, 1520]], {
    revenue: { valuePerConversion: 100, currency: "USD", horizonMonths: 3 },
  });

  it("is null without days or without a value per conversion", () => {
    expect(ok(analyze({ ...withRevenue, days: null }, settings())).revenue).toBeNull();
    expect(ok(analyze({ ...withRevenue, revenue: null }, settings())).revenue).toBeNull();
  });

  it("a negative lift projects a loss, month by month over the horizon", () => {
    const revenue = ok(analyze(withRevenue, settings())).revenue!;
    const monthly = (160000 / 14) * 30;
    close(revenue.monthlyVisitors, monthly);
    close(revenue.perVariant[0]!.monthlyContribution, monthly * (0.019 - 0.02) * 100);
    expect(revenue.perVariant[0]!.horizonImpact).toBeLessThan(0);
    expect(revenue.forecast.map((f) => f.id)).toEqual(["A", "B"]);
    revenue.forecast[0]!.months.forEach((value, m) => close(value, monthly * 0.02 * 100 * (m + 1)));
  });
});

describe("determinism and the input hash", () => {
  const base = analysisInput([[80000, 1600], [80000, 1696], [80000, 1650]]);

  it("the same input twice gives identical Bayesian numbers and hash", () => {
    const a = ok(analyze(base, settings()));
    const b = ok(analyze(structuredClone(base), settings()));
    expect(b.variants.map((v) => v.bayes)).toEqual(a.variants.map((v) => v.bayes));
    expect(b.inputHash).toBe(a.inputHash);
    expect(a.inputHash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("changing one conversion changes the hash and the draws", () => {
    const a = ok(analyze(base, settings()));
    const changed = { ...base, groups: base.groups.map((g, i) => (i === 2 ? { ...g, conversions: g.conversions + 1 } : g)) };
    const b = ok(analyze(changed, settings()));
    expect(b.inputHash).not.toBe(a.inputHash);
    expect(b.variants[1]!.bayes.probabilityToBeatControl).not.toBe(a.variants[1]!.bayes.probabilityToBeatControl);
  });

  it("method, settings and revenue change the hash but never make the probabilities jitter", () => {
    const a = ok(analyze(base, settings()));
    const variants = [
      ok(analyze({ ...base, method: "ztest" }, settings())),
      ok(analyze(base, settings({ hypothesis: "one-sided" }))),
      ok(analyze({ ...base, revenue: { valuePerConversion: 150, currency: "BRL", horizonMonths: 6 } }, settings())),
    ];
    for (const other of variants) {
      expect(other.inputHash).not.toBe(a.inputHash);
      expect(other.variants.map((v) => v.bayes.probabilityToBeatControl)).toEqual(a.variants.map((v) => v.bayes.probabilityToBeatControl));
    }
  });
});
