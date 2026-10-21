# Share link and local draft

The user copies a link that reproduces exactly what is on screen, including any TL;DR, without an account; opening it elsewhere restores the state. Meanwhile the browser keeps a local draft so a reload does not lose work, and "Limpar" erases it. The state lives in the URL fragment and never reaches any server or analytics. Proves PRD section 13 and the "dados do teste não persistem" constraint.

## Sub-features

- `share-copy` copies the link and shows "Link copiado".
- `share-open` restores every input, method and setting from the link in a clean browser state.
- `share-precedence` gives the link priority over an existing draft and shows the replacement notice.
- `draft-persist` keeps the last state and active tab across a reload without a fragment.
- `draft-clear` empties the page and removes the draft with "Limpar".
- `share-private` never sends the fragment in any request.
- `share-invalid` shows "Não foi possível ler este link" for a corrupted fragment.

## How to get to it (user POV)

- Choose `Salvar e compartilhar link` in the header on either tab.
- Open a shared link directly in the address bar.
- Reload the page, or close and reopen it, without a fragment.
- Choose `Limpar` on the analysis or pre-test page.

## Driving it with ctl browser

Preconditions:

- Baseline preconditions from the README hold.
- The analysis page holds the two-group fixture from [analysis.md](./analysis.md) with `Z test` and `Unicaudal` selected.

- **Copy the link.** Run `ctl browser click --role button --name "Salvar e compartilhar link" --wait-text "Link copiado"`, then `ctl browser clipboard`. The clipboard holds `<app>/pt/analise#s=...`. Save it to `$EV/share/link.txt`.
- **Draft survives reload.** Run `ctl browser goto /pt/analise` (no fragment). The inputs still show `80000`, `1600`, `80000`, `1696`, and `ctl browser storage` lists the draft key with a non-zero size.
- **Clear.** Run `ctl browser click --role button --name "Limpar"`. All inputs are empty, results show `—`, and `ctl browser storage` no longer lists the draft key.
- **Open the link.** Run `ctl browser goto about:blank` and then `ctl browser goto "<link from link.txt>"` (the blank page forces a full load, like opening the link in a new tab). The inputs, `Z test`, `Unicaudal` and the verdict `Vencedora` are restored.
- **Link beats draft.** Run `ctl browser fill --role spinbutton --name "Dias de teste" --value 1` (creates a draft), then `ctl browser goto about:blank` and `ctl browser goto "<link>"`. The notice `seu rascunho anterior foi substituído pelo link` appears and the link's values win.
- **Invalid link.** Run `ctl browser goto about:blank` and then `ctl browser goto "/pt/analise#s=corrompido"`. The notice `Não foi possível ler este link` appears and the page is empty.
- **Fragment never leaves the browser.** With the link open, run `ctl browser network --path "$EV/share/network.json"`. No request URL or body in the file contains `#s=` or the fixture numbers `1696`.
- **Restore the active tab.** After `Limpar`, choose `Pré-teste`, fill `Tráfego semanal` with `10000` and `Conversões semanais` with `300`, and wait for the 500 ms draft save. Run `ctl browser goto /pt/analise --wait-url /pt/pre-teste`. The pre-test tab and its inputs return. With the English browser profile, `ctl browser goto / --wait-url /en/pre-test` restores the same draft in English. Save snapshots to `$EV/share/draft-tab-restored.aria.txt` and `$EV/share/draft-tab-root-en.aria.txt`.
- **Proof.** Run `ctl browser snapshot --path "$EV/share/restored.aria.txt"` after opening the link and `ctl browser screenshot --path "$EV/share/restored.png" --full`.

## Gotchas

- Navigating to the same path with only a different fragment is a same-document navigation and does not reload the page. Always go through `about:blank` first when the journey means "open the link".
- The clipboard is only readable because the harness grants clipboard permission to the app origin; a real user sees the same text.
- With `ABCALC_UMAMI_WEBSITE_ID` empty, the network check proves only the app's own requests. Set a staging website ID to prove the Umami requests too (PRD section 19 requires the hash to be excluded).
