import { GROUP_IDS } from "../stats";
import type { GroupCount, GroupId, Locale } from "../stats";
import { ui } from "../i18n/ui";
import type { Action, AppState, GroupFields } from "./state";
import { STATE_VERSION } from "./state";

export function newGroup(id: GroupId, locale: Locale): GroupFields {
  return {
    id,
    name: id === "A" ? ui[locale].control : `${ui[locale].variant} ${id}`,
    users: "",
    conversions: "",
    splitPct: "50",
  };
}
function rebalance(groups: GroupFields[]): GroupFields[] {
  const base = Math.floor(1000000 / groups.length);
  return groups.map((g, i) => ({
    ...g,
    splitPct: String(
      (i === groups.length - 1 ? 1000000 - base * (groups.length - 1) : base) /
        10000,
    ),
  }));
}
export function initialState(locale: Locale): AppState {
  return {
    v: STATE_VERSION,
    settings: {
      confidence: 0.95,
      power: 0.8,
      hypothesis: "two-sided",
      bonferroni: true,
    },
    currency: locale === "pt" ? "BRL" : "USD",
    pretest: {
      weeklyTraffic: "",
      weeklyConversions: "",
      groups: 2,
      trafficPct: "100",
      horizonWeeks: 4,
      mode: "mde-by-week",
      targetLiftPct: "10",
      looks: { kind: "single" },
      selectedWeek: null,
    },
    analysis: {
      days: "",
      trafficPct: "100",
      groups: [newGroup("A", locale), newGroup("B", locale)],
      method: "bayesian",
      sequential: { enabled: false, plannedLooks: "4", currentLook: "1" },
      referenceLiftPct: "10",
      valuePerConversion: "",
      horizonMonths: 6,
    },
    plan: null,
    planSource: null,
    tldr: null,
  };
}
export function reducer(
  state: AppState,
  action: Action,
  locale: Locale = "pt",
): AppState {
  switch (action.type) {
    case "settings":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "currency":
      return { ...state, currency: action.currency };
    case "pretest": {
      const pretest = { ...state.pretest, ...action.patch };
      if (
        pretest.selectedWeek !== null &&
        pretest.selectedWeek > pretest.horizonWeeks
      )
        pretest.selectedWeek = pretest.horizonWeeks;
      return { ...state, pretest };
    }
    case "analysis": {
      const analysis = { ...state.analysis, ...action.patch };
      if (action.patch.sequential?.enabled) analysis.method = "ztest";
      if (action.patch.method === "bayesian")
        analysis.sequential = { ...analysis.sequential, enabled: false };
      return { ...state, analysis };
    }
    case "group":
      return {
        ...state,
        analysis: {
          ...state.analysis,
          groups: state.analysis.groups.map((g) =>
            g.id === action.id ? { ...g, ...action.patch } : g,
          ),
        },
      };
    case "add-variant": {
      const id = GROUP_IDS.find(
        (id) => !state.analysis.groups.some((g) => g.id === id),
      );
      if (!id) return state;
      return {
        ...state,
        analysis: {
          ...state.analysis,
          groups: rebalance(
            [...state.analysis.groups, newGroup(id, locale)].sort((a, b) =>
              a.id.localeCompare(b.id),
            ),
          ),
        },
      };
    }
    case "remove-variant": {
      if (action.id === "A" || state.analysis.groups.length <= 2) return state;
      return {
        ...state,
        analysis: {
          ...state.analysis,
          groups: rebalance(
            state.analysis.groups.filter((g) => g.id !== action.id),
          ),
        },
      };
    }
    case "use-plan": {
      const plan = action.plan;
      const groups = GROUP_IDS.slice(0, plan.groups).map(
        (id) =>
          state.analysis.groups.find((g) => g.id === id) ??
          newGroup(id, locale),
      );
      return {
        ...state,
        plan,
        planSource: structuredClone(state.pretest),
        analysis: {
          ...state.analysis,
          groups: rebalance(groups),
          trafficPct: String(plan.trafficShare * 100),
          referenceLiftPct: String(plan.referenceLift * 100),
          method: plan.looks > 1 ? "ztest" : state.analysis.method,
          sequential: {
            enabled: plan.looks > 1,
            plannedLooks: String(plan.looks),
            currentLook: "1",
          },
        },
      };
    }
    case "tldr":
      return { ...state, tldr: action.tldr };
    case "example": {
      if (action.tab === "pretest")
        return {
          ...state,
          pretest: {
            ...state.pretest,
            weeklyTraffic: "10000",
            weeklyConversions: "300",
          },
        };
      const groups = rebalance([
        newGroup("A", locale),
        newGroup("B", locale),
      ]).map((g, i) => ({
        ...g,
        users: "80000",
        conversions: i === 0 ? "1600" : "1696",
      }));
      return { ...state, analysis: { ...state.analysis, days: "14", groups } };
    }
    case "clear":
      return initialState(locale);
    case "replace":
      return action.state;
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}
export function groupCount(n: number): GroupCount {
  switch (n) {
    case 3:
    case 4:
    case 5:
      return n;
    default:
      return 2;
  }
}
