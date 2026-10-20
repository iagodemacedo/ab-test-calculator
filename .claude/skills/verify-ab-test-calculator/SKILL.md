---
name: verify-ab-test-calculator
description: Launch AB Test Calculator (Astro static site + /api/tldr Cloudflare Worker) locally and drive it in a headless browser the way a user does, to prove a change works with screenshots, ARIA snapshots and network logs. Use after any change to the calculator pages, the statistics engine, the TL;DR Worker, sharing, i18n or theming, and before claiming a feature works.
---

# verify-ab-test-calculator

Drives the real app: the built static pages and the `/api/tldr` Worker served together by the local Cloudflare dev server, opened in headless Chromium, and operated by accessible role and name. All commands go through `scripts/ctl` (run from the repo root as `.claude/skills/verify-ab-test-calculator/scripts/ctl`, written `ctl` below).

> **Status (2026-10-20): app launch and calculator journeys verified.** Real app runs proved launch, doctor, hydration, analysis, planning, sharing, locale/theme and fallback. See `.audit/ui-report.md` for run IDs and remaining gaps. The single real TL;DR rendered, but its rule-title assertion failed before the stale step; the UI fix has unit coverage and that live journey remains unverified.

Product truth lives in `PRD.md`, `ROUTES.md` and `DESIGN.md` at the repo root. The feature map in `features/` turns them into journeys.

## Launch

```bash
eval "$(.claude/skills/verify-ab-test-calculator/scripts/ctl launch)"   # exports ABCALC_RUN_ID
```

What it does (mode `app`):

1. Picks two free ports on 127.0.0.1 (app and Chrome DevTools), so runs never collide.
2. Installs deps with the repo's package manager (`pnpm` if `pnpm-lock.yaml` exists, else `npm`). **pnpm is not installed on this machine**: run `corepack enable` once if the repo adopts pnpm.
3. Builds with `PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` (Cloudflare test key, always passes) and `PUBLIC_UMAMI_WEBSITE_ID` empty (no analytics from verification runs) unless `ABCALC_UMAMI_WEBSITE_ID` is set.
4. Starts `npx wrangler dev --ip 127.0.0.1 --port <app> --persist-to <run>/wrangler --var TURNSTILE_SECRET_KEY:1x0000000000000000000000000000000AA` in its own process group. Override the whole command with `ABCALC_LAUNCH_CMD` if the scaffold needs something else. Verified against `wrangler.jsonc`: static Astro pages and the Worker share this server. `cf dev` was not used because it runs the framework dev server and does not forward `--port`.
5. Ready = `GET /pt/analise` (redirects followed) returns HTML containing `AB Test Calculator`, within 180 s (`ABCALC_READY_TIMEOUT`). In the browser, `ctl browser goto` additionally waits for `main[data-ready="true"]`, the hydration marker the calculator island must set (contract, see Gotchas). On failure, launch prints the log tail and cleans up its own processes.

There is no seed data and no database: every journey starts from an empty page, and state lives in the URL fragment and `localStorage` of this run's private Chrome profile.

`ctl launch --standin` serves `scripts/standin/` (verification scaffolding, not the app) and is only for `ctl selftest`.

## Doctor

Run first, and again whenever anything looks off. Read-only.

```bash
.claude/skills/verify-ab-test-calculator/scripts/ctl doctor
```

| Check | Pass means |
|---|---|
| app process | the process this run started is alive |
| port owned by run | the app port is held by this run's process group, not someone else's server |
| page /pt/analise, /en/analysis | both locales answer 200 |
| build revision | HEAD still equals the commit built at launch (relaunch if not) |
| api /api/tldr route | `GET /api/tldr` answers 405, proving the Worker route exists without calling the AI. Verified contract |
| cloudflare auth | `cf auth whoami` reports a valid token (the Workers AI binding always runs remotely, even in local dev) |
| browser (CDP) | the run's Chromium answers on its DevTools port |

Never drive an instance whose doctor fails, and never drive an instance this run did not launch.

## Drive

Start the browser once per run, then issue one command per user action. Each command connects to the same tab, so navigation, inputs and `localStorage` persist between commands. Output is one JSON line; `"ok": false` means the step failed.

```bash
ctl browser start
ctl browser goto /pt/analise                       # path or full URL; waits for hydration
ctl browser fill  --role spinbutton --name "Usuários (Controle)" --value 80000
ctl browser click --role radio --name "Unicaudal" --wait-text "Vencedora"
ctl browser text  --role region --name "Resultados"
ctl browser snapshot --role region --name "Resultados" --path "$EV/analysis/results.aria.txt"
ctl browser screenshot --path "$EV/analysis/results.png" [--full]
```

| Command | Use |
|---|---|
| `start [--lang pt-BR]` | launch headless Chromium for this run (Playwright headless shell; the full Chromium build lacks system libraries here). `--lang` sets the UI language and `Accept-Language` for the whole run |
| `goto <path>` | navigate; `--wait-ready false` skips the hydration wait (404 page, redirects) |
| `click`, `fill`, `press <Key>`, `hover` | user actions |
| `text`, `value`, `attr --attr <name>`, `url` | read what the user sees |
| `clipboard` | read the clipboard after "Salvar e compartilhar link" |
| `storage` | read-only list of `localStorage` keys and sizes (proves the local draft exists or was cleared) |
| `snapshot --path f.aria.txt` | ARIA snapshot of the page or of a target |
| `screenshot --path f.png [--viewport 390x844]` | screenshot at the specified viewport; a target captures only that element |
| `layout --css <selector>` | read-only dimensions, scroll width, text, opacity and chart marks |
| `network --path f.json` | reload and record every request with its body (proves what leaves the browser) |

Targets: `--role <role> --name <accessible name>` (preferred), `--label <label>`, `--text <text>`, `--testid <id>`, `--css <selector>` (last resort, e.g. `--css html` to read `data-theme`); add `--exact` for exact name match. After any action: `--wait-text`, `--wait-gone`, `--wait-url`. `--block <path>` aborts matching requests during that one command (used to force the TL;DR fallback; a failed network request is a real production condition). `--record <file.json>` saves every request (method, URL, body) made during that one command, which is how the TL;DR payload is proven. `--color-scheme light|dark` emulates the OS theme for that command. `--timeout <ms>` defaults to 10000. `--wait-text` waits for a visible match, so text inside a closed explanation does not block it. `--viewport WIDTHxHEIGHT` sets the viewport for a command.

Accessible names in `features/` follow the Portuguese UI and content packs. If a name changes, update the corresponding UI or feature file in the same change while keeping the numeric assertions and user behavior intact.

## Evidence

```bash
EV="$(ctl evidence-dir)"    # artifacts/verify/<run-id>/ at the repo root, survives cleanup
```

Proof standards:

- Drive the real user path: type into the inputs and click the controls. Never call the statistics engine directly, never set state through `localStorage` or a hand-built `#s=` fragment, never use test-only endpoints.
- Capture the action and the resulting state: a snapshot or screenshot before and after the decisive action, not only the final screen.
- Assert numbers against the expected values in the feature file, read with `ctl browser text`, not by eyeballing a screenshot.
- Verify side effects: the clipboard holds the shared link, `localStorage` holds (or no longer holds) the draft, the network log shows what was sent to `/api/tldr` and that no request carries the `#s=` fragment.
- Mocks only at a real production boundary: blocking `/api/tldr` to prove the fallback is allowed; faking the AI response is not.
- Each artifact path names the feature file it proves (`$EV/<feature>/...`).
- Report a step you could not run with the command, the error, and the unmet precondition. A skipped entry point is not verified by a different one.

## Cleanup

```bash
ctl cleanup     # kills this run's app and browser process groups, removes /tmp/abcalc-verify/<run-id>
```

Cleanup kills only the process groups this run recorded (never by name), copies `app.log` next to the evidence, and deletes scratch state. Evidence in `artifacts/verify/<run-id>/` is never removed. Run cleanup after every run, including failed ones.

## Helpers

| Helper | Invocation |
|---|---|
| `scripts/ctl` | `ctl launch [--standin]`, `ctl doctor`, `ctl browser <command> [flags]`, `ctl evidence-dir`, `ctl cleanup`, `ctl selftest` |
| `scripts/browser.mjs` | called by `ctl browser`; needs `ABCALC_STATE`, `ABCALC_APP_URL`, `ABCALC_CDP_PORT`, which `ctl` sets |
| `scripts/package.json` | pins `playwright-core` 1.64.1 (matches the cached Chromium 1248); `ctl` runs `npm install` in `scripts/` on first use |
| `ctl selftest` | proves the harness alone against `scripts/standin/`: launch, doctor, drive, evidence, cleanup. Run it if the harness itself is suspect |

## Gotchas

- **The app contract verified by this harness** (from PRD/ROUTES and the running app): the calculator island sets `data-ready="true"` on `<main>` after hydration; `GET /api/tldr` answers 405; the build reads `PUBLIC_TURNSTILE_SITE_KEY` and `PUBLIC_UMAMI_WEBSITE_ID`; the Worker reads `TURNSTILE_SECRET_KEY`. If the scaffold chooses other names, update `ctl` and this file in the same PR.
- **Workers AI is remote even in local dev.** Every "Gerar TL;DR" click is a real model call on the authenticated account. Generate at most once per run unless the journey needs more.
- **Rate limit state is per run** (`--persist-to` inside the run dir), so 20/day never leaks between runs or into the user's own dev state.
- **Turnstile test keys** always pass; the "challenge failed" path needs the always-fail secret `2x0000000000000000000000000000000AA` via `ABCALC_LAUNCH_CMD`.
- **Bayesian numbers are deterministic** (seeded by the inputs, PRD seção 7). The same inputs must give the same P(vencer) on every run; a drift is a bug, not noise.
- **Number formatting is per locale**: `/pt` shows `6,00%`, `/en` shows `6.00%`. Assert the locale you drove.
- The full Chromium in `~/.cache/ms-playwright/chromium-1248` fails to start here (missing `libcups`, `libcairo`, `libpango`); the harness uses the headless shell. `ABCALC_CHROME` overrides the binary.

- A valid local draft restores its active tab, even when the requested calculator path names the other tab. Clear the previous draft before direct navigation when a journey requires an empty page, or choose the desired header tab to preserve its data. A shared fragment keeps the tab from its own route.
