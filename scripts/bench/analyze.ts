// Wall time of analyze() per call, 2 and 5 groups, against the 16 ms main-thread budget (PRD 18).
// npx esbuild scripts/bench/analyze.ts --bundle --platform=node --format=esm --log-level=warning | node --input-type=module
import { analyze, equalSplit, GROUP_IDS, toFraction, toLift } from "../../src/stats/index";
import type { AnalysisInput, GroupCount, Settings } from "../../src/stats/index";

const RUNS = 20;
const settings: Settings = { confidence: 0.95, power: 0.8, hypothesis: "two-sided", bonferroni: true };

function input(counts: readonly (readonly [number, number])[], bump: number): AnalysisInput {
  return {
    days: 28,
    trafficShare: toFraction(1)!,
    groups: counts.map(([users, conversions], i) => ({
      id: GROUP_IDS[i]!,
      name: `G${i}`,
      users,
      conversions: conversions + (i === 0 ? bump : 0),
    })),
    intendedSplit: equalSplit(counts.length as GroupCount),
    method: "bayesian",
    sequential: { enabled: false },
    referenceLift: toLift(0.1)!,
    plannedSamplePerVariant: null,
    revenue: null,
  };
}

function bench(label: string, counts: readonly (readonly [number, number])[]): void {
  for (let i = 0; i < 5; i++) analyze(input(counts, -1 - i), settings);
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    // A different conversion count per run changes the seed, so no run reuses another's draws.
    const data = input(counts, i);
    const t0 = performance.now();
    const result = analyze(data, settings);
    times.push(performance.now() - t0);
    if (result.kind !== "ok") throw new Error("expected an ok result");
  }
  times.sort((a, b) => a - b);
  const ms = (x: number) => x.toFixed(2);
  console.log(`${label}, ${RUNS} runs: median ${ms(times[RUNS / 2]!)} ms, min ${ms(times[0]!)} ms, max ${ms(times[RUNS - 1]!)} ms`);
}

bench("analyze 2 groups", [[80000, 1600], [80000, 1696]]);
bench("analyze 5 groups", [[30000, 900], [30000, 990], [30000, 960], [30000, 880], [30000, 1020]]);
