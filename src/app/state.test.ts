import { describe, expect, it } from "vitest";
import { canUsePlan, initialState, reducer } from "./reducer";
import { parseAnalysis, parseGroup, parsePretest, readNumber } from "./parse";
import { planPretest, toPlan } from "../stats";
import { formatters } from "./format";

describe("calculator input boundary", () => {
  it("accepts local decimals without interpreting thousands separators", () => {
    expect(readNumber("1,5", "pt")).toBe(1.5);
    expect(readNumber("80.000", "pt")).toBe(80);
    expect(readNumber("1,5", "en")).toBeNull();
    expect(readNumber("1e8", "en")).toBeNull();
    expect(readNumber("Infinity", "pt")).toBeNull();
    expect(formatters.pt.pct(0.06)).toBe("6,00%");
    expect(formatters.en.pct(0.06)).toBe("6.00%");
  });
  it("rejects impossible counts and invalid splits at the field", () => {
    let state = reducer(initialState("pt"), {
      type: "example",
      tab: "analysis",
    });
    state = reducer(state, {
      type: "group",
      id: "B",
      patch: { conversions: "80001", splitPct: "40" },
    });
    const parsed = parseAnalysis(
      state.analysis,
      state.currency,
      state.plan,
      "pt",
    );
    expect(parsed.kind).toBe("invalid");
    expect(parsed.errors["B.conversions"]).toBe("exceeds");
    expect(parsed.errors.split).toBe("splitError");
  });
  it("accepts a missing duration and rejects an impossible target lift", () => {
    let state = reducer(initialState("pt"), {
      type: "example",
      tab: "analysis",
    });
    state = reducer(state, { type: "analysis", patch: { days: "" } });
    const parsed = parseAnalysis(state.analysis, state.currency, null, "pt");
    expect(parsed.kind === "ok" && parsed.input.days).toBeNull();
    const pre = {
      ...state.pretest,
      weeklyTraffic: "1000",
      weeklyConversions: "800",
      targetLiftPct: "30",
      mode: "target-lift" as const,
    };
    expect(parsePretest(pre, "pt").errors.targetLiftPct).toBe("liftTooHigh");
  });
});
describe("calculator actions", () => {
  it("keeps group slots stable through removal and addition", () => {
    let state = initialState("pt");
    for (let i = 0; i < 3; i++) state = reducer(state, { type: "add-variant" });
    state = reducer(state, { type: "remove-variant", id: "C" });
    expect(state.analysis.groups.map((g) => g.id)).toEqual([
      "A",
      "B",
      "D",
      "E",
    ]);
    state = reducer(state, { type: "add-variant" });
    expect(state.analysis.groups.map((g) => g.id)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
    expect(
      state.analysis.groups.reduce((s, g) => s + Number(g.splitPct), 0),
    ).toBe(100);
  });
  it("switches to Z test for sequential analysis and clamps the selected week", () => {
    let state = initialState("en");
    state = reducer(state, {
      type: "analysis",
      patch: {
        sequential: { enabled: true, currentLook: "1", plannedLooks: "4" },
      },
    });
    expect(state.analysis.method).toBe("ztest");
    state = reducer(state, {
      type: "pretest",
      patch: { selectedWeek: 4, horizonWeeks: 2 },
    });
    expect(state.pretest.selectedWeek).toBe(2);
  });
});

it("inherits a weekly plan with more than twelve looks while limiting manual entry", () => {
  const state = reducer(initialState("pt"), {
    type: "example",
    tab: "analysis",
  });
  const parsed = parseAnalysis(state.analysis, state.currency, null, "pt");
  if (parsed.kind !== "ok") throw new Error("Example must parse");
  const planned = reducer(state, {
    type: "use-plan",
    plan: {
      createdAt: new Date().toISOString(),
      groups: 2,
      trafficShare: parsed.input.trafficShare,
      referenceLift: parsed.input.referenceLift,
      samplePerVariant: 200000,
      days: 280,
      looks: 40,
    },
  });
  const inherited = parseAnalysis(
    planned.analysis,
    planned.currency,
    planned.plan,
    "pt",
  );
  expect(
    inherited.kind === "ok" &&
      inherited.input.sequential.enabled &&
      inherited.input.sequential.plannedLooks,
  ).toBe(40);
  expect(
    parseAnalysis(planned.analysis, planned.currency, null, "pt").errors
      .plannedLooks,
  ).toBe("looksError");
});

it("keeps an undetectable rate-ceiling plan out of analysis and shared state", () => {
  const state = initialState("pt");
  const parsed = parsePretest(
    { ...state.pretest, weeklyTraffic: "10000", weeklyConversions: "10000" },
    "pt",
  );
  if (parsed.kind !== "ok") throw new Error("Rate ceiling is a valid input");
  const result = planPretest(parsed.input, state.settings);
  if (result.kind !== "ok") throw new Error("Mode A must show its MDE table");
  expect(canUsePlan(toPlan(parsed.input, result, null, new Date()))).toBe(
    false,
  );
});

it("parses a complete group before the other groups are filled", () => {
  const state = initialState("pt");
  const control = {
    id: "A" as const,
    name: "Controle",
    users: "80000",
    conversions: "1600",
    splitPct: "50",
  };
  state.analysis.groups[0] = control;
  const parsed = parseGroup(control, "pt");
  expect(parsed.kind === "ok" && parsed.input).toEqual({
    id: "A",
    name: "Controle",
    users: 80000,
    conversions: 1600,
  });
  expect(parseAnalysis(state.analysis, state.currency, null, "pt").kind).toBe(
    "invalid",
  );
});
