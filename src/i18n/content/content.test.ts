import { describe, expect, it } from "vitest";
import { RULE_SEVERITY, type Finding, type RuleId, type Verdict } from "../../stats/types";
import { content as en } from "./en";
import { content as pt } from "./pt";
import type { ConceptId, ContentPack, ExplanationContext, Fmt, HeadlineInput } from "./types";

const CONCEPTS = [
  "bayes",
  "ztest",
  "bayes-vs-z",
  "p-value",
  "confidence-power",
  "mde-sample",
  "hypothesis",
  "bonferroni",
  "expected-risk",
  "srm",
  "peeking-sequential",
] as const satisfies readonly ConceptId[];
// Fails to compile if a ConceptId is missing from the list above.
const allConcepts: Exclude<ConceptId, (typeof CONCEPTS)[number]> extends never ? true : never = true;

const RULES = Object.keys(RULE_SEVERITY) as RuleId[];
const VERDICTS: Verdict[] = ["winner", "loser", "no-difference", "underpowered"];

const SAMPLE_FINDINGS: { [R in RuleId]: Extract<Finding, { rule: R }> } = {
  srm: { rule: "srm", pValue: 0.0031 },
  stopped_early: { rule: "stopped_early", variant: "B", current: 4210, planned: 9800 },
  low_data: { rule: "low_data", variant: "B", weightedDiff: 14.6 },
  under_7_days: { rule: "under_7_days", days: 5 },
  over_8_weeks: { rule: "over_8_weeks", days: 63 },
  underpowered: { rule: "underpowered", variant: "C", referenceLift: 0.1 },
  bonferroni_off: { rule: "bonferroni_off", groups: 4 },
  incomplete_weeks: { rule: "incomplete_weeks", days: 10, suggestedDays: 14 },
  mde_high: { rule: "mde_high", variant: "B", mde: 0.184 },
  methods_disagree: { rule: "methods_disagree", variant: "B" },
  seq_not_crossed: { rule: "seq_not_crossed", variant: "B", look: 2 },
};

/** Wraps every formatted number in «» so the tests can see that numbers went through fmt. */
const markerFmt: Fmt = {
  pct: (x, d) => `«pct ${x} ${d ?? ""}»`,
  num: (x, d) => `«num ${x} ${d ?? ""}»`,
  int: (x) => `«int ${x}»`,
};

const FULL_CTX: ExplanationContext = {
  probabilityToBeat: "97,0%",
  pValue: "0,031",
  lift: "6,00%",
  mde: "8,4%",
  confidence: "95%",
  power: "80%",
  alpha: "2,5%",
  groups: 3,
  expectedLoss: "0,02 p.p.",
  look: 2,
  plannedLooks: 4,
};

function headlineInputs(): HeadlineInput[] {
  const out: HeadlineInput[] = [];
  for (const verdict of VERDICTS)
    for (const method of ["bayesian", "ztest"] as const)
      for (const lift of [0.06, -0.04, 0, null])
        for (const [prob, p] of [
          [0.97, 0.012],
          [0.9996, 0.0002],
          [0.0004, 0.9],
        ] as const)
          out.push({
            verdict,
            method,
            lift,
            variantName: "Variante B",
            controlName: "Controle",
            probabilityToBeat: method === "bayesian" ? prob : null,
            pValue: method === "ztest" ? p : null,
          });
  return out;
}

function everyString(pack: ContentPack): string[] {
  const out: string[] = [];
  for (const id of CONCEPTS) {
    const e = pack.explanations[id];
    out.push(e.title, e.layer2, e.layer1(null), e.layer1(FULL_CTX), e.layer1({ groups: 2 }));
  }
  for (const rule of RULES) {
    const f = pack.finding(SAMPLE_FINDINGS[rule], markerFmt);
    out.push(pack.ruleTitle[rule], f.title, f.explanation, f.action);
  }
  for (const v of VERDICTS) out.push(pack.verdictLabel[v]);
  for (const h of headlineInputs()) out.push(pack.headline(h, markerFmt));
  return out;
}

describe.each([
  ["pt", pt],
  ["en", en],
] as const)("%s content pack", (locale, pack) => {
  it("declares its locale", () => {
    expect(allConcepts).toBe(true);
    expect(pack.locale).toBe(locale);
  });

  it.each(CONCEPTS)("has non-empty texts for concept %s", (id) => {
    const e = pack.explanations[id];
    expect(e.title.trim()).not.toBe("");
    expect(e.layer2.trim()).not.toBe("");
    expect(e.layer1(null).trim()).not.toBe("");
    expect(e.layer1(FULL_CTX).trim()).not.toBe("");
  });

  it.each(RULES)("has non-empty finding text for rule %s that formats its numbers through fmt", (rule) => {
    const f = pack.finding(SAMPLE_FINDINGS[rule], markerFmt);
    expect(pack.ruleTitle[rule].trim()).not.toBe("");
    expect(f.title).toBe(pack.ruleTitle[rule]);
    expect(f.explanation.trim()).not.toBe("");
    expect(f.action.trim()).not.toBe("");
    if (rule !== "methods_disagree") expect(f.explanation).toContain("«");
  });

  it("weaves the user's numbers into layer 1 when they are known", () => {
    expect(pack.explanations.bayes.layer1(FULL_CTX)).toContain("97,0%");
    expect(pack.explanations["p-value"].layer1(FULL_CTX)).toContain("0,031");
    expect(pack.explanations["mde-sample"].layer1(FULL_CTX)).toContain("8,4%");
    expect(pack.explanations["expected-risk"].layer1(FULL_CTX)).toContain("0,02 p.p.");
  });

  it("puts the probability in Bayesian headlines and the p-value in Z test headlines", () => {
    const base = { verdict: "winner", variantName: "B", controlName: "A", lift: 0.06 } as const;
    const bayes = pack.headline({ ...base, method: "bayesian", probabilityToBeat: 0.97, pValue: null }, markerFmt);
    const z = pack.headline({ ...base, method: "ztest", probabilityToBeat: null, pValue: 0.012 }, markerFmt);
    expect(bayes).toContain("«pct 0.97 1»");
    expect(z).toContain("«num 0.012 3»");
    expect(z).toContain("p-value");
  });

  it("never prints a long dash, an en dash, curly quotes, or an unfilled value", () => {
    for (const s of everyString(pack)) {
      expect(s).not.toMatch(/[—–“”‘’]/);
      expect(s).not.toMatch(/undefined|NaN|\[object/);
    }
  });
});
