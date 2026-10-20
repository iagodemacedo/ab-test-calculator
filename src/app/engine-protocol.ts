import type { AnalysisInput, AnalysisResult, Plan, PretestInput, PretestResult, Settings } from '../stats/types';
export interface EngineRequest {
  id: number;
  analysis: AnalysisInput | null;
  pretest: PretestInput | null;
  settings: Settings;
  selectedWeek: number | null;
}
export interface EngineResponse {
  id: number;
  analysis: AnalysisResult | null;
  pretest: PretestResult | null;
  details: PretestResult | null;
  plan: Plan | null;
}
