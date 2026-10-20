# AI TL;DR

After a valid analysis, the user asks for a TL;DR: the Worker calls Workers AI with only the computed numbers and the rule findings, and the page renders a 2 to 4 sentence summary plus structured findings, each marked as coming from the rules or from the AI. Editing the data afterwards dims the summary with the seal "Dados mudaram". If the AI is unreachable, the page falls back to the rule findings with prewritten texts. Proves PRD section 11.

## Sub-features

- `tldr-generate` renders the summary and findings after "Gerar TL;DR".
- `tldr-payload` sends only numbers, group names and the Turnstile token to `/api/tldr`.
- `tldr-severity` keeps `Crítico` only on rule findings; AI findings show `apontado pela IA` and at most `Atenção`.
- `tldr-stale` dims the summary with "Dados mudaram" and "Gerar de novo" after any input change.
- `tldr-fallback` shows rule findings and "TL;DR indisponível" when the request fails.

## How to get to it (user POV)

- On `/pt/analise` with valid data, choose `Gerar TL;DR` in the `TL;DR` region.
- After a change, choose `Gerar de novo` on the stale summary.

## Driving it with ctl browser

Preconditions:

- Baseline preconditions from the README hold, including `cloudflare auth` in doctor (the AI call is real).
- The analysis page holds the SRM fixture from [analysis.md](./analysis.md) (control 50000/1000, Variante B 48500/1000, 14 days), so at least one critical rule finding exists.

- **Fallback first (no AI cost).** Run `ctl browser click --role button --name "Gerar TL;DR" --block /api/tldr --wait-text "TL;DR indisponível"`. The `TL;DR` region lists the rule findings with prewritten texts, starting with `Possível Sample Ratio Mismatch` marked `Crítico`.
- **Generate.** Run `ctl browser click --role button --name "Gerar TL;DR" --wait-text "Gerado por IA em" --timeout 30000 --record "$EV/tldr/requests.json"`. The region shows a summary of 2 to 4 sentences and a findings list where the SRM finding is present and marked `Crítico`.
- **Severity rule.** Run `ctl browser text --role region --name "TL;DR"`. Every finding with the seal `apontado pela IA` is marked `Atenção` or `Info`, never `Crítico`.
- **Stale seal.** Run `ctl browser fill --role spinbutton --name "Conversões (Variante B)" --value 1001 --wait-text "Dados mudaram"`. The summary is still visible, dimmed, with a `Gerar de novo` button. Do not click it (second AI call).
- **Payload proof.** Open `$EV/tldr/requests.json` (recorded during the generate step). The `POST /api/tldr` body contains numbers, group names (40 characters max) and the Turnstile token only, no free text, and no URL in the file contains `#s=`.
- **Proof.** Run `ctl browser snapshot --role region --name "TL;DR" --path "$EV/tldr/fallback.aria.txt"` after the fallback, `.../generated.aria.txt` after generating, `.../stale.aria.txt` after editing, and `ctl browser screenshot --path "$EV/tldr/generated.png"`.

## Gotchas

- `--block /api/tldr` aborts the request only during that one command; the next click goes through for real.
- The AI text varies between runs. Assert structure (sentence count, findings present, severities, seals), never exact wording.
- A 429 response means this run hit 20 generations; the run-scoped rate-limit state resets only with a new launch.
- Turnstile test keys always pass; a visible challenge means the build did not pick up `PUBLIC_TURNSTILE_SITE_KEY`.
- The model is not chosen yet (PRD section 11); record the model name from `app.log` with the evidence when it exists.
