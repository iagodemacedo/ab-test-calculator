import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const run = process.env.ABCALC_RUN_ID;
const origin = process.env.ABCALC_APP_URL;
if (!run || !origin)
  throw new Error(
    "Set ABCALC_RUN_ID and ABCALC_APP_URL from the launched ctl instance",
  );
const directory = join("artifacts", "verify", run, "lighthouse");
mkdirSync(directory, { recursive: true });
const chrome =
  process.env.ABCALC_CHROME ??
  "/home/elliot/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell";
const results = [];
for (const route of ["analise", "pre-teste"]) {
  for (const device of ["desktop", "mobile"]) {
    const output = join(directory, `${route}-${device}.json`);
    const args = [
      "-y",
      "lighthouse",
      `${origin}/pt/${route}`,
      "--chrome-flags=--no-sandbox --headless",
      "--only-categories=performance,accessibility,best-practices",
      "--output=json",
      `--output-path=${output}`,
      "--quiet",
    ];
    if (device === "desktop") args.push("--preset=desktop");
    const call = spawnSync("npx", args, {
      env: { ...process.env, CHROME_PATH: chrome },
      encoding: "utf8",
    });
    writeFileSync(output + ".log", call.stdout + call.stderr);
    if (call.status !== 0)
      throw new Error(
        `Lighthouse failed for ${route} ${device}. See ${output}.log`,
      );
    const report = JSON.parse(readFileSync(output, "utf8"));
    if (
      report.runtimeError ||
      report.finalDisplayedUrl !== `${origin}/pt/${route}`
    )
      throw new Error(`Audit did not reach ${route}`);
    const result = {
      route: `/pt/${route}`,
      device,
      version: report.lighthouseVersion,
      scores: Object.fromEntries(
        Object.entries(report.categories).map(([key, value]) => [
          key,
          Math.round(value.score * 100),
        ]),
      ),
      errors: report.audits["errors-in-console"].details?.items ?? [],
      metrics: {
        fcp: report.audits["first-contentful-paint"].numericValue,
        lcp: report.audits["largest-contentful-paint"].numericValue,
        tbt: report.audits["total-blocking-time"].numericValue,
        cls: report.audits["cumulative-layout-shift"].numericValue,
      },
    };
    results.push(result);
    writeFileSync(
      join(directory, "summary.json"),
      JSON.stringify(results, null, 2),
    );
    console.log(JSON.stringify(result));
  }
}
if (
  results.some(
    (result) =>
      result.errors.length ||
      Object.values(result.scores).some((score) => score < 95),
  )
)
  process.exitCode = 1;
