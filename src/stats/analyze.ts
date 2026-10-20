// Analysis of a finished or running test (PRD sections 5 to 9).
import { compareBayes } from "./bayes";
import { distributions } from "./distributions";
import { evaluateFindings } from "./findings";
import { inputHash, posteriorSeed } from "./hash";
import { projectRevenue } from "./revenue";
import { minimumDetectableEffect, sampleSize, testDesign } from "./sample-size";
import { boundaryAtLook } from "./sequential";
import { srm } from "./srm";
import type { AnalysisInput, AnalysisResult, GroupStats, Method, RelativeLift, SequentialStatus, Settings, VariantResult } from "./types";
import { verdictBayes, verdictZ } from "./verdict";
import { rate, standardError, zTest } from "./ztest";

function sequentialStatus(input: AnalysisInput, sample: number, z: number, alpha: number, settings: Settings): SequentialStatus | null {
  if (!input.sequential.enabled) return null;
  const { plannedLooks, currentLook } = input.sequential;
  // With a plan the real information fraction is used (PRD section 4); without one, equal spacing.
  const fraction = input.plannedSamplePerVariant !== null ? sample / input.plannedSamplePerVariant : currentLook / plannedLooks;
  const at = boundaryAtLook(currentLook, plannedLooks, fraction, alpha, settings.hypothesis);
  const crossed = settings.hypothesis === "two-sided" ? Math.abs(z) >= at.zBoundary : z >= at.zBoundary;
  return { look: currentLook, plannedLooks, ...at, zObserved: z, crossed };
}

export function analyze(input: AnalysisInput, settings: Settings): AnalysisResult {
  if (input.groups.length < 2) return { kind: "empty" };
  if (input.groups.every((g) => g.conversions === 0)) return { kind: "no-conversions" };

  const design = testDesign(settings, input.groups.length);
  const control = input.groups[0]!;
  const controlRate = rate(control);
  const groups: GroupStats[] = input.groups.map((g) => ({ id: g.id, rate: rate(g), standardError: standardError(g) }));
  const bayes = compareBayes(input.groups, posteriorSeed(input.groups), settings.confidence);
  const requiredSamplePerVariant = Math.ceil(sampleSize(controlRate, input.referenceLift, design));
  // The sequential toggle only exists for the Z test (PRD section 4), so it governs the verdict.
  const governingMethod: Method = input.method === "ztest" || input.sequential.enabled ? "ztest" : "bayesian";

  const variants: VariantResult[] = input.groups.slice(1).map((g, i) => {
    const sample = Math.min(control.users, g.users);
    const achievedMde = minimumDetectableEffect(controlRate, sample, design) as RelativeLift;
    const fixed = zTest(control, g, design.alpha, settings.hypothesis);
    const sequential = sequentialStatus(input, sample, fixed.z, design.alpha, settings);
    const ztest = sequential ? { ...fixed, significant: sequential.crossed } : fixed;
    const b = bayes.variants[i]!;
    const vz = verdictZ(ztest.significant, ztest.absoluteDiff, settings.hypothesis, achievedMde, input.referenceLift);
    const vb = verdictBayes(b.probabilityToBeatControl, settings.confidence, achievedMde, input.referenceLift);
    return {
      id: g.id,
      ztest,
      bayes: b,
      verdict: governingMethod === "ztest" ? vz : vb,
      verdictZ: vz,
      verdictBayes: vb,
      achievedMde,
      requiredSamplePerVariant,
      sequential,
    };
  });

  const users = input.groups.map((g) => g.users);
  const totalUsers = users.reduce((a, b) => a + b, 0);
  const srmResult = srm(users, input.intendedSplit);
  const extraDays =
    input.days === null
      ? null
      : Math.max(0, Math.ceil(((requiredSamplePerVariant - Math.min(...users)) * input.groups.length) / (totalUsers / input.days)));

  return {
    kind: "ok",
    governingMethod,
    alpha: design.alpha,
    groups,
    variants,
    srm: srmResult,
    extraDays,
    revenue: projectRevenue(input, groups),
    findings: evaluateFindings({ input, settings, srmPValue: srmResult.pValue, srmMismatch: srmResult.mismatch, variants }),
    distributions: distributions(input.groups, bayes, settings.confidence),
    inputHash: inputHash(input, settings),
  };
}
