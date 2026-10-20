UI implementada em `feat/ui`, no worktree solicitado. A entrega está incompleta nos itens de contrato e verificação abaixo. `src/stats`, `src/shared`, `src/i18n/content`, `worker`, `package.json` e `src/app/state.ts` permanecem idênticos a `feat/calculator-v1`.

Run final: `r20261020-161520-1136150`, sobre `8390037`. Todos os fluxos foram dirigidos exclusivamente por `ctl`. O runner executou `ctl cleanup`; uma segunda chamada confirmou que não havia processos desse run para limpar. Todos os outros runs também receberam cleanup.

| Jornada | Resultado | Evidência ou motivo |
| --- | --- | --- |
| analysis.md | PASS | CR do controle antes da variante; Bayesiano 95,4%; Z bicaudal 0,0911 / 1,6897; unicaudal 0,0455; SRM; adicionar/remover variante. |
| pretest.md | PASS | MDE 34,40 / 23,79 / 19,23 / 16,55%; amostra 53.211; duração 75 dias; fronteiras e ponte para análise sem recarga. |
| share-and-draft.md | PASS | Clipboard, recuperação, precedência do fragmento, limpeza, link inválido, rascunho restaura aba inclusive pela raiz. Rede sem fragmento nem números da fixture no reload. |
| locale-theme.md | PASS | PT/EN com conversão dos formatos; raiz EN no run final, PT no extra; tema do sistema e override. |
| tldr.md: fallback | PASS | POST abortado na rede; achados locais e regra crítica preservados. Captura de rede inclui carga do Turnstile e tentativa de POST sem fragmento. |
| tldr.md: geração real | FAIL | Run `r20261020-150806-1106727`: resumo real chegou, mas a IA chamou o achado de SRM. A assertiva do título canônico falhou. A UI restaura agora títulos do catálogo, com teste unitário; não houve segunda geração real. |
| tldr.md: dados desatualizados | NOT RUN | A jornada real parou na assertiva anterior, antes da edição. Repetir a geração excederia o limite de uma chamada real do brief. |
| Limites, receita, explicações e plano | PASS | Run extra `r20261020-151833-1113226`: sete jornadas, incluindo onze conceitos nas duas camadas, zero conversões, split inválido, cinco slots estáveis, sequencial final, receita USD/perdas/tabelas e atualização de plano por inputs e confiança. |
| Plano semanal longo | PASS | `r20261020-153338-1120403`: mais de 12 espiadas herdadas do plano e usadas na análise. |
| Plano com taxa base 100% | PASS | `r20261020-155838-1131946`: criação e atualização desabilitadas quando não há lift positivo detectável. |
| Entradas e 404 | PASS | `r20261020-160424-1132952`: raiz PT, `/pt`, `/en`, Sobre PT/EN, 404 e link de recuperação no idioma detectado. |
| Matriz visual | PASS | Oito capturas do run final inspecionadas: abas × light/dark × 1440/390 px. Grupos têm rolagem horizontal no painel desktop e campos empilhados no mobile. |
| Umami conectado / Lighthouse | NOT RUN | ID Umami vazio na verificação. Configuração exclui hash e busca, mas não houve validação num site Umami conectado. Lighthouse não foi medido. |

Evidências locais em `artifacts/verify/<run-id>/`. No run final, `journeys.json` separa fallback aprovado de live/stale não executados; `commands.jsonl`, `values.txt`, snapshots e capturas registram as ações e números. A única geração real tem payload em `tldr/requests.json` e resposta visível em `tldr/failure.aria.txt` do run correspondente. Não foram fabricados `generated.png` ou artefatos de stale após a falha.

`npm test`: 286 testes em 13 arquivos. `npm run typecheck`: zero erros, warnings ou hints. `npm run build` passou no launch final (`app.log`, linhas 25–43). `npm run budget` passou; inclui imports estáticos, dinâmicos e o módulo do Web Worker. Saída final com a site key de teste do launch:

```text
npm notice run budget
npm notice run node scripts/js-budget.mjs
ok      7.1 KB gzip  /404.html
ok      0.7 KB gzip  /en/about.html
ok     67.5 KB gzip  /en/analysis.html
ok     67.5 KB gzip  /en/pre-test.html
ok     67.5 KB gzip  /pt/analise.html
ok     67.5 KB gzip  /pt/pre-teste.html
ok      0.7 KB gzip  /pt/sobre.html
budget 150 KB gzip per page
```

O orçamento mede JS local. Os scripts remotos do Turnstile e do Umami não entram nessa medição. Logs de checks e orçamento estão em `.audit/ui-checks.txt` e `.audit/ui-budget.txt`.

Contratos pendentes e trabalho inacabado:

- Distribuições de CR e lift não implementadas: a API protegida do motor não expõe densidades, histogramas ou amostras posteriores. A UI não deve criar estatística fora de `src/stats`. MDE, intervalos do lift e projeção de receita estão implementados com legenda, tooltip e tabela.
- CR de cada grupo válido funciona independentemente. Vereditos parciais com outra variante inválida continuam indisponíveis: o motor exige uma análise completa, sem contrato para preservar corretamente SRM e P(melhor) num subconjunto.
- `worker/payload.ts` exige IDs contíguos. Remover C mantendo D conserva slot/cor/cálculos, mas o TL;DR recebe 400 e usa fallback. Renumerar quebraria a identidade dos slots.
- A UI aceita planos semanais com mais de 12 espiadas; o validador wire continua limitado a 12, bloqueando TL;DR nesse caso. Espiadas manuais sem plano seguem o limite 2–12.
- O wire exige valores finitos. IC unicaudal ilimitado é enviado como `null`; achados com MDE infinito ou p-value NaN em entradas degeneradas podem ser rejeitados e cair no fallback. Esses casos foram identificados no código, sem outra chamada real.
- O wire oferece um único bloco de receita e contexto sequencial; o payload usa a primeira variante nesses blocos. Valores por variante em A/B/n precisam de contrato do pai.
- Metodologia e explicações seguem a convenção sequencial do motor/content packs (gsDesign/ldbounds, alfa dividido por lado). A fórmula bicaudal do PRD §4 difere dessa convenção. O pai precisa alinhar a fonte de produto; os arquivos protegidos e o PRD não foram alterados.
- A correção do título do TL;DR não foi revalidada com IA e o selo stale não foi dirigido no navegador. Normalização de títulos, limite de severidade da IA e reposição de regras ausentes/repetidas têm provas unitárias, que não substituem esses passos reais.

Alterações na verificação: `analysis.md` usa o título canônico do content pack `Os métodos discordam` no lugar de `Os dois métodos discordam`; nenhuma assertiva numérica foi removida. `share-and-draft.md` ganhou a prova de restauração da aba. O harness recebeu viewport configurável e espera por texto visível. Os runners Python permitem repetir as jornadas; `--live-tldr` exige atenção ao orçamento de chamadas do trabalho.

O compiler customizado de ícones em `astro.config.mjs` emite JSX Preact a partir do Phosphor através do unplugin. Evita a dependência SVGR ausente sem editar `package.json`.

Model the Domain preservou `AppState`/ações. Boundary Discipline centralizou parsing e validação de links. Type System Discipline manteve inputs tipados e resultados discriminados. Prove It Works foi aplicado ao app real por `ctl`. Não houve revisão por subagentes, proibida pelo brief; houve revisão do próprio diff e inspeção das capturas.

Commits de implementação e verificação anteriores ao commit deste relatório:

```text
3319ddf feat(ui): add localized fields and calculator state transitions
8f95544 feat(app): encode and validate private shared state and drafts
aa01529 feat(ui): build calculator routes and interactive analysis workflow
323c98b test(app): allow mobile viewport verification with ctl
30dbfce fix(ui): retain computed state and reset transient analysis states
3847ac0 test(app): drive acceptance journeys and count deferred JavaScript
e0eff3d fix(ui): preserve rule labels and show exact sequential duration
65e3a74 test(app): cover input boundaries and calculation details in the browser
b62f1a6 fix(ui): reset concept accordions and track changed plan settings
14adec2 fix(app): keep URL state current and retain repeated rule findings
114dc46 fix(ui): scope explanation numbers to the active calculator tab
006bb9d fix(app): inherit sequential look counts from weekly plans
d350277 fix(app): disable result actions until their input snapshot matches
959078f fix(app): restore the active calculator route from the local draft
f2a1d51 fix(ui): keep undetectable plans out of analysis and shared state
3155493 fix(ui): keep the 404 recovery link in its detected locale
8390037 fix(ui): show valid group rates before the comparison is complete
```

Trilha de decisões: `.audit/ui-decisions.tsv`. Evidências grandes permanecem locais, ignoradas pelo git conforme a configuração do projeto. Nenhum deploy, push ou PR foi criado.
