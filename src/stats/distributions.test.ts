import { describe, expect, it } from "vitest";
import { analyze } from "./index";
import { normalCdf } from "./normal";
import { analysisInput, near, ok, settings } from "./__fixtures__/scenarios";

function trapezoid(x: readonly number[], y: readonly number[]): number {
  let area = 0;
  for (let i = 1; i < x.length; i++) area += ((x[i]! - x[i - 1]!) * (y[i]! + y[i - 1]!)) / 2;
  return area;
}

function argmax(y: readonly number[]): number {
  return y.reduce((best, v, i) => (v > y[best]! ? i : best), 0);
}

const counts = [[50000, 1000], [48500, 1000]] as const;

describe("CR distributions (PRD section 10)", () => {
  const result = ok(analyze(analysisInput(counts), settings()));
  const { x, groups } = result.distributions.rate;
  const step = x[1]! - x[0]!;

  it("puts every group and both methods on one ascending grid of about 120 points", () => {
    expect(x.length).toBeGreaterThanOrEqual(100);
    expect(x.length).toBeLessThanOrEqual(140);
    expect(x.every((v, i) => i === 0 || v > x[i - 1]!)).toBe(true);
    expect(groups.map((g) => g.id)).toEqual(["A", "B"]);
    for (const g of groups) {
      expect(g.bayes.density).toHaveLength(x.length);
      expect(g.ztest?.density).toHaveLength(x.length);
    }
  });

  it("the Beta posterior integrates to about 1 and peaks at the posterior mode", () => {
    groups.forEach((g, i) => {
      const [users, conversions] = counts[i]!;
      near(trapezoid(x, g.bayes.density), 1, 2e-3, `${g.id} Beta area`);
      near(x[argmax(g.bayes.density)]!, conversions / users, step, `${g.id} Beta mode`);
    });
  });

  it("the normal curve of the Z test peaks at the observed CR and integrates to about 1", () => {
    groups.forEach((g, i) => {
      const [users, conversions] = counts[i]!;
      near(x[argmax(g.ztest!.density)]!, conversions / users, step, `${g.id} normal peak`);
      near(trapezoid(x, g.ztest!.density), 1, 2e-3, `${g.id} normal area`);
    });
  });

  it("shades the confidence interval of each rate and the credible interval of each posterior", () => {
    groups.forEach((g, i) => {
      const [users, conversions] = counts[i]!;
      const p = conversions / users;
      const se = Math.sqrt((p * (1 - p)) / users);
      near(g.ztest!.interval[0], p - 1.959964 * se, 1e-6, `${g.id} CI low`);
      near(g.ztest!.interval[1], p + 1.959964 * se, 1e-6, `${g.id} CI high`);
      // With 1000 conversions the posterior is close to normal, so its 95% interval is close to the Wald one.
      near(g.bayes.interval[0], p - 1.959964 * se, 0.1 * se, `${g.id} credible low`);
      near(g.bayes.interval[1], p + 1.959964 * se, 0.1 * se, `${g.id} credible high`);
    });
  });

  it("with 0 conversions the Beta density stays finite at 0% and the degenerate normal is omitted", () => {
    const zero = ok(analyze(analysisInput([[1000, 0], [1000, 10]]), settings()));
    const control = zero.distributions.rate.groups[0]!;
    expect(control.ztest).toBeNull();
    expect(zero.distributions.rate.x[0]).toBe(0);
    expect(control.bayes.density.every(Number.isFinite)).toBe(true);
    expect(argmax(control.bayes.density)).toBe(0);
  });
});

describe("lift distributions (PRD section 10)", () => {
  const result = ok(analyze(analysisInput([[80000, 1600], [80000, 1696], [80000, 1580]]), settings()));
  const lift = result.distributions.lift!;
  const width = lift.edges[1]! - lift.edges[0]!;

  it("shares about 60 bins across variants and keeps 0 as a bin edge", () => {
    expect(lift.edges.length - 1).toBeGreaterThanOrEqual(60);
    expect(lift.edges.length - 1).toBeLessThanOrEqual(61);
    expect(lift.edges).toContain(0);
    expect(lift.variants.map((v) => v.id)).toEqual(["B", "C"]);
  });

  it("the Bayesian mass above 0 is P(beat control), and the histogram's area above 0 agrees", () => {
    lift.variants.forEach((v, i) => {
      const pBeat = result.variants[i]!.bayes.probabilityToBeatControl;
      expect(v.bayes.massAboveZero).toBe(pBeat);
      const area = v.bayes.density.reduce((sum, d, b) => (lift.edges[b]! >= 0 ? sum + d * width : sum), 0);
      near(area, pBeat, 2e-3, `${v.id} histogram area above 0`);
      near(v.bayes.density.reduce((sum, d) => sum + d * width, 0), 1, 3e-3, `${v.id} histogram area`);
    });
  });

  it("the Z test lift is the normal approximation around the observed lift, with mass above 0 of Phi(z)", () => {
    lift.variants.forEach((v, i) => {
      const z = result.variants[i]!.ztest;
      near(v.ztest!.massAboveZero, normalCdf(z.z), 1e-12, `${v.id} Z mass above 0`);
      const peak = argmax(v.ztest!.density);
      near((lift.edges[peak]! + lift.edges[peak + 1]!) / 2, z.lift!, width, `${v.id} Z peak`);
    });
  });

  it("is null when the control converts at 0%, as relative lift is undefined", () => {
    expect(ok(analyze(analysisInput([[1000, 0], [1000, 10]]), settings())).distributions.lift).toBeNull();
  });
});

describe("distribution payload", () => {
  const five = analysisInput([[30000, 900], [30000, 990], [30000, 960], [30000, 880], [30000, 1020]]);

  it("is deterministic for the same input", () => {
    expect(ok(analyze(structuredClone(five), settings())).distributions).toEqual(ok(analyze(five, settings())).distributions);
  });

  it("stays small with 5 groups", () => {
    expect(JSON.stringify(ok(analyze(five, settings())).distributions).length).toBeLessThan(24_000);
  });
});
