// Maps an engine analysis to the TL;DR wire request (src/shared/tldr-contract.ts).
import type { AnalysisInput, AnalysisResult, Locale, Settings } from "../stats/types";
import { TLDR_GROUP_NAME_MAX, type TldrRequest } from "./tldr-contract";

function finite(x: number): number | null {
  return Number.isFinite(x) ? x : null;
}

export function toTldrRequest(
  result: Extract<AnalysisResult, { kind: "ok" }>,
  input: AnalysisInput,
  settings: Settings,
  locale: Locale,
  turnstileToken: string,
): TldrRequest {
  const method = result.governingMethod;
  return {
    locale,
    turnstileToken,
    context: {
      method,
      confidence: settings.confidence,
      power: settings.power,
      hypothesis: settings.hypothesis,
      bonferroni: settings.bonferroni,
    },
    groups: input.groups.map((g, i) => ({
      id: g.id,
      name: g.name.slice(0, TLDR_GROUP_NAME_MAX),
      users: g.users,
      conversions: g.conversions,
      rate: result.groups[i]!.rate,
      intendedSplit: input.intendedSplit[i]!,
    })),
    variants: result.variants.map((v) => {
      const interval = method === "bayesian" ? v.bayes.credibleIntervalRelative : v.ztest.ciRelative;
      return {
        id: v.id,
        lift: v.ztest.lift,
        pValue: v.ztest.pValue,
        probabilityToBeatControl: v.bayes.probabilityToBeatControl,
        ciRelative: interval && [interval[0], finite(interval[1])],
        expectedLossRelative: v.bayes.expectedLossRelative,
        achievedMde: finite(v.achievedMde),
        verdict: v.verdict,
        sequential: v.sequential && {
          look: v.sequential.look,
          plannedLooks: v.sequential.plannedLooks,
          zBoundary: finite(v.sequential.zBoundary),
          zObserved: finite(v.sequential.zObserved),
          crossed: v.sequential.crossed,
        },
      };
    }),
    duration: {
      days: input.days,
      trafficShare: input.trafficShare,
      plannedSamplePerVariant: input.plannedSamplePerVariant,
      referenceLift: input.referenceLift,
      extraDays: result.extraDays === null ? null : finite(result.extraDays),
    },
    revenue:
      result.revenue && input.revenue
        ? {
            currency: input.revenue.currency,
            horizonMonths: input.revenue.horizonMonths,
            perVariant: result.revenue.perVariant.map((r) => ({
              id: r.id,
              monthlyContribution: r.monthlyContribution,
              horizonImpact: r.horizonImpact,
            })),
          }
        : null,
    findings: result.findings.map((f) => {
      const params: Record<string, string | number | null> = {};
      for (const [key, value] of Object.entries(f)) params[key] = typeof value === "number" ? finite(value) : value;
      return { ...params, rule: f.rule };
    }),
  };
}
