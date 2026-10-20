import type { TldrRequest } from "../src/shared/tldr-contract";

export function requestFixture(): TldrRequest {
  return {
    locale: "pt", turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
    context: { method: "bayesian", confidence: 0.95, power: 0.8, hypothesis: "two-sided", bonferroni: true },
    groups: [
      { id: "A", name: "Controle", users: 50000, conversions: 1000, rate: 0.02, intendedSplit: 0.5 },
      { id: "B", name: "Variante B", users: 48500, conversions: 1000, rate: 1000 / 48500, intendedSplit: 0.5 },
    ],
    variants: [{ id: "B", lift: 0.030927835051546282, pValue: 0.491604156, probabilityToBeatControl: 0.753,
      ciRelative: [-0.054, 0.123], expectedLossRelative: 0.0064, achievedMde: 0.1299, verdict: "underpowered",
      sequential: null }],
    duration: { days: 14, trafficShare: 1, plannedSamplePerVariant: null, referenceLift: 0.1, extraDays: 14 },
    revenue: null,
    findings: [{ rule: "srm", pValue: 0.0000018 }],
  };
}
