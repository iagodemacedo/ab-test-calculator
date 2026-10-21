# Test analysis

The user types visitors and conversions for the control and each variant, and the page recalculates on every keystroke: conversion rates, lift, p-value or probability of beating the control, a verdict per variant in one of four states, extra days needed, and alerts such as a Sample Ratio Mismatch. Proves PRD sections 5 to 8.

## Sub-features

- `analysis-input` accepts users and conversions per group and shows the conversion rate.
- `analysis-ztest` computes lift, Z-score and p-value with the selected hypothesis and confidence.
- `analysis-bayes` computes the probability of beating the control and the expected risk (default method).
- `analysis-verdict` shows one of Vencedora, Perdedora, Inconclusiva sem diferença relevante, Inconclusiva sem poder.
- `analysis-extra-days` shows the extra days needed to reach the reference target lift.
- `analysis-srm` raises the critical SRM alert when the split does not match the intended split.
- `analysis-distributions` draws CR densities with method intervals and lift distributions with positive mass, tooltips and tables.
- `analysis-partial` retains complete variants when another row is invalid, preserving group slots and narrowing SRM and P(best).
- `analysis-variants` adds and removes variants up to five groups.

## How to get to it (user POV)

- Open `/pt/analise` (or `/en/analysis`), the default landing tab.
- Choose the `Análise do teste` tab in the header from `/pt/pre-teste`.
- Choose `Usar esse plano` on the pre-test page (covered in [pretest.md](./pretest.md)).

## Driving it with ctl browser

Preconditions:

- Baseline preconditions from the README hold.
- The page is empty (no fragment, no draft).

- **Open the page.** Run `ctl browser goto /pt/analise`. Status 200 and the title contains `AB Test Calculator`.
- **Enter duration.** Run `ctl browser fill --role spinbutton --name "Dias de teste" --value 14`.
- **Enter control.** Run `ctl browser fill --role spinbutton --name "Usuários (Controle)" --value 80000` and `ctl browser fill --role spinbutton --name "Conversões (Controle)" --value 1600`. The control row shows CR `2,00%`.
- **Enter variant.** Run `ctl browser fill --role spinbutton --name "Usuários (Variante B)" --value 80000` and `ctl browser fill --role spinbutton --name "Conversões (Variante B)" --value 1696`. The variant row shows CR `2,12%` and lift `6,00%`.
- **Bayesian verdict (default).** Run `ctl browser text --role region --name "Resultados"`. It shows probability of beating the control between `95,0%` and `95,9%` (expected about `95,4%`) and the verdict `Vencedora`.
- **Switch to Z test, two-sided.** Run `ctl browser click --role radio --name "Z test"` and confirm `Bicaudal` is checked with `ctl browser attr --role radio --name "Bicaudal" --attr aria-checked` (`true`). `Resultados` shows p-value `0,0911`, Z-score `1,6897` and the verdict `Inconclusiva, sem poder` (achieved MDE `10,04%` is above the 10% reference).
- **Extra days and alerts.** `Resultados` shows `Dias adicionais necessários` = `1`. Run `ctl browser text --role region --name "Alertas"`. It lists `Amostra insuficiente` (atenção) and `Os métodos discordam` (info), and no SRM alert.
- **Switch to one-sided.** Run `ctl browser click --role radio --name "Unicaudal" --wait-text "Vencedora"`. p-value becomes `0,0455` and the verdict `Vencedora`.
- **SRM.** Run `ctl browser fill --role spinbutton --name "Usuários (Controle)" --value 50000`, `... "Conversões (Controle)" --value 1000`, `... "Usuários (Variante B)" --value 48500`, `... "Conversões (Variante B)" --value 1000`. `Alertas` lists `Possível Sample Ratio Mismatch` marked `Crítico`, and the verdict carries the seal `não confiável até resolver o SRM` if it is Vencedora.
- **Add and remove a variant.** Run `ctl browser click --role button --name "Adicionar variante"`. A row `Variante C` appears, and the toggle `Correção de Bonferroni` appears checked. Run `ctl browser click --role button --name "Remover Variante C"`. The row and the toggle disappear; the Variante B row keeps its marker color.
- **Distributions.** With the two-group fixture, both `Distribuições das CRs` and `Distribuição do lift` figures appear. Run `ctl browser hover --css 'figure.density-chart [role="slider"]'`. The tooltip names both groups and their densities for CRs. `ctl browser press ArrowRight --css 'figure.density-chart [role="slider"]'` moves the crosshair with the keyboard. Choose `ver tabela` in each figure. The CR table lists the selected method's intervals and densities. The lift table lists the area above 0, equal to the displayed Bayesian P(vencer). Switch to `Z test` and confirm the curves and intervals update. Capture both chart tables and the hover state.
- **Partial results.** Add C and D. Fill D with 80000 users and 1500 conversions. Fill C with 100 users and 101 conversions. B and D retain comparisons. C shows its inline error and computed values as `—`. A notice says SRM and probability of being best use only complete groups. Remove C. D keeps slot 4 in its row marker and both distribution charts. Capture the invalid row, the valid results and the charts before and after removing C.
- **Desktop density.** At `--viewport 1440x1000`, every group field and output is visible. `ctl browser layout --css .group-scroll` reports `scrollWidth` no greater than `clientWidth`. Hero text reads `95,4%` without spaces around the comma, and nonzero expected risk keeps at least two significant digits.
- **Proof.** Run `ctl browser snapshot --role region --name "Resultados" --path "$EV/analysis/results.aria.txt"`, `ctl browser snapshot --role region --name "Alertas" --path "$EV/analysis/alerts.aria.txt"` and `ctl browser screenshot --path "$EV/analysis/page.png" --full`, after each decisive step above, using suffixes `-bayes`, `-ztest-2s`, `-ztest-1s`, `-srm`.

## Gotchas

- Fill both users and conversions before reading results; intermediate states (conversions > users) show inline errors by design.
- The two-sided verdict sits right on the edge (achieved MDE 10,04% vs 10%). A different verdict means the sample-size formula deviates from PRD section 3, which is a real failure, not flakiness.
- The Bayesian probability is seeded by the inputs and must be identical on every run. If it lands outside `95,0%` to `95,9%`, report it with the exact value.
- Typing `80.000` on `/pt` is eighty (dot is not a thousands separator in input); type plain digits.
