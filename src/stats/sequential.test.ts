import { describe, expect, it } from "vitest";
import { analyze, planPretest } from "./index";
import { analysisInput, close, near, ok, okPlan, pretestInput, reference, settings } from "./__fixtures__/scenarios";

// Lan-DeMets O'Brien-Fleming boundaries, two-sided alpha 0.05, equal spacing, as published by
// gsDesign (sfLDOF) and ldbounds to 4 decimals. Their own quadrature grids differ from ours in
// the 4th decimal (K = 5, look 2: 3.3569 published, 3.35701 here and in the Python reference),
// so the published table is checked at 5e-4 and the reference at 1e-5. K = 2 is not listed: the
// 2.7965 / 1.9774 often quoted for it are the classic O'Brien-Fleming constants, not spending.
const LITERATURE: Record<number, number[]> = {
  3: [3.7103, 2.5114, 1.993],
  4: [4.3326, 2.9631, 2.359, 2.0141],
  5: [4.8769, 3.3569, 2.6803, 2.2898, 2.031],
};

function designFor(looks: number, hypothesis: "two-sided" | "one-sided", power: 0.8 | 0.9 = 0.8) {
  const input = pretestInput({ mode: "target-lift", looks: { kind: "fixed", count: looks } });
  return okPlan(planPretest(input, settings({ hypothesis, power }))).sequential!;
}

describe("O'Brien-Fleming design in the pre-test", () => {
  for (const [looks, expected] of Object.entries(LITERATURE)) {
    it(`K = ${looks} two-sided matches the published table to 5e-4`, () => {
      const boundaries = designFor(Number(looks), "two-sided").boundaries.map((b) => b.zBoundary);
      expected.forEach((z, k) => near(boundaries[k]!, z, 5e-4, `look ${k + 1}`));
    });
  }

  for (const row of reference.obf) {
    it(`K = ${row.looks} ${row.hypothesis}: boundaries and inflation match the reference`, () => {
      const hypothesis = row.hypothesis === "two-sided" ? "two-sided" : "one-sided";
      const design = designFor(row.looks, hypothesis);
      design.boundaries.forEach((b, k) => close(b.zBoundary, row.boundaries[k]!, `look ${k + 1}`, 1e-5));
      close(design.inflationFactor, row.inflationFactor["0.8"], "inflation at 80%", 1e-5);
      close(designFor(row.looks, hypothesis, 0.9).inflationFactor, row.inflationFactor["0.9"], "inflation at 90%", 1e-5);
    });

    it(`K = ${row.looks} ${row.hypothesis}: these boundaries spend exactly alpha by the final look`, () => {
      near(row.spentAlpha, row.alpha, 1e-4, "spent alpha");
    });
  }

  it("boundaries shrink look by look and the nominal p-value grows toward alpha", () => {
    const design = designFor(5, "two-sided");
    const z = design.boundaries.map((b) => b.zBoundary);
    expect([...z].sort((a, b) => b - a)).toEqual(z);
    expect(design.boundaries.at(-1)!.nominalP).toBeLessThan(0.05);
    expect(design.boundaries.at(-1)!.nominalP).toBeGreaterThan(0.04);
  });

  it("a one-sided design spends the one-sided alpha only on the upper boundary", () => {
    const oneSided = designFor(4, "one-sided").boundaries.map((b) => b.zBoundary);
    const twoSided = designFor(4, "two-sided").boundaries.map((b) => b.zBoundary);
    oneSided.forEach((z, k) => expect(z).toBeLessThan(twoSided[k]!));
    near(oneSided.at(-1)!, 1.7202, 1e-4, "final one-sided boundary");
  });
});

describe("sequential status in the analysis (PRD section 4)", () => {
  const running = (look: number, planned: number | null, groups: [number, number][] = [[40000, 800], [40000, 900]]) =>
    analysisInput(groups, { method: "ztest", sequential: { enabled: true, plannedLooks: 4, currentLook: look }, plannedSamplePerVariant: planned });

  it("without a plan, looks are equally spaced", () => {
    const seq = ok(analyze(running(2, null), settings())).variants[0]!.sequential!;
    expect(seq).toMatchObject({ look: 2, plannedLooks: 4, informationFraction: 0.5, isFinal: false, crossed: false });
    near(seq.zBoundary, 2.9631, 1e-4, "look 2 of 4");
  });

  it("with a plan, the real information fraction sets the boundary", () => {
    const early = ok(analyze(running(2, 100000), settings())).variants[0]!.sequential!;
    close(early.informationFraction, 0.4);
    expect(early.zBoundary).toBeGreaterThan(2.9631);
  });

  it("a sample past the planned maximum is the final analysis", () => {
    const seq = ok(analyze(running(3, 38000), settings())).variants[0]!.sequential!;
    expect(seq.isFinal).toBe(true);
    expect(seq.informationFraction).toBe(1);
    expect(seq.zBoundary).toBeLessThan(2.1);
  });

  it("a look number past the plan is treated as the final analysis", () => {
    expect(ok(analyze(running(5, null), settings())).variants[0]!.sequential!.isFinal).toBe(true);
  });

  it("the sequential decision drives the Z verdict, even when the fixed-sample p-value is below alpha", () => {
    const v = ok(analyze(running(2, null), settings())).variants[0]!;
    expect(v.ztest.pValue).toBeLessThan(0.05);
    expect(v.ztest.significant).toBe(false);
    expect(v.verdict).not.toBe("winner");
  });

  it("the toggle forces the Z test even if Bayesian is selected", () => {
    const input = { ...running(2, null), method: "bayesian" as const };
    const v = ok(analyze(input, settings())).variants[0]!;
    expect(v.verdictBayes).toBe("winner");
    expect(v.verdict).toBe(v.verdictZ);
  });

  it("one-sided final look: the fixture's z = 1.69 stays below the 1.7202 boundary", () => {
    const final = analysisInput([[80000, 1600], [80000, 1696]], {
      method: "ztest",
      sequential: { enabled: true, plannedLooks: 4, currentLook: 4 },
      plannedSamplePerVariant: 80000,
    });
    const v = ok(analyze(final, settings({ hypothesis: "one-sided" }))).variants[0]!;
    expect(v.sequential).toMatchObject({ isFinal: true, crossed: false });
    expect(v.ztest.pValue).toBeLessThan(0.05);
    expect(v.verdictZ).not.toBe("winner");
  });
});
