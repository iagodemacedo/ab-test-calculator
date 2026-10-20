# Brief: UI owner, round 2

Read /home/elliot/.claude/skills/poteto-mode/SKILL.md in full, including its Principles section, before any work. You are a code-writing delegate. Do not spawn subagents. Own this diff directly.

## Consolidated scope

- Round 1 brief: `/home/elliot/.t3/projects/ab-test-calculator/.audit/briefs/ui.md`. All of its rules still hold (protected paths, accessible names, journeys, commits, report format).
- Round 1 report: `/home/elliot/.t3/projects/abcalc-wt/ui/.audit/ui-report.md`.
- Round 2 contracts were closed by the parent's engine owner on branch `feat/contract-v2`, already merged into `feat/calculator-v1`: `AnalysisResult.distributions`, non-contiguous group ids A..E, wire contract v2 with per-variant sequential and revenue, `null` for non-finite numbers, and the shared `toTldrRequest` builder (the UI's own mapping is already replaced). Read the diff `git log -p feat/ui..feat/calculator-v1 -- src/stats src/shared` before you start.

## Where

- Worktree `/home/elliot/.t3/projects/abcalc-wt/ui`, branch `feat/ui`. First `git merge feat/calculator-v1`.
- Same protected paths as round 1 (`src/stats/**`, `src/shared/**`, `src/i18n/content/**`, `worker/**`, `package.json`).

## Build

1. **Distribution charts** (DESIGN.md section 6, PRD section 10): "Distribuições das CRs" (one curve per group from `distributions`, the method's interval shaded) and "Distribuição do lift" (one curve or histogram per variant, mass above 0 highlighted and labeled with its share). Legend, hover crosshair tooltip, "ver tabela". Colors from the group slot.
2. **Partial verdicts** (PRD section 5 edge case "o resultado daquele grupo fica em '—' e nada que dependa dele é calculado"): when some variants are invalid and the control plus at least one variant are valid, run `analyze` on the valid subset (ids stay as they are; renormalize the intended split over the subset) and show "—" only for the invalid rows. Show a one-line notice that SRM and "probabilidade de ser a melhor" consider only the complete groups.
3. **Visual defects seen by the parent in your round 1 screenshots** (`analysis-dark-1440x1000.png`, `pretest-light-1440x1000.png`):
   - The groups table clips the CR column at 1440 px ("Ta conv", "2,"). All columns must be visible without horizontal scroll at 1440 px; narrow the inputs or reflow, per DESIGN.md density 8.
   - The hero number renders as "95 , 4%" with gaps around the comma. Fix the letter spacing for the mono hero so it reads "95,4%".
   - Expected risk shows "0,00 p.p.". Show at least two significant digits (e.g. "0,0014 p.p.").
   - The MDE chart's y ticks are 38,5 / 28,9 / 19,3 / 9,6. Use nice round ticks (0, 10, 20, 30, 40%) and put the "acima de 10%" label inside the shaded zone.
   - The brand link in the header shows an external-link arrow. Remove it; it is an internal link.
4. **Lighthouse**: measure performance, accessibility and best practices for `/pt/analise` and `/pt/pre-teste` (desktop and mobile) against the launched instance, for example `npx -y lighthouse <url> --chrome-path=<the harness's headless shell> --output=json`. PRD section 18 asks for ≥ 95. Fix what you can; report the numbers you measured.

## Verify (the parent re-runs all of this)

- `npm test`, `npm run typecheck`, `npm run build`, `npm run budget` green.
- ALL journeys in `.claude/skills/verify-ab-test-calculator/features/` in one final run, including `tldr.md` end to end (fallback, ONE real generation, severity rule, stale seal). The AI wording varies: assert structure, not titles; the UI shows canonical rule titles from the content pack.
- Screenshots of both tabs, light and dark, 1440 and 390 px, plus the two new charts.

## Report back

Same format as round 1, plus the Lighthouse table.
