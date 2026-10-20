import { analyze, planPretest, toPlan } from "../stats";
import type { EngineRequest, EngineResponse } from "./engine-protocol";

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const { id, analysis, pretest, settings, selectedWeek } = event.data;
  const result = analysis ? analyze(analysis, settings) : null;
  const planning = pretest ? planPretest(pretest, settings) : null;
  const plan =
    pretest && planning?.kind === "ok"
      ? toPlan(pretest, planning, selectedWeek, new Date())
      : null;
  const days = analysis?.days;
  const control = analysis?.groups[0];
  const details =
    analysis && days && control && control.conversions > 0
      ? planPretest(
          {
            weeklyTraffic:
              ((analysis.groups.reduce((sum, g) => sum + g.users, 0) / days) *
                7) /
              analysis.trafficShare,
            weeklyConversions:
              ((((analysis.groups.reduce((sum, g) => sum + g.users, 0) / days) *
                7) /
                analysis.trafficShare) *
                control.conversions) /
              control.users,
            groups:
              analysis.groups.length === 5
                ? 5
                : analysis.groups.length === 4
                  ? 4
                  : analysis.groups.length === 3
                    ? 3
                    : 2,
            trafficShare: analysis.trafficShare,
            horizonWeeks: 12,
            mode: "mde-by-week",
            targetLift: analysis.referenceLift,
            looks: { kind: "single" },
          },
          settings,
        )
      : null;
  const response: EngineResponse = {
    id,
    analysis: result,
    pretest: planning,
    details,
    plan,
  };
  self.postMessage(response);
};
