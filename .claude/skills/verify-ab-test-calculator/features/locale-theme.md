# Language and theme

The calculator exists in Portuguese and English with translated slugs; switching language keeps the state and formats numbers per locale. The theme follows the operating system on first visit, and the header toggle overrides and remembers it. Proves PRD section 17, ROUTES "Entrada e idioma" and DESIGN section 1.

## Sub-features

- `locale-redirect` sends `/` to `/pt/analise` or `/en/analysis` by the browser language.
- `locale-switch` maps each page to its counterpart and keeps the `#s=` state.
- `locale-format` shows `6,00%` on `/pt` and `6.00%` on `/en` for the same data.
- `theme-system` follows the OS color scheme on first visit.
- `theme-toggle` overrides the OS choice and survives a reload.

## How to get to it (user POV)

- Open `/` from a browser set to Portuguese or English.
- Choose `EN` or `PT` in the header language switch.
- Choose the theme toggle in the header.

## Driving it with ctl browser

Preconditions:

- Baseline preconditions from the README hold.
- The analysis page holds the two-group fixture from [analysis.md](./analysis.md).

- **Switch language.** Run `ctl browser click --role link --name "EN" --wait-url /en/analysis`. The page reads `Test analysis`, the variant lift reads `6.00%` and the inputs keep `80000` and `1696`.
- **Switch back.** Run `ctl browser click --role link --name "PT" --wait-url /pt/analise`. Lift reads `6,00%`.
- **Root redirect.** This run's browser was started without `--lang`, so it sends an English `Accept-Language`. Run `ctl browser goto / --wait-ready false --wait-url /en/analysis`. To prove the Portuguese branch, start a second run with `ctl browser start --lang pt-BR` and expect `/pt/analise`.
- **System theme.** In a fresh profile state (after `Limpar` and with no saved theme), run `ctl browser goto /pt/analise --color-scheme dark` and `ctl browser attr --css html --attr data-theme --color-scheme dark`. It is `dark`; the page background is pure black in the screenshot.
- **Manual toggle.** Run `ctl browser click --role button --name "Alternar tema"`, then `ctl browser goto /pt/analise --color-scheme dark`. The theme stays `light` after the reload.
- **Proof.** Run `ctl browser screenshot --path "$EV/locale-theme/en.png"` on `/en/analysis`, `.../dark.png` in dark, `.../light-override.png` after the toggle.

## Gotchas

- The browser language is fixed when `ctl browser start` runs (`--lang`). Report the branch you did not run rather than claiming it.
- The saved theme lives in `localStorage` key `theme`; "Limpar" clears the calculator draft, not necessarily the theme. Check `ctl browser storage` before the system-theme step.
- `--color-scheme` applies only to the command it is passed to; pass it on every step of the system-theme journey.
