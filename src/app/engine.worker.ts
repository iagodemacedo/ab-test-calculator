import { rate } from "../stats/ztest";
import { analyze, planPretest, toPlan } from "../stats";
import type { EngineRequest, EngineResponse } from "./engine-protocol";

self.onmessage = async (event: MessageEvent<EngineRequest>) => {
  const { id, analysis, pretest, settings, selectedWeek } = event.data;
  const result = analysis ? analyze(analysis, settings) : null;
  if (result?.kind === "ok" && event.data.incompleteGroups.length) {
    const fingerprint = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(event.data.incompleteGroups)),
    );
    result.inputHash +=
      ":" +
      Array.from(new Uint8Array(fingerprint), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
  }
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
    groupRates: event.data.groups.map((group) => ({
      id: group.id,
      rate: rate(group),
    })),
    pretest: planning,
    details,
    plan,
  };
  self.postMessage(response);
};
