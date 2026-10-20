# Árvore de rotas: AB Test Calculator

Mapa completo das telas. Complementa o PRD (referência de navegação e estrutura de URLs).

O produto não tem autenticação: todas as rotas são públicas. Os grupos abaixo seguem o contexto de navegação, não o estado de sessão. Cada idioma tem as mesmas telas com slugs traduzidos; o estado do cálculo vive no fragmento da URL (`#s=...`, ver PRD seção 13) e nunca vira parte do path.

## Entrada e idioma

Sem cabeçalho de navegação: são só redirecionamentos.

| Rota | Descrição |
|---|---|
| `/` | Redireciona (302) para o idioma detectado pelo `Accept-Language`: `pt*` → `/pt/analise`, qualquer outro → `/en/analysis`. O fragmento `#s=...` não chega ao servidor, mas o navegador o reaplica automaticamente na URL de destino do redirect, então links compartilhados com `/` continuam funcionando |
| `/pt` | Redireciona para `/pt/analise` |
| `/en` | Redireciona para `/en/analysis` |

## Calculadora (navegação principal)

Cabeçalho fixo em todas as telas: marca "AB Test Calculator", abas **Análise do teste** e **Pré-teste**, seletor de idioma PT/EN, seletor de tema light/dark, botão "Salvar e compartilhar link". Rodapé com link para "Sobre e metodologia" e uma frase de privacidade ("Nada do que você digita é gravado. Só os números vão para a IA quando você pede o TL;DR.").

### Aba Análise do teste (pós-teste)

Aba padrão de entrada.

| Rota | Descrição |
|---|---|
| `/pt/analise` · `/en/analysis` | Os quatro passos da análise (PRD seções 5 a 9): duração, dados por grupo (controle + até 4 variantes), detalhes e calculadoras (expansível), resultados com seletor Bayesiano / Z test, veredito por variante, alertas, gráficos (PRD seção 10) e bloco de diagnóstico por IA (PRD seção 11). Ao abrir: estado do fragmento > rascunho do `localStorage` > vazio. Com plano vindo do pré-teste, mostra o selo "Plano de <data/hora>" e, se o pré-teste mudou depois, o botão "Atualizar plano". Link "Preencher com dados de exemplo" quando a tela está vazia |

Estados internos (não são rotas, vivem no estado da tela):

- **Vazio:** inputs em branco, resultados com "—", link para dados de exemplo.
- **Inválido:** erros inline nos campos; resultados dependentes em "—"; botão "Gerar TL;DR" desabilitado.
- **Válido:** veredito, gráficos e alertas visíveis; botão "Gerar TL;DR" habilitado.
- **Teste em andamento:** toggle sequencial ligado (só com Z test), bloco de espiada e fronteira visível (PRD seção 4).
- **TL;DR:** gerando (carregamento) → pronto → desatualizado ("Dados mudaram", botão "Gerar de novo") ou fallback (achados das regras + "TL;DR indisponível") ou limite diário atingido.

### Aba Pré-teste

| Rota | Descrição |
|---|---|
| `/pt/pre-teste` · `/en/pre-test` | Inputs compartilhados, seletor de pergunta (Modo A "Qual efeito consigo detectar?" / Modo B "Quero detectar X%: do que preciso?"), tabela de MDE por semana com a curva MDE x semanas (Modo A) ou amostra e duração (Modo B), plano de espiadas e fronteiras sequenciais (PRD seções 3 e 4). Botão "Usar esse plano" leva para `/pt/analise` (ou `/en/analysis`) com o plano carregado no estado; nenhum recarregamento de página |

Estados internos:

- **Modo A / Modo B:** alternância na própria tela, guardada no estado (vai no link compartilhado).
- **Com alerta:** MDE > 10%, duração > 12 semanas, duração < 7 dias (PRD seção 3).

### Navegação entre abas

- Trocar de aba troca de rota **mantendo o fragmento** `#s=...`: o estado das duas abas viaja junto, então ir e voltar não perde nada.
- Trocar de idioma leva para a rota equivalente no outro idioma (`/pt/analise#s=...` ↔ `/en/analysis#s=...`), mantendo o fragmento. O TL;DR já gerado continua no idioma original com o selo correspondente (PRD seção 11).
- As configurações compartilhadas (confiança, poder, hipótese, Bonferroni, moeda) são uma só para as duas abas (PRD seção 2).

## Institucional

Mesmo cabeçalho da calculadora, sem o botão de compartilhar.

| Rota | Descrição |
|---|---|
| `/pt/sobre` · `/en/about` | Ficha técnica: quem fez, todas as fórmulas usadas (pré-teste, Z test, Bayesiano, sequencial, SRM, regras de veredito e achados), referências bibliográficas, o que é processado onde (navegador vs IA) e o que o Umami coleta (e a garantia de que o fragmento da URL nunca é enviado). Não é um guia didático: as explicações didáticas vivem inline na calculadora (PRD seção 12) |

## Camada global

Abertos de qualquer tela, sem mudar de rota.

| Elemento | Descrição |
|---|---|
| Acordeões de explicação | Abrem no lugar, junto do controle a que se referem (PRD seção 12). Não têm rota nem âncora própria |
| Turnstile | Desafio anti-bot exibido ao clicar "Gerar TL;DR" quando necessário |
| Aviso de link inválido | Faixa no topo quando o fragmento não pode ser lido ("Não foi possível ler este link") ou quando o link substituiu um rascunho local |
| Confirmação de cópia | "Link copiado" após "Salvar e compartilhar link" |

## Endpoints (não são telas)

| Rota | Descrição |
|---|---|
| `POST /api/tldr` | Recebe o payload numérico e o token Turnstile, aplica o limite de 20 por dia por IP, chama o Workers AI, valida e devolve o JSON (PRD seção 11). Respostas: 200 com o JSON, 400 payload inválido, 403 Turnstile inválido, 429 limite atingido, 502/504 falha ou timeout da IA. Nada é gravado |

## Erro

| Rota | Descrição |
|---|---|
| Qualquer rota inexistente | Página 404 no idioma detectado, com links para as duas abas da calculadora |
