import { describe, expect, it } from "vitest";
import { analyze, RULE_SEVERITY } from "./index";
import type { AnalysisInput, Finding, RuleId, Settings } from "./index";
import { analysisInput, fraction, ok, settings } from "./__fixtures__/scenarios";

function findings(input: AnalysisInput, s: Settings = settings()): Finding[] {
  return ok(analyze(input, s)).findings;
}

function rules(input: AnalysisInput, s?: Settings): RuleId[] {
  return findings(input, s).map((f) => f.rule);
}

const FIXTURE = [[80000, 1600], [80000, 1696]] as const;

describe("each rule of PRD section 8 fires where it should and stays silent next door", () => {
  it("srm: 50000 vs 48500 on an equal split is critical; 50000 vs 49900 is not", () => {
    const srm = findings(analysisInput([[50000, 1000], [48500, 1000]])).find((f) => f.rule === "srm");
    expect(srm).toBeDefined();
    expect(srm!.rule === "srm" && srm!.pValue).toBeLessThan(0.01);
    expect(rules(analysisInput([[50000, 1000], [49900, 1000]]))).not.toContain("srm");
  });

  it("srm uses the intended split: 90/10 is fine when 90/10 was intended", () => {
    const unequal = analysisInput([[90000, 1800], [10000, 200]]);
    expect(rules({ ...unequal, intendedSplit: [fraction(0.9), fraction(0.1)] })).not.toContain("srm");
    expect(rules(unequal)).toContain("srm");
  });

  it("stopped_early: below the planned sample with the sequential toggle off", () => {
    const planned = analysisInput(FIXTURE, { plannedSamplePerVariant: 100000 });
    expect(findings(planned).filter((f) => f.rule === "stopped_early")).toEqual([
      { rule: "stopped_early", variant: "B", current: 80000, planned: 100000 },
    ]);
    expect(rules({ ...planned, sequential: { enabled: true, plannedLooks: 4, currentLook: 3 } })).not.toContain("stopped_early");
    expect(rules({ ...planned, plannedSamplePerVariant: 80000 })).not.toContain("stopped_early");
    expect(rules(analysisInput(FIXTURE))).not.toContain("stopped_early");
  });

  it("low_data: a significant result carried by 20 conversions or fewer; 21 is enough", () => {
    expect(findings(analysisInput([[1000, 20], [1000, 40]]))).toContainEqual({ rule: "low_data", variant: "B", weightedDiff: 20 });
    expect(rules(analysisInput([[1000, 20], [1000, 41]]))).not.toContain("low_data");
    expect(rules(analysisInput([[1000, 20], [1000, 30]]))).not.toContain("low_data");
  });

  it("low_data fires for tiny samples (< 30 users per group) once they look significant", () => {
    const tiny = analysisInput([[20, 2], [20, 12]]);
    expect(ok(analyze(tiny, settings())).variants[0]!.verdict).toBe("winner");
    expect(rules(tiny)).toContain("low_data");
  });

  it("under_7_days: 6 days fires, 7 does not", () => {
    expect(findings(analysisInput(FIXTURE, { days: 6 }))).toContainEqual({ rule: "under_7_days", days: 6 });
    expect(rules(analysisInput(FIXTURE, { days: 7 }))).not.toContain("under_7_days");
  });

  it("incomplete_weeks: 10 days suggests 14; 14 days and 6 days stay silent", () => {
    expect(findings(analysisInput(FIXTURE, { days: 10 }))).toContainEqual({ rule: "incomplete_weeks", days: 10, suggestedDays: 14 });
    expect(rules(analysisInput(FIXTURE, { days: 14 }))).not.toContain("incomplete_weeks");
    expect(rules(analysisInput(FIXTURE, { days: 6 }))).not.toContain("incomplete_weeks");
  });

  it("over_8_weeks: 57 days fires, 56 does not", () => {
    expect(findings(analysisInput(FIXTURE, { days: 57 }))).toContainEqual({ rule: "over_8_weeks", days: 57 });
    expect(rules(analysisInput(FIXTURE, { days: 56 }))).not.toContain("over_8_weeks");
  });

  it("no day-based rule fires without the test duration", () => {
    const r = rules(analysisInput(FIXTURE, { days: null }));
    expect(r).not.toContain("under_7_days");
    expect(r).not.toContain("incomplete_weeks");
    expect(r).not.toContain("over_8_weeks");
  });

  it("underpowered: fires on the 'Inconclusiva, sem poder' verdict, not on 'sem diferença relevante'", () => {
    expect(findings(analysisInput(FIXTURE, { method: "ztest" }))).toContainEqual({ rule: "underpowered", variant: "B", referenceLift: 0.1 });
    expect(rules(analysisInput([[400000, 8000], [400000, 8040]], { method: "ztest" }))).not.toContain("underpowered");
  });

  it("mde_high: achieved MDE 10.04% fires; a 400k sample does not", () => {
    const mde = findings(analysisInput(FIXTURE)).find((f) => f.rule === "mde_high");
    expect(mde && mde.rule === "mde_high" && (mde.mde * 100).toFixed(2)).toBe("10.04");
    expect(rules(analysisInput([[400000, 8000], [400000, 8040]]))).not.toContain("mde_high");
  });

  it("bonferroni_off: 3 groups with the correction off; on, or 2 groups, stay silent", () => {
    const three = analysisInput([[20000, 400], [20000, 460], [20000, 430]]);
    expect(findings(three, settings({ bonferroni: false }))).toContainEqual({ rule: "bonferroni_off", groups: 3 });
    expect(rules(three)).not.toContain("bonferroni_off");
    expect(rules(analysisInput(FIXTURE), settings({ bonferroni: false }))).not.toContain("bonferroni_off");
  });

  it("methods_disagree: two-sided Z underpowered vs Bayes winner; one-sided both winner", () => {
    expect(findings(analysisInput(FIXTURE))).toContainEqual({ rule: "methods_disagree", variant: "B" });
    expect(rules(analysisInput(FIXTURE), settings({ hypothesis: "one-sided" }))).not.toContain("methods_disagree");
  });

  it("seq_not_crossed: look 2 of 4 below its boundary; crossed or final looks stay silent", () => {
    const running = analysisInput([[40000, 800], [40000, 900]], { method: "ztest", sequential: { enabled: true, plannedLooks: 4, currentLook: 2 } });
    expect(findings(running)).toContainEqual({ rule: "seq_not_crossed", variant: "B", look: 2 });
    expect(rules({ ...running, groups: analysisInput([[40000, 800], [40000, 1000]]).groups })).not.toContain("seq_not_crossed");
    const final = analysisInput(FIXTURE, { method: "ztest", sequential: { enabled: true, plannedLooks: 4, currentLook: 4 } });
    expect(ok(analyze(final, settings({ hypothesis: "one-sided" }))).variants[0]!.sequential).toMatchObject({ isFinal: true, crossed: false });
    expect(rules(final, settings({ hypothesis: "one-sided" }))).not.toContain("seq_not_crossed");
  });
});

describe("ordering and severity", () => {
  it("lists every finding by severity, then in PRD table order", () => {
    const input = analysisInput([[50000, 1000], [48500, 1000]], { days: 5, method: "ztest", plannedSamplePerVariant: 60000 });
    expect(rules(input)).toEqual(["srm", "stopped_early", "under_7_days", "underpowered", "mde_high"]);
  });

  it("findings come out non-decreasing in severity, and only rules can be critical", () => {
    const rank = { critical: 0, warning: 1, info: 2 } as const;
    const input = analysisInput([[50000, 1000], [48000, 1100], [48500, 1010]], { days: 60, plannedSamplePerVariant: 90000 });
    const severities = findings(input, settings({ bonferroni: false })).map((f) => rank[RULE_SEVERITY[f.rule]]);
    expect(severities.length).toBeGreaterThan(4);
    expect([...severities].sort((a, b) => a - b)).toEqual(severities);
  });

  it("a winner with an active SRM keeps its verdict next to the critical finding", () => {
    const result = ok(analyze(analysisInput([[50000, 1000], [48000, 1200]]), settings()));
    expect(result.variants[0]!.verdict).toBe("winner");
    expect(result.findings[0]!.rule).toBe("srm");
  });
});
