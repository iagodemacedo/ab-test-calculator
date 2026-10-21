# AGENTS.md: AB Test Calculator

Instruções operacionais para agentes de código neste projeto. Este arquivo é curto de propósito: o conteúdo do produto vive nos três documentos abaixo.

## 1. Documentos de referência

- `PRD.md`: fonte de verdade do produto. Features, fórmulas, regras em tabela, edge cases, pontos a definir e decisões estratégicas. Consulte a seção correspondente antes de implementar qualquer funcionalidade.
- `ROUTES.md`: mapa de telas, slugs por idioma, estados internos de cada tela e endpoints. Consulte ao criar ou alterar telas, navegação ou o Worker.
- `DESIGN.md`: design system "Swiss Neon". Tokens, paleta validada dos gráficos, patterns de componente, anti-slop checklist e lista negra. Consulte antes de escrever qualquer UI.

Nenhuma feature se implementa sem ler a seção correspondente do PRD. Nenhuma tela se cria sem conferir ROUTES.md e DESIGN.md. Se o PRD marca algo como "ponto a definir", pergunte ao usuário antes de decidir por conta própria.

## 2. Restrições invioláveis

1. **Zero servidor próprio.** Só Cloudflare (Workers, Static Assets e primitivas da plataforma) e serviços externos já aprovados no PRD (a instância Umami do dono, `umami.tarvos.cc`, e o OpenRouter para o TL;DR). Nada de VPS, container ou banco gerenciado.
2. **Dados do teste não persistem no servidor.** Os números do usuário nunca são gravados, logados ou cacheados no servidor. Só passam pelo Worker e pelo OpenRouter no momento do TL;DR, sempre com `provider.data_collection: "deny"`. O fragmento da URL (`#s=...`) nunca é enviado a nenhum serviço, inclusive o Umami.
3. **Estatística 100% no navegador.** Nenhum cálculo estatístico depende da rede ou da IA. A IA só interpreta números já calculados pelo motor em `src/stats/`.

Se uma tarefa pedida conflitar com qualquer item desta lista, pare e aponte o conflito em vez de executar.

## 3. Registro de feedbacks

Todo feedback corretivo do usuário (algo que o agente fez e não deveria, ou deveria ter feito diferente) é registrado em `feedback.md`, com data, contexto em uma linha e a instrução acionável que evita a repetição. Os itens têm força de regra: um erro registrado não pode se repetir.

@feedback.md

## 4. Documentos vivos

Quando uma decisão nova surgir durante o desenvolvimento, pergunte ao usuário se deve atualizar o documento correspondente:

- **Decisão de produto** (regra mudou, escopo entrou ou saiu, número definido, ponto em aberto fechado): atualize o `PRD.md`, com nota de escopo datada quando substituir uma decisão anterior.
- **Tela ou fluxo criado, alterado ou removido:** atualize o `ROUTES.md`. Rotas removidas ficam registradas com data e redirect.
- **Token, pattern ou regra visual alterada no código:** atualize o `DESIGN.md` no mesmo PR. O código vence; o documento acompanha. Nova cor de gráfico só entra depois de passar no validador de paleta (DESIGN.md seção 2.2).
