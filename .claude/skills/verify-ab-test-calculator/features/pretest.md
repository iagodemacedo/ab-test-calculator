# Pre-test planning

The user enters the weekly traffic and conversions of the page to test and either sees the minimum detectable effect week by week (Mode A) or asks how much sample and how many days a target lift needs (Mode B). Alerts flag tests that can only detect large effects, and "Usar esse plano" carries the plan into the analysis tab. Proves PRD sections 3 and 4.

## Sub-features

- `pretest-mode-a` shows the MDE and visitors per variant for weeks 1 to the chosen horizon, plus the MDE curve.
- `pretest-mode-b` shows the sample per variant and the duration for a target lift.
- `pretest-mde-alert` warns when the MDE is above 10% relative.
- `pretest-sequential` shows the inflated maximum sample and the boundary table when more than one look is planned.
- `pretest-plan` carries the plan to `/pt/analise` with the seal `Plano de <data/hora>`.

## How to get to it (user POV)

- Open `/pt/pre-teste` (or `/en/pre-test`).
- Choose the `Pré-teste` tab in the header from `/pt/analise`.

## Driving it with ctl browser

Preconditions:

- Baseline preconditions from the README hold.
- The page is empty.

- **Open the page.** Run `ctl browser goto /pt/pre-teste`. Mode A (`Qual efeito consigo detectar?`) is selected and the horizon reads `4` weeks.
- **Enter traffic.** Run `ctl browser fill --role spinbutton --name "Tráfego semanal" --value 10000` and `ctl browser fill --role spinbutton --name "Conversões semanais" --value 300`. Baseline CR reads `3,00%`.
- **Mode A table.** Run `ctl browser text --role table --name "MDE por semana"`. Rows read: week 1 `34,40%` / `5.000`, week 2 `23,79%` / `10.000`, week 3 `19,23%` / `15.000`, week 4 `16,55%` / `20.000` (MDE relative / visitors per variant). Every row carries the warning icon, and the page shows the alert `só detecta efeitos grandes`.
- **Mode B.** Run `ctl browser click --role radio --name "Quero detectar X%"` then `ctl browser fill --role spinbutton --name "Lift alvo" --value 10`. Sample per variant reads `53.211` and duration `75 dias`. No alert about more than 12 weeks appears (75 < 84).
- **Sequential plan.** Run `ctl browser click --role radio --name "Semanal"`. A table `Fronteiras` appears with one row per week and a maximum sample larger than `53.211`.
- **Use the plan.** Run `ctl browser click --role button --name "Usar esse plano" --wait-url /pt/analise`. The analysis page shows the seal `Plano de`, two groups, and the toggle `Teste em andamento` available.
- **Proof.** Run `ctl browser snapshot --role table --name "MDE por semana" --path "$EV/pretest/mode-a.aria.txt"` after Mode A, `ctl browser snapshot --path "$EV/pretest/mode-b.aria.txt"` after Mode B, and `ctl browser screenshot --path "$EV/pretest/plan-on-analysis.png" --full` after using the plan.

## Gotchas

- Mode A and Mode B must be exact inverses (PRD section 3): putting `16,55` as the target lift in Mode B must give 4 weeks of sample. Use this as a cross-check when a number looks off.
- Thousands separators in results are dots on `/pt` (`53.211`) and commas on `/en` (`53,211`).
- "Usar esse plano" must not reload the page; if it does, the plan travels only if it is in the fragment. Report a full reload as a defect against ROUTES.md.
