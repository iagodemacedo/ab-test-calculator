# AB Test Calculator verification map

This directory is the maintained source for verifying the user-facing behavior of AB Test Calculator. Read this index before driving the app, then use the matching feature file as the recipe. Product rules live in `PRD.md` at the repo root; each feature file names the PRD sections it proves.

## Baseline preconditions

- Launch with `eval "$(ctl launch)"` so the app runs on this run's own free port with Turnstile test keys and no Umami.
- `ctl doctor` passes every check, including the `api /api/tldr route` probe.
- `ctl browser start` has been run once for this run.
- Every journey starts from an empty calculator: a fresh `ctl browser goto /pt/analise` (or `/pt/pre-teste`) with no `#s=` fragment, after `Limpar` if a previous journey left a draft.
- Never drive an instance that this run did not launch.

## Driving conventions

- `ctl` means `.claude/skills/verify-ab-test-calculator/scripts/ctl`, run from the repo root with `ABCALC_RUN_ID` exported.
- `EV` means the output of `ctl evidence-dir`.
- Prefer `--role` with the accessible name. Names below follow the PRD wording in Portuguese; the English pages have their own names, listed where a journey uses `/en`.
- Treat every command and value as literal. Inputs use the Portuguese decimal comma on `/pt` pages.
- Read results with `ctl browser text` and compare to the expected values written in the journey.
- Generate at most one real TL;DR per run (it is a real Workers AI call).

## Proof and skip reporting

- Capture the user action and the resulting state: an ARIA snapshot before and after the decisive action, plus one screenshot.
- Numeric claims are proven with `ctl browser text` output saved to `$EV/<feature>/values.txt`.
- Side effects are proven with a second, read-only view: `ctl browser clipboard`, `ctl browser storage`, `ctl browser network`, or reopening a shared link.
- Record the feature file and the entry point used with every artifact (the path `$EV/<feature>/` does this).
- Report an unreachable path with the attempted command and the unmet precondition. Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with ctl browser` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Test analysis](./analysis.md) covers entering test data, Z test and Bayesian verdicts, hypothesis switching, extra days needed and the SRM alert.
- [Pre-test planning](./pretest.md) covers Mode A (MDE per week), Mode B (sample and duration for a target lift), the MDE alert and "Usar esse plano".
- [AI TL;DR](./tldr.md) covers generating the summary, the stale seal after edits, and the deterministic fallback when the AI is unreachable.
- [Share link and local draft](./share-and-draft.md) covers copying the link, reopening it in a clean state, the local draft and "Limpar", and proving the fragment never leaves the browser.
- [Language and theme](./locale-theme.md) covers PT/EN routes and number formats, state carried across the language switch, system theme and the manual toggle.
