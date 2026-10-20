import { describe, expect, it } from "vitest";
import { analyzeInFreshEngine, cores } from "./__fixtures__/fresh-engine.mjs";
import { analysisInput, settings } from "./__fixtures__/scenarios";

const five = analysisInput([[30000, 900], [30000, 990], [30000, 960], [30000, 880], [30000, 1020]]);
const calls = {
  inputs: [analysisInput([[50000, 1000], [48500, 1000]]), analysisInput([[1000, 0], [1000, 10]]), five, five, five, five],
  settings: settings(),
};

const COLD_STARTS = 48;

describe("engine determinism across JIT tiers (PRD: same input, same output)", () => {
  it("every cold engine returns what the interpreter returns, call after call", async () => {
    const interpreted = await analyzeInFreshEngine(["--no-sparkplug", "--no-maglev", "--no-turbofan"], calls);
    // The delay keeps background compiles in flight longer, which is when V8 13.6 (Node 24)
    // miscompiled the lift payload (nodejs/node#66457): a variant read another variant's number.
    const flags = ["--concurrent-recompilation-delay=15"];
    const differing: number[] = [];
    const batch = Math.max(1, cores - 1);
    for (let start = 0; start < COLD_STARTS; start += batch) {
      const runs = Array.from({ length: Math.min(batch, COLD_STARTS - start) }, () => analyzeInFreshEngine(flags, calls));
      (await Promise.all(runs)).forEach((out, i) => out !== interpreted && differing.push(start + i));
    }
    expect(differing, "cold starts whose results differ from the interpreter").toEqual([]);
  }, 120_000);
});
