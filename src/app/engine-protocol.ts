import type { GroupFields } from "./state";

import type {
  AnalysisInput,
  GroupData,
  GroupStats,
  AnalysisResult,
  Plan,
  PretestInput,
  PretestResult,
  Settings,
} from "../stats/types";
export interface EngineRequest {
  id: number;
  analysis: AnalysisInput | null;
  groups: GroupData[];
  incompleteGroups: GroupFields[];
  pretest: PretestInput | null;
  settings: Settings;
  selectedWeek: number | null;
}
export interface EngineResponse {
  id: number;
  analysis: AnalysisResult | null;
  groupRates: Pick<GroupStats, "id" | "rate">[];
  pretest: PretestResult | null;
  details: PretestResult | null;
  plan: Plan | null;
}
