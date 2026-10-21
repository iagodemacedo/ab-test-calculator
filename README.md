<img src="assets/icon.svg" width="64" height="64" alt="">

# AB Test Calculator

Calculadora de testes A/B em [ab-test.iago.wtf](https://ab-test.iago.wtf): pré-teste (MDE, amostra, duração, plano sequencial), análise com Bayesiano ou Z test, alertas de SRM e duração, receita e um TL;DR por IA. Toda a estatística roda no navegador.

O produto está descrito em [PRD.md](PRD.md), [ROUTES.md](ROUTES.md) e [DESIGN.md](DESIGN.md). Instruções para agentes de código ficam em [AGENTS.md](AGENTS.md).

## Rodar

Requer Node 26.12 ou superior (ver `.nvmrc`).

```bash
npm install
npm run dev        # Astro em localhost:4321, sem o Worker
npm test           # motor estatístico, Worker e textos
npm run typecheck
npm run budget     # depois de npm run build: JS por página, limite 150 KB gzip
```

Para rodar o app completo (site + `/api/tldr`) e dirigi-lo num navegador, use a skill `.claude/skills/verify-ab-test-calculator`.

## Deploy

```bash
npm run deploy     # testes, build, orçamento de JS e wrangler deploy
```

## Trocar o modelo de IA

O modelo do TL;DR fica num único lugar: `vars.AI_MODEL` em `wrangler.jsonc`. Troque o valor por outro modelo de texto do Workers AI (lista com `cf ai models list --task "Text Generation"`) e rode `npm run deploy`. Alterar a variável pelo painel da Cloudflare também funciona, mas o próximo deploy volta ao valor do `wrangler.jsonc`.
