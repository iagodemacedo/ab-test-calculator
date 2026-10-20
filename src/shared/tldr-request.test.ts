import { describe, expect, it } from "vitest";
import { parseTldrRequest } from "../../worker/payload";
import { analyze, type AnalysisInput, type Settings } from "../stats";
import { analysisInput, fraction, ok, settings } from "../stats/__fixtures__/scenarios";
import { toTldrRequest } from "./tldr-request";

function build(input: AnalysisInput, s: Settings = settings()) {
  const request = toTldrRequest(ok(analyze(input, s)), input, s, "pt", "token");
  const wire: unknown = JSON.parse(JSON.stringify(request));
  const parsed = parseTldrRequest(wire);
  expect(parsed, "the Worker accepts what the browser builds").toEqual({ ok: true, value: wire });
  return request;
}

const revenue = { valuePerConversion: 80, currency: "BRL", horizonMonths: 6 } as const;

describe("toTldrRequest output always passes the Worker parser", () => {
  it("2 groups with SRM", () => {
    const request = build(analysisInput([[50000, 1000], [48500, 1000]]));
    expect(request.context).toEqual({ method: "bayesian", confidence: 0.95, power: 0.8, hypothesis: "two-sided", bonferroni: true });
    expect(request.findings[0]).toMatchObject({ rule: "srm" });
    expect(request.revenue).toBeNull();
    expect(JSON.stringify(request)).not.toContain("inputHash");
    expect(JSON.stringify(request)).not.toContain("distributions");
  });

  it("5 groups with revenue per variant", () => {
    const request = build(
      analysisInput([[30000, 900], [30000, 990], [30000, 960], [30000, 880], [30000, 1020]], { revenue }),
    );
    expect(request.variants.map((v) => v.id)).toEqual(["B", "C", "D", "E"]);
    expect(request.revenue?.perVariant.map((r) => r.id)).toEqual(["B", "C", "D", "E"]);
    expect(request.revenue?.perVariant[1]!.monthlyContribution).toBeGreaterThan(0);
    expect(request.revenue?.perVariant[2]!.monthlyContribution).toBeLessThan(0);
  });

  it("non-contiguous slots A, B, D", () => {
    const base = analysisInput([[30000, 900], [30000, 990], [30000, 960]], { revenue });
    const request = build({ ...base, groups: base.groups.map((g, i) => (i === 2 ? { ...g, id: "D" as const } : g)) });
    expect(request.groups.map((g) => g.id)).toEqual(["A", "B", "D"]);
    expect(request.variants.map((v) => v.id)).toEqual(["B", "D"]);
    expect(request.revenue?.perVariant.map((r) => r.id)).toEqual(["B", "D"]);
  });

  it("sequential final look, per variant", () => {
    const request = build(
      analysisInput([[40000, 800], [40000, 900], [40000, 820]], {
        method: "ztest",
        sequential: { enabled: true, plannedLooks: 4, currentLook: 4 },
      }),
    );
    expect(request.variants.map((v) => v.sequential && [v.sequential.look, v.sequential.plannedLooks, v.sequential.crossed])).toEqual([
      [4, 4, true],
      [4, 4, false],
    ]);
    expect(request.variants[0]!.sequential!.zObserved).toBeGreaterThan(request.variants[0]!.sequential!.zBoundary!);
  });

  it("a weekly plan with more than 12 looks, Bayesian selected: the Z test governs and is named", () => {
    const request = build(
      analysisInput([[40000, 800], [40000, 900]], {
        sequential: { enabled: true, plannedLooks: 20, currentLook: 3 },
        plannedSamplePerVariant: 200000,
      }),
    );
    expect(request.context.method).toBe("ztest");
    expect(request.variants[0]!.sequential).toMatchObject({ look: 3, plannedLooks: 20 });
  });

  it("zero control conversions: undefined lifts and infinite engine numbers travel as null", () => {
    const input = analysisInput([[1000, 0], [1000, 10]]);
    const result = ok(analyze(input, settings()));
    expect([result.variants[0]!.achievedMde, result.extraDays]).toEqual([Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]);
    const request = build(input);
    expect(request.variants[0]).toMatchObject({ lift: null, ciRelative: null, expectedLossRelative: null, achievedMde: null });
    expect(request.duration.extraDays).toBeNull();
    const mde = request.findings.find((f) => f.rule === "mde_high");
    expect(mde).toEqual({ rule: "mde_high", variant: "B", mde: null });
  });

  it("one-sided Z test: the unbounded upper end of the interval is null", () => {
    const request = build(analysisInput([[80000, 1600], [80000, 1696]], { method: "ztest" }), settings({ hypothesis: "one-sided" }));
    const [low, high] = request.variants[0]!.ciRelative!;
    expect(Number.isFinite(low)).toBe(true);
    expect(high).toBeNull();
  });

  it("truncates group names to 40 characters", () => {
    const input = analysisInput([[1000, 20], [1000, 25]], { trafficShare: fraction(0.5) });
    input.groups[1]!.name = "x".repeat(60);
    expect(build(input).groups[1]!.name).toHaveLength(40);
  });
});
