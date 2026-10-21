// Stable 128-bit hash (cyrb128, public domain) of a canonical serialization. Canonical means
// fields are listed in a fixed order in an array, so object key order can never change a hash.
import type { AnalysisInput, Settings } from "./types";

export type Hash128 = readonly [number, number, number, number];

function cyrb128(text: string): Hash128 {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

function toHex(hash: Hash128): string {
  return hash.map((word) => word.toString(16).padStart(8, "0")).join("");
}

const FORMAT_VERSION = 1;

/** Everything that can change what the analysis shows, for the TL;DR stale check (PRD section 11). */
export function inputHash(input: AnalysisInput, settings: Settings): string {
  const seq = input.sequential.enabled ? [input.sequential.plannedLooks, input.sequential.currentLook] : null;
  const revenue = input.revenue ? [input.revenue.valuePerConversion, input.revenue.currency, input.revenue.horizonMonths] : null;
  const canonical = [
    FORMAT_VERSION,
    [settings.confidence, settings.power, settings.hypothesis, settings.bonferroni],
    input.days,
    input.trafficShare,
    input.groups.map((g) => [g.id, g.name, g.users, g.conversions]),
    input.intendedSplit,
    input.method,
    seq,
    input.referenceLift,
    input.plannedSamplePerVariant,
    revenue,
  ];
  return toHex(cyrb128(JSON.stringify(canonical)));
}

/**
 * Monte Carlo seed. Only the posterior parameters feed it, so editing revenue, method or
 * settings never makes the probabilities jitter: the same counts always give the same draws.
 */
export function posteriorSeed(groups: readonly { users: number; conversions: number }[]): Hash128 {
  return cyrb128(JSON.stringify([FORMAT_VERSION, groups.map((g) => [g.users, g.conversions])]));
}
