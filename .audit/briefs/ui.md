# Brief: UI owner (AB Test Calculator v1)

Read /home/elliot/.claude/skills/poteto-mode/SKILL.md in full, including its Principles section, before any work. You are the code-writing delegate for the whole UI inside the parent's Feature playbook. Do not spawn subagents. Own this diff directly.

## Where

- Work ONLY in the git worktree `/home/elliot/.t3/projects/abcalc-wt/ui` (branch `feat/ui`, deps installed). Run every command with that directory as the working directory.
- First run `git merge --ff-only feat/calculator-v1` (or a normal merge if it cannot fast-forward) to pick up the engine, the content packs and the Worker.
- Commit on `feat/ui` in small Conventional Commits (`feat(ui): ...`, `feat(app): ...`, `test(app): ...`), each ending with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Do not edit `src/stats/**`, `src/shared/**`, `src/i18n/content/**`, `worker/**`, `package.json`. If one of them blocks you, stop that item and report why. The parent owns those contracts.

## Read first (all of them, fully)

- `PRD.md`, `ROUTES.md`, `DESIGN.md`, `AGENTS.md`. They are the source of truth. DESIGN.md has exact tokens, component code, chart specs, the anti-slop checklist and the black list.
- `src/app/state.ts` (UI state and actions, written by the parent: implement it, do not reshape it without reporting why).
- `src/stats/index.ts` and `src/stats/types.ts` (engine API), `src/shared/tldr-contract.ts` (TL;DR wire contract), `src/i18n/content/types.ts` with `pt.ts` and `en.ts` (teaching texts, finding texts, headlines, verdict labels).
- `.claude/skills/verify-ab-test-calculator/SKILL.md` and every file in its `features/` directory. The feature files are the acceptance tests of your work.
- `src/styles/global.css` (tokens already wired into Tailwind v4) and `scripts/js-budget.mjs`.

## Build (in this order, committing each unit when it works)

1. `src/i18n/ui.ts`: UI string catalog for pt and en, and `src/i18n/routes.ts`: the translated slugs (`/pt/analise`, `/pt/pre-teste`, `/pt/sobre`, `/en/analysis`, `/en/pre-test`, `/en/about`) and the counterpart mapping used by the language switch.
2. `src/app/format.ts`: one `Intl`-based formatter per locale (percent, p.p., integer, currency, p-value) implementing the content packs' `Fmt`. `src/app/parse.ts`: turn `AnalysisFields` / `PretestFields` raw text into engine inputs with the locale decimal separator, returning per-field error codes. This is the only place raw text is validated.
3. `src/app/reducer.ts`: implements every `Action`, defaults per PRD (confidence 95%, power 80%, two-sided, Bonferroni on, horizon 4 weeks, reference lift 10%, method bayesian, currency BRL on `/pt` and USD on `/en`, revenue horizon 6), realistic example data per tab, `use-plan` per PRD section 3 "Ponte para o pós-teste".
4. `src/app/codec.ts`: state to and from the `#s=` fragment, versioned, compressed with the native `CompressionStream("deflate-raw")` and base64url. Decoding is a boundary: validate the full shape and return null on anything wrong. Above 8000 characters, encode without the TL;DR and report that to the caller. `localStorage` draft with a 500 ms debounce, precedence fragment > draft > empty, and the replacement notice (PRD section 13).
5. `src/layouts/Calculator.astro`: html lang, title and description per locale, `hreflang` alternates, the inline theme script in `<head>` (system theme, override in `localStorage` key `theme`, sets `data-theme` before first paint), header and footer per ROUTES.md, Umami only when `import.meta.env.PUBLIC_UMAMI_WEBSITE_ID` is non-empty, with the tracker configured to exclude the hash and the search from recorded URLs.
6. Pages: the six routes plus `src/pages/404.astro`. The calculator is one Preact island per page (`client:load`) that sets `data-ready="true"` on its `<main>` after hydration. The about pages are static Astro: the methodology sheet from ROUTES.md (all formulas from PRD sections 3, 4, 6, 7, 8, 9, references, what runs where, what Umami collects).
7. Components per DESIGN.md section 3: header, buttons, segmented control, number field, group table with add and remove, stat cell, verdict block with the four states, finding row, TL;DR block with all states, explanation accordion (11 concepts from the content packs, layer 2 behind "ver detalhes", user numbers through `ExplanationContext`), toggle, data tables, toast and top notice, chart frame.
8. Charts in hand-written SVG per DESIGN.md section 6: MDE x weeks curve (pre-test), CR distributions, lift distribution, lift intervals, revenue projection. Each with legend, hover tooltip, and a "ver tabela" equivalent table. Series colors only from `--series-N`, bound to the group slot.
9. TL;DR: build `TldrRequest` from the engine result, get a Turnstile token (load the Turnstile script only on the first click; site key `import.meta.env.PUBLIC_TURNSTILE_SITE_KEY`), POST `/api/tldr`, render, mark stale by comparing `inputHash`, fall back to the content pack's finding texts on any failure, show the daily-limit message on 429 `daily_limit`. In the UI too, a finding with `source: "ai"` never renders as critical. Missing rule findings in the response are filled from the content pack.
10. Run `analyze` and `planPretest` off the main thread in a module Web Worker if the engine report says they exceed 16 ms (the parent will tell you the measured median when you start).
11. Analytics events from PRD section 19 through `window.umami?.track`, never with test numbers.

## Accessible names (contract with the verification journeys)

Use the exact names the feature files use, in pt on `/pt` pages: tabs `Análise do teste` and `Pré-teste`; inputs `Dias de teste`, `Usuários (Controle)`, `Conversões (Controle)`, `Usuários (Variante B)`, `Conversões (Variante B)`, `Tráfego semanal`, `Conversões semanais`, `Lift alvo`; radios `Bayesiano`, `Z test`, `Bicaudal`, `Unicaudal`, `Semanal`, the Mode B radio whose name contains `Quero detectar X%`; buttons `Adicionar variante`, `Remover Variante C`, `Gerar TL;DR`, `Gerar de novo`, `Usar esse plano`, `Salvar e compartilhar link`, `Limpar`, `Alternar tema`; links `EN` / `PT`; switch `Correção de Bonferroni`, `Teste em andamento`; regions `Resultados`, `Alertas`, `TL;DR`; tables `MDE por semana`, `Fronteiras`. Number inputs use `role="spinbutton"` semantics (`inputmode="decimal"` text inputs need `role="spinbutton"` explicitly). If a PRD rule forces a different name, change the feature file in the same commit and list it in your report. Never weaken a journey to make it pass.

## Done when (the parent will re-run all of this)

- `npm test`, `npm run typecheck`, `npm run build` and `npm run budget` all green (budget is 150 KB gzip per page).
- Every journey in `.claude/skills/verify-ab-test-calculator/features/` driven with the skill's `ctl` against a launched instance, with the evidence files the journeys name under `artifacts/verify/<run-id>/`. Generate at most ONE real TL;DR. `ctl cleanup` after every run, including failed ones.
- Screenshots of both tabs in light and dark, desktop (1440 px) and mobile (390 px wide; add a `--viewport` flag to the harness's `browser.mjs` if you need it), checked against DESIGN.md section 7.
- All work committed on `feat/ui`.

## Report back (concise)

Commits, the run id of the final verification run, a table of journeys with PASS / FAIL / NOT RUN and the reason, the budget output, every contract you could not follow and why, and anything unfinished.

## Facts from the merged engine (read before item 10)

- `analyze` median: about 13 ms with 2 groups, about 34 ms with 5 groups (Node, 4 cores). `planPretest` with weekly looks over a long plan reaches 164 ms. Run both engine calls in a module Web Worker from the start, keep the last result on screen while a new one computes, and drop stale responses by request id.
- `PretestResult` (kind `ok`) now carries `settings`, used by `toPlan`.
- The Monte Carlo seed depends only on users and conversions, so P(vencer) does not move when method, revenue or names change. `inputHash` covers every input and drives the TL;DR stale seal.
- `stopped_early` fires only when a plan exists. `seq_not_crossed` stays silent at the final look. With the sequential toggle on, the verdict follows the Z test boundary.
- With 0 control conversions, `extraDays` is `Infinity`: render it as "—" with the explanation, never as a number.
