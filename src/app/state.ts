// UI state of the calculator: one object for both tabs (PRD sections 2 and 13).
// Field values are kept as the raw text the user typed ("1,5" mid-edit is legal) and are parsed
// into engine types only at the boundary (src/app/parse.ts). The whole object is what travels in
// the URL fragment and in the localStorage draft, so it must stay plain JSON.
import type {
  Currency,
  GroupCount,
  GroupId,
  HorizonMonths,
  LookPlan,
  Method,
  Plan,
  PretestMode,
  Settings,
  Tldr,
} from "../stats/types";

export const STATE_VERSION = 1;

/** The active tab is the route (/pt/analise vs /pt/pre-teste), never a state field. */
export type Tab = "analysis" | "pretest";

export interface PretestFields {
  weeklyTraffic: string;
  weeklyConversions: string;
  groups: GroupCount;
  trafficPct: string; // "100"
  horizonWeeks: number; // 1..12, default 4
  mode: PretestMode;
  targetLiftPct: string; // "10"
  looks: LookPlan;
  selectedWeek: number | null; // Mode A row chosen for the plan
}

export interface GroupFields {
  id: GroupId;
  name: string;
  users: string;
  conversions: string;
  splitPct: string; // intended split, "50"
}

export interface AnalysisFields {
  days: string;
  trafficPct: string;
  groups: GroupFields[]; // 2..5, index 0 is the control
  method: Method;
  sequential: { enabled: boolean; plannedLooks: string; currentLook: string };
  referenceLiftPct: string; // "10" unless a plan set it
  valuePerConversion: string;
  horizonMonths: HorizonMonths;
}

export interface AppState {
  v: typeof STATE_VERSION;
  settings: Settings;
  currency: Currency;
  pretest: PretestFields;
  analysis: AnalysisFields;
  plan: Plan | null;
  /** Pre-test fields at the moment the plan was taken, to show "Atualizar plano" when they change. */
  planSource: PretestFields | null;
  tldr: Tldr | null;
}

export type Action =
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "currency"; currency: Currency }
  | { type: "pretest"; patch: Partial<PretestFields> }
  | { type: "analysis"; patch: Partial<Omit<AnalysisFields, "groups">> }
  | { type: "group"; id: GroupId; patch: Partial<Omit<GroupFields, "id">> }
  | { type: "add-variant" }
  | { type: "remove-variant"; id: GroupId }
  | { type: "use-plan"; plan: Plan }
  | { type: "tldr"; tldr: Tldr | null }
  | { type: "example"; tab: Tab }
  | { type: "clear" }
  | { type: "replace"; state: AppState };
