import { describe, expect, it } from "vitest";
import { initialState, reducer } from "./reducer";
import { parseAnalysis, parsePretest, readNumber } from "./parse";
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
