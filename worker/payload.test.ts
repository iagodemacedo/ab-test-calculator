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
    ["context.power", 0.7], ["context.hypothesis", "both"], ["context.bonferroni", 1],
    ["groups", []], ["groups", Array(6).fill({})], ["groups.0.id", "B"], ["groups.1.id", "A"], ["groups.1.id", "F"],
    ["groups.0.name", 0],
    ["groups.0.users", 0], ["groups.0.users", 1.5], ["groups.0.conversions", -1], ["groups.0.conversions", 50001],
    ["groups.0.rate", NaN], ["groups.0.rate", 1.01], ["groups.0.intendedSplit", 0], ["groups.0.intendedSplit", 0.6],
    ["variants", []], ["variants.0.id", "A"], ["variants.0.id", "C"], ["variants.0.lift", Infinity], ["variants.0.lift", -1.1],
    ["variants.0.pValue", -0.1], ["variants.0.probabilityToBeatControl", 2], ["variants.0.ciRelative", [2, 1]],
    ["variants.0.ciRelative", [0, Infinity]], ["variants.0.ciRelative", [null, 1]], ["variants.0.ciRelative", [1]],
    ["variants.0.expectedLossRelative", -1], ["variants.0.achievedMde", Infinity], ["variants.0.achievedMde", -0.1],
    ["variants.0.verdict", "maybe"], ["variants.0.sequential", {}],
    ["variants.0.sequential", { look: 3, plannedLooks: 2, zBoundary: 2, zObserved: 1, crossed: false }],
    ["variants.0.sequential", { look: 1, plannedLooks: 101, zBoundary: 2, zObserved: 1, crossed: false }],
    ["variants.0.sequential", { look: 1, plannedLooks: 2, zBoundary: Infinity, zObserved: 1, crossed: false }],
    ["variants.0.sequential", { look: 1, plannedLooks: 2, zBoundary: 2, zObserved: "1", crossed: false }],
    ["variants.0.sequential", { look: 1, plannedLooks: 2, zBoundary: 2, zObserved: 1, crossed: 0 }],
    ["duration", {}], ["duration.days", 0], ["duration.days", 1.5],
    ["duration.trafficShare", 0], ["duration.trafficShare", 100], ["duration.plannedSamplePerVariant", -1],
    ["duration.referenceLift", 0], ["duration.extraDays", -1], ["duration.extraDays", Infinity], ["revenue", {}],
    ["revenue", { currency: "BRL", horizonMonths: 3, perVariant: [] }],
    ["revenue", { currency: "BRL", horizonMonths: 3, perVariant: [{ id: "C", monthlyContribution: 1, horizonImpact: 3 }] }],
    ["revenue", { currency: "BRL", horizonMonths: 3, perVariant: [{ id: "B", monthlyContribution: Infinity, horizonImpact: 3 }] }],
    ["revenue", { currency: "BRL", horizonMonths: 3, perVariant: [{ id: "B", monthlyContribution: 1, horizonImpact: "3" }] }],
    ["revenue", { currency: "BTC", horizonMonths: 3, perVariant: [{ id: "B", monthlyContribution: 1, horizonImpact: 3 }] }],
    ["revenue", { currency: "BRL", horizonMonths: 2, perVariant: [{ id: "B", monthlyContribution: 1, horizonImpact: 2 }] }],
    ["revenue", { currency: "BRL", monthlyContribution: 1, horizonMonths: 3, horizonImpact: 3 }],
    ["findings", null], ["findings", [{ rule: "unknown" }]], ["findings", [{ rule: "toString" }]],
    ["findings", [{ rule: "srm", pValue: Infinity }]], ["findings", [{ rule: "srm", bad: {} }]],
  ])("rejects invalid %s (%j)", (path, value) => {
    expect(parseTldrRequest(changed(path, value))).toEqual({ ok: false });
  });

  it.each([null, false, [], {}, "payload"])("rejects an invalid root %j", raw => {
    expect(parseTldrRequest(raw)).toEqual({ ok: false });
  });

  it("accepts optional numeric blocks, nulls for non-finite numbers and nullable zero-control results", () => {
    const raw = requestFixture();
    raw.revenue = { currency: "BRL", horizonMonths: 6, perVariant: [{ id: "B", monthlyContribution: -100, horizonImpact: -600 }] };
    if (raw.variants[0]) Object.assign(raw.variants[0], {
      lift: null, ciRelative: null, expectedLossRelative: null, achievedMde: null,
      sequential: { look: 100, plannedLooks: 100, zBoundary: null, zObserved: null, crossed: false },
    });
    raw.duration.days = null;
    raw.duration.extraDays = null;
    raw.findings = [{ rule: "mde_high", variant: "B", mde: null }];
    expect(parseTldrRequest(raw)).toEqual({ ok: true, value: raw });
  });

  it("accepts a one-sided interval without an upper bound", () => {
    const raw = requestFixture();
    if (raw.variants[0]) raw.variants[0].ciRelative = [-0.02, null];
    expect(parseTldrRequest(raw)).toEqual({ ok: true, value: raw });
  });

  it.each([
    [["A", "B", "D"], true], [["A", "C", "E"], true], [["A", "E"], true], [["A", "B", "C", "D", "E"], true],
    [["A", "D", "C"], false], [["A", "B", "B"], false], [["B", "C"], false], [["A"], false],
  ])("group slots %j accepted: %s", (ids, accepted) => {
    const raw = requestFixture();
    const [control, variant] = [raw.groups[0]!, raw.variants[0]!];
    raw.groups = ids.map(id => ({ ...control, id, intendedSplit: 1 / ids.length } as typeof control));
    raw.variants = ids.slice(1).map(id => ({ ...variant, id } as typeof variant));
    expect(parseTldrRequest(raw).ok).toBe(accepted);
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
