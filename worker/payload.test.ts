import { describe, expect, it } from "vitest";
import { TLDR_REQUEST_MAX_BYTES } from "../src/shared/tldr-contract";
import { isRecord, parseTldrRequest, readTldrRequest } from "./payload";
import { requestFixture } from "./test-fixture";

function changed(path: string, value: unknown): unknown {
  const raw = requestFixture();
  const keys = path.split(".");
  let target: unknown = raw;
  for (const key of keys.slice(0, -1)) {
    if (Array.isArray(target)) target = target[Number(key)];
    else if (isRecord(target)) target = target[key];
  }
  const last = keys.at(-1);
  if (last !== undefined && isRecord(target)) target[last] = value;
  return raw;
}

describe("parseTldrRequest", () => {
  it("accepts a complete request and truncates names without mutating input", () => {
    const raw = requestFixture();
    if (raw.groups[0]) raw.groups[0].name = "x".repeat(60);
    const parsed = parseTldrRequest(raw);
    expect(parsed.ok && parsed.value.groups[0]?.name).toBe("x".repeat(40));
    expect(raw.groups[0]?.name).toHaveLength(60);
  });

  it.each([
    ["locale", "fr"], ["locale", null], ["turnstileToken", " "], ["turnstileToken", 4], ["turnstileToken", "x".repeat(2049)],
    ["context", null], ["context.method", "ttest"], ["context.confidence", 0.94], ["context.confidence", "0.95"],
    ["context.power", 0.7], ["context.hypothesis", "both"], ["context.bonferroni", 1], ["context.sequential", {}],
    ["context.sequential", { look: 3, plannedLooks: 2, zBoundary: 2, crossed: false }],
    ["context.sequential", { look: 1, plannedLooks: 13, zBoundary: 2, crossed: false }],
    ["context.sequential", { look: 1, plannedLooks: 2, zBoundary: Infinity, crossed: false }],
    ["context.sequential", { look: 1, plannedLooks: 2, zBoundary: 2, crossed: 0 }],
    ["groups", []], ["groups", Array(6).fill({})], ["groups.0.id", "B"], ["groups.0.name", 0],
    ["groups.0.users", 0], ["groups.0.users", 1.5], ["groups.0.conversions", -1], ["groups.0.conversions", 50001],
    ["groups.0.rate", NaN], ["groups.0.rate", 1.01], ["groups.0.intendedSplit", 0], ["groups.0.intendedSplit", 0.6],
    ["variants", []], ["variants.0.id", "A"], ["variants.0.lift", Infinity], ["variants.0.lift", -1.1],
    ["variants.0.pValue", -0.1], ["variants.0.probabilityToBeatControl", 2], ["variants.0.ciRelative", [2, 1]],
    ["variants.0.ciRelative", [0, Infinity]], ["variants.0.ciRelative", [1]], ["variants.0.expectedLossRelative", -1],
    ["variants.0.verdict", "maybe"], ["duration", {}], ["duration.days", 0], ["duration.days", 1.5],
    ["duration.trafficShare", 0], ["duration.trafficShare", 100], ["duration.plannedSamplePerVariant", -1],
    ["duration.referenceLift", 0], ["duration.extraDays", -1], ["revenue", {}],
    ["revenue", { currency: "BRL", monthlyContribution: Infinity, horizonMonths: 3, horizonImpact: 10 }],
    ["revenue", { currency: "BTC", monthlyContribution: 1, horizonMonths: 3, horizonImpact: 3 }],
    ["revenue", { currency: "BRL", monthlyContribution: 1, horizonMonths: 2, horizonImpact: 2 }],
    ["revenue", { currency: "BRL", monthlyContribution: 1, horizonMonths: 3, horizonImpact: "3" }],
    ["findings", null], ["findings", [{ rule: "unknown" }]], ["findings", [{ rule: "toString" }]],
    ["findings", [{ rule: "srm", pValue: Infinity }]], ["findings", [{ rule: "srm", bad: {} }]],
  ])("rejects invalid %s (%j)", (path, value) => {
    expect(parseTldrRequest(changed(path, value))).toEqual({ ok: false });
  });

  it.each([null, false, [], {}, "payload"])("rejects an invalid root %j", raw => {
    expect(parseTldrRequest(raw)).toEqual({ ok: false });
  });

  it("accepts optional numeric blocks and nullable zero-control results", () => {
    const raw = requestFixture();
    raw.context.sequential = { look: 1, plannedLooks: 2, zBoundary: 2.8, crossed: false };
    raw.revenue = { currency: "BRL", monthlyContribution: -100, horizonMonths: 6, horizonImpact: -600 };
    if (raw.variants[0]) Object.assign(raw.variants[0], { lift: null, ciRelative: null, expectedLossRelative: null });
    raw.duration.days = null;
    raw.duration.extraDays = null;
    expect(parseTldrRequest(raw)).toEqual({ ok: true, value: raw });
  });
});

describe("readTldrRequest", () => {
  it("rejects oversized streamed bytes even with no Content-Length", async () => {
    const body = JSON.stringify({ ...requestFixture(), padding: "é".repeat(TLDR_REQUEST_MAX_BYTES / 2) });
    expect(await readTldrRequest(new Request("https://app/api/tldr", { method: "POST", body }))).toEqual({ ok: false });
  });
  it("rejects an oversized declared body before reading", async () => {
    expect(await readTldrRequest(new Request("https://app/api/tldr", {
      method: "POST", headers: { "Content-Length": String(TLDR_REQUEST_MAX_BYTES + 1) }, body: "{}",
    }))).toEqual({ ok: false });
  });
  it.each(["{", "null", ""])("rejects malformed or missing body %j", async body => {
    expect(await readTldrRequest(new Request("https://app/api/tldr", { method: "POST", body }))).toEqual({ ok: false });
  });
  it("reads valid JSON", async () => {
    const raw = requestFixture();
    expect(await readTldrRequest(new Request("https://app/api/tldr", { method: "POST", body: JSON.stringify(raw) })))
      .toEqual({ ok: true, value: raw });
  });
});
