# PRD: AB Test Calculator

## 1. Visão geral

Calculadora de testes A/B gratuita e anônima, publicada em **ab-test.iago.wtf**, para analistas de CRO, PMs e times de growth que precisam planejar um experimento e depois decidir com segurança se a variante venceu. É o embrião de um produto próprio: o v1 não tem conta nem banco, mas é desenhado para ser a melhor calculadora de testes A/B disponível, juntando tudo o que os dois benchmarks de mercado oferecem ([Speero](https://speero.com/ab-test-calculator) e [ABTestGuide](https://abtestguide.com/calc/)) e acrescentando o que nenhum deles tem: diagnóstico por IA e explicações que ensinam.

O produto se sustenta em quatro pilares:

1. **Pré-teste:** planejar o experimento. Quanto tráfego, quantas semanas, qual o menor efeito detectável (MDE) e como ficam as espiadas num teste sequencial.
2. **Análise pós-teste:** medir o resultado com Bayesiano ou Z test, A/B/n com até 5 grupos, alertas de SRM, poucos dados e duração, e impacto em receita.
3. **Diagnóstico por IA:** um TL;DR do resultado em linguagem humana e a explicação de cada problema encontrado, combinando checagens determinísticas e leitura da IA.
4. **Explicações didáticas:** cada conceito estatístico explicado inline, em duas camadas (leigo e técnico), usando os números do próprio usuário.

Os pilares se encadeiam: o pré-teste gera um **plano** que o pós-teste herda; o pós-teste produz números e achados; a IA interpreta esses números; as explicações sustentam a confiança do usuário em cada passo.

> Toda a estatística roda no navegador. A rede só é usada para uma coisa: pedir o TL;DR à IA. Ver seções 14 e 16.

## 2. Estrutura da página e configurações compartilhadas

### Modelo

Duas abas, cada uma com rota própria e slug traduzido: **Análise do teste** (`/pt/analise`, `/en/analysis`) e **Pré-teste** (`/pt/pre-teste`, `/en/pre-test`). Há ainda uma página de ficha técnica, **Sobre e metodologia** (`/pt/sobre`, `/en/about`), com fórmulas e referências. Ver ROUTES.md. As abas compartilham um conjunto de configurações estatísticas: mudar a confiança no pré-teste muda no pós-teste, e vice-versa. O usuário pensa numa coisa só: "o meu teste", planejado e depois analisado.

Aba inicial na primeira visita: **Análise do teste** (é a pergunta mais frequente: "minha variante venceu?"). Se houver estado na URL ou rascunho local, abre a aba que estava ativa.

Um link **"Preencher com dados de exemplo"** (herdado do Speero) popula a aba atual com um cenário fictício realista para quem quer explorar sem dados.

### Configurações compartilhadas

| Configuração | Opções | Padrão | Onde aparece |
|---|---|---|---|
| Nível de confiança | 90% / 95% / 99% (só botões) | 95% | Pré e pós |
| Poder estatístico | 80% / 90% (só botões) | 80% | Pré e pós (detalhes) |
| Hipótese | Bicaudal / Unicaudal | Bicaudal | Pré e pós (Z test) |
| Correção de Bonferroni | Ligada / Desligada | Ligada quando há 3+ grupos | Pré e pós (Z test) |
| Moeda | R$ / $ / € / £ / ¥ | R$ em `/pt`, $ em `/en` | Pós (receita) |

Não existe campo livre para confiança ou poder: os botões cobrem os usos reais e evitam valores sem sentido (ex.: 51%).

### Correção de Bonferroni

Com 3 ou mais grupos (controle + 2 ou mais variantes), cada variante é comparada ao controle, e a chance de um falso positivo em alguma delas cresce. A correção divide o alfa pelo número de comparações.

| Grupos (incl. controle) | Comparações | Alfa efetivo com 95% de confiança |
|---|---|---|
| 2 | 1 | 5% (correção não se aplica) |
| 3 | 2 | 2,5% |
| 4 | 3 | 1,67% |
| 5 | 4 | 1,25% |

- O toggle só aparece com 3+ grupos. Vem **ligado** por padrão.
- A correção afeta o Z test e o tamanho de amostra do pré-teste. No Bayesiano, o limiar de "vencedora" continua igual à confiança escolhida (ver seção 7).
- Desligar o toggle gera um achado de regra "Bonferroni desligado com múltiplas variantes" (seção 11).

## 3. Pré-teste

### Modelo

Uma tela, duas perguntas, os mesmos inputs. O usuário informa o tráfego da página que quer testar e escolhe uma das perguntas:

- **Modo A, "Qual efeito eu consigo detectar?":** tabela por semana mostrando o MDE e os visitantes por variante, mais a curva MDE x semanas.
- **Modo B, "Quero detectar X% de lift: do que preciso?":** amostra necessária por variante e duração em dias.

Absorve as três ferramentas de pré-teste do Speero (tabela de MDE por semana, calculadora de amostra e calculadora de duração) numa só tela. Os dois modos usam a mesma fórmula, então são inversos exatos um do outro: o MDE da semana 3 no Modo A, colocado como lift alvo no Modo B, devolve 3 semanas.

### Estrutura

**Inputs:**

| Campo | Tipo | Validação | Padrão |
|---|---|---|---|
| Tráfego semanal da página (usuários ou sessões) | Inteiro | > 0 | vazio |
| Conversões semanais | Inteiro | ≥ 0 e ≤ tráfego semanal | vazio |
| Nº de grupos (incluindo controle) | Seletor | 2 a 5 | 2 |
| % do tráfego no teste | Número | 1 a 100 | 100% |
| Horizonte da tabela (semanas) | Seletor | 1 a 12 | 4 |
| Lift alvo (só Modo B) | % relativo | > 0 | 10% |
| Espiadas planejadas | Seletor | 1x (sem sequencial) / semanal / N vezes (2 a 12) | 1x |
| Confiança, poder, hipótese, Bonferroni | Compartilhados | seção 2 | seção 2 |

**Saídas derivadas:**

- Taxa de conversão base: `p = conversões semanais / tráfego semanal`.
- Visitantes por variante na semana *w*: `n(w) = tráfego semanal × (% no teste) × w / nº de grupos`.

### Regras de cálculo

| Grandeza | Regra |
|---|---|
| Alfa efetivo | `α' = (1 − confiança) / (grupos − 1)` com Bonferroni ligado; senão `α' = 1 − confiança` |
| z crítico | Bicaudal: `z(1 − α'/2)`. Unicaudal: `z(1 − α')` |
| z do poder | `z(poder)` |
| Amostra por variante (Modo B) | `n = (zα·√(2·p̄·(1−p̄)) + zβ·√(p1(1−p1) + p2(1−p2)))² / (p2 − p1)²`, com `p1 = p`, `p2 = p·(1 + lift)`, `p̄ = (p1 + p2)/2` |
| MDE na semana *w* (Modo A) | O lift relativo que, na fórmula acima, exige exatamente `n(w)` visitantes. Resolvido numericamente (bisseção), para garantir que Modo A e Modo B concordem |
| Duração (Modo B) | `dias = ⌈ n × grupos / (tráfego semanal / 7 × % no teste) ⌉`. Exibir também em semanas e a recomendação de arredondar para semanas cheias |
| Amostra com sequencial | `n` multiplicado pelo fator de inflação do desenho O'Brien-Fleming para o nº de espiadas (seção 4) |

**Tabela do Modo A** (uma linha por semana até o horizonte):

| Coluna | Conteúdo |
|---|---|
| Semana | 1 a N |
| MDE relativo | % (ex.: 8,4%) |
| MDE absoluto | pontos percentuais de CR (ex.: 0,17 p.p.) |
| Visitantes por variante | inteiro formatado por locale |
| Sinal | Aviso amarelo quando MDE > 10% |

**Gráfico:** curva MDE relativo x semanas, com a faixa acima de 10% marcada como zona de alerta (seção 10).

### Alertas

| Condição | Alerta |
|---|---|
| MDE relativo > 10% numa semana | Linha marcada em amarelo. Se todas as semanas do horizonte passam de 10%: aviso "Com esse tráfego, o teste só detecta efeitos grandes. Poucos testes de CRO entregam lifts acima de 10%." |
| Modo B com duração > 12 semanas | Mostra o número real de dias **e** um alerta sugerindo: aumentar o lift alvo, aumentar o % de tráfego no teste ou reduzir o nº de variantes |
| Duração < 7 dias | Aviso recomendando rodar pelo menos 1 semana cheia para cobrir o ciclo semanal |

### Ponte para o pós-teste

Botão **"Usar esse plano"**. Leva para a aba Análise do teste com o **plano** carregado:

| Herdado | Uso no pós-teste |
|---|---|
| Nº de grupos | Cria os campos de variantes |
| Confiança, poder, hipótese, Bonferroni | Já são compartilhados |
| % do tráfego no teste | Preenche o campo de duração |
| Lift alvo (Modo B) ou MDE da semana escolhida (Modo A) | Vira o "lift alvo de referência" do pós-teste |
| Amostra necessária por variante e duração | Alimentam "amostra suficiente?", "dias adicionais necessários" e o alerta de peeking |
| Plano de espiadas | Configura o toggle "teste em andamento" (seção 4) |

No Modo A, o usuário escolhe qual semana do horizonte vira o plano (clique na linha da tabela; padrão: a última semana do horizonte).

### Edge cases

- **Conversões semanais = 0:** CR base 0%, sem cálculo possível. Mensagem: "Sem conversões não dá para estimar o efeito detectável."
- **CR base ≥ 50%:** cálculo continua válido; o lift alvo máximo aceito é o que mantém `p2 ≤ 100%`. Acima disso, o campo mostra erro.
- **Conversões > tráfego:** erro inline no campo de conversões.
- **% de tráfego muito baixo (< 10%):** cálculo segue, com dica de que a duração escala na proporção inversa.
- **Horizonte reduzido depois de escolher a semana do plano:** se a semana escolhida some da tabela, o plano passa a usar a última semana do novo horizonte.
- **Mudar inputs depois de "Usar esse plano":** o plano já carregado no pós-teste não se atualiza sozinho. O pós-teste mostra "plano de <data/hora>" e um botão "atualizar plano" quando o pré-teste mudou.

### Pontos a definir

- Se a tabela do Modo A também mostra a duração em dias para cada semana (redundante, mas útil quando o % de tráfego < 100%).

## 4. Testes sequenciais (group sequential, O'Brien-Fleming)

### Modelo

Quem acompanha o teste enquanto ele roda e decide parar ao ver significância está fazendo **peeking**, e isso infla a taxa de falsos positivos. O teste sequencial resolve isso de forma honesta: o usuário **planeja** quantas vezes vai olhar, e cada espiada tem uma **fronteira** mais exigente nas primeiras olhadas e mais próxima do z crítico normal no fim. Se o resultado cruza a fronteira, pode parar; se não, continua.

Abordagem: **group sequential com função de gasto de alfa de Lan-DeMets tipo O'Brien-Fleming**: `α(t) = 2 − 2·Φ(z(1−α/2) / √t)` para um lado com erro total α, onde `t` é a fração de informação (amostra atual / amostra máxima). No bicaudal, cada lado usa essa função com α/2 (ver tabela de regras).

### Estrutura

**No pré-teste:** seletor "Vou espiar":

| Opção | Espiadas | Fração de informação |
|---|---|---|
| 1x (sem sequencial) | 1 | 1 |
| Semanal | uma por semana do plano | `w / total de semanas` |
| N vezes | 2 a 12 | igualmente espaçadas |

Com 2+ espiadas, o pré-teste mostra:

- **Amostra máxima inflada** por variante (amostra fixa × fator de inflação).
- **Tabela de fronteiras:** espiada, visitantes por variante acumulados, z de fronteira, p-value nominal equivalente.

**No pós-teste:** toggle **"Teste em andamento"**. Ligado, mostra:

- Espiada atual (nº) e fração de informação.
- Fronteira desta espiada e o z observado.
- Decisão: **cruzou a fronteira (pode parar)** ou **não cruzou (continue até a próxima espiada)**.

### Regras

| Regra | Valor |
|---|---|
| Método compatível | Só Z test. Ligar o toggle com o método Bayesiano troca o método para Z test e mostra aviso explicando por quê |
| Fronteiras | Calculadas no navegador por integração numérica recursiva (Armitage-McPherson-Rowe) a partir da função de gasto acima |
| Fração de informação real | Usa a amostra real informada (`n atual / n máximo do plano`), não a planejada; isso mantém o alfa correto se a espiada atrasar ou adiantar |
| Bicaudal | Cada lado gasta metade do alfa com a sua própria função, `α_lado(t) = 2 − 2·Φ(z(1−α/4) / √t)` (convenção do gsDesign e do ldbounds; reproduz as fronteiras publicadas, ex.: 4,8769 … 2,0310 para 5 espiadas a 5%). Nota de escopo (21/10/2026): substituiu a leitura de alfa total dividido entre os lados |
| Unicaudal | `α(t) = 2 − 2·Φ(z(1−α/2) / √t)` com α unicaudal, gasto só na fronteira superior; na última espiada o gasto soma exatamente α. Nota de escopo (21/10/2026): substituiu "mesma função com `z(1−α)`", que gastava 2α |
| Bonferroni | Aplica-se ao alfa total antes de distribuir pelas espiadas |
| Última espiada | Se a amostra atual ≥ amostra máxima, é a análise final: a fronteira é a da última espiada e o veredito segue as regras normais da seção 8 |

### Edge cases

- **Sem plano vindo do pré-teste:** o toggle pede "Quantas espiadas você planejou?" (2 a 12) e "Esta é a espiada nº", e usa frações igualmente espaçadas.
- **Espiada atual > espiadas planejadas:** erro: "Você já passou do número de espiadas planejadas. Use a análise final."
- **Amostra atual maior que a máxima planejada:** trata como análise final, com aviso de que o teste passou do plano.
- **Usuário desliga o toggle no meio de um teste planejado como sequencial:** análise volta a ser de amostra fixa, e o achado de regra "possível peeking" pode disparar (seção 8).

### Pontos a definir

- Se o pré-teste também oferece fronteira de **futilidade** (parar por falta de chance de vencer). Hoje: só fronteira de eficácia.

## 5. Análise do teste: entradas e validação

### Modelo

O usuário cola os números do teste (da ferramenta de teste ou do analytics) e vê o resultado recalculado a cada tecla. A ordem da tela segue o raciocínio do Speero em quatro passos: duração, dados, detalhes e calculadoras, resultados.

### Estrutura

**Passo 1, duração do teste:**

| Campo | Tipo | Validação |
|---|---|---|
| Dias de teste | Inteiro | ≥ 1 |
| % do tráfego da página no teste | Número | 1 a 100, padrão 100 |
| Saída: dias adicionais necessários | Calculado | seção 8 |

**Passo 2, dados por grupo** (controle + 1 a 4 variantes, botão "+ adicionar variante", remover variante pelo próprio card):

| Campo | Tipo | Validação |
|---|---|---|
| Nome do grupo | Texto curto | padrão "Controle", "Variante B", "Variante C"... |
| Usuários ou sessões | Inteiro | > 0 |
| Conversões | Inteiro | ≥ 0 e ≤ usuários |
| Split pretendido | % | padrão igual entre grupos; soma precisa dar 100% |
| Saída: taxa de conversão | Calculado | `conversões / usuários` |

Por variante, o card mostra: lift relativo, p-value (ou probabilidade de vencer, conforme método), transações extras por mês e contribuição monetária mensal (seção 9).

**Passo 3, detalhes e calculadoras** (expansível, herdado do Speero e do ABTestGuide):

- Lift alvo de referência (do plano, ou padrão 10%).
- Amostra necessária por variante e duração necessária, recalculadas com os dados reais.
- Tabela de MDE por semana (1 até 12) com o tráfego real do teste.
- Detalhamento com fórmulas por variante: CR de cada grupo, lift relativo, erro padrão de cada grupo, erro padrão da diferença, Z-score, p-value, poder observado.
- Valor por conversão e moeda (seção 9).

**Passo 4, resultados:** seletor de método (Bayesiano padrão / Z test), hipótese (só Z test), toggle "teste em andamento" (só Z test), veredito por variante, gráficos, alertas, bloco de diagnóstico por IA.

### Edge cases

- **Conversões > usuários:** erro inline; o resultado daquele grupo fica em "—" e nada que dependa dele é calculado.
- **Controle com 0 conversões:** lift relativo indefinido. Mostra "—" no lift e exibe a diferença absoluta em p.p.; Bayesiano continua funcionando (prior Beta(1,1)).
- **Todos os grupos com 0 conversões:** "Sem conversões, não há o que comparar." Nenhum veredito.
- **Split não soma 100%:** erro no bloco de split; SRM não é calculado até corrigir.
- **Remover a variante que estava com TL;DR gerado:** TL;DR fica marcado como desatualizado (seção 11).
- **Números enormes (> 100 milhões):** aceitos; formatação por locale e cálculos em ponto flutuante de 64 bits.

## 6. Análise do teste: Z test (frequentista)

### Modelo

Cada variante é comparada ao controle com um teste Z de duas proporções. Responde: "se não houvesse diferença real, quão improvável seria ver uma diferença deste tamanho?".

### Regras de cálculo

Para cada variante *v* contra o controle *c*:

| Grandeza | Fórmula |
|---|---|
| Taxa de conversão | `CR = conversões / usuários` |
| Lift relativo | `(CRv − CRc) / CRc` |
| Erro padrão de cada grupo | `SE = √(CR·(1 − CR) / usuários)` |
| Erro padrão da diferença | `SEdiff = √(SEc² + SEv²)` |
| Z-score | `(CRv − CRc) / SEdiff` |
| p-value bicaudal | `2·(1 − Φ(|z|))` |
| p-value unicaudal | `1 − Φ(z)` (hipótese: variante > controle) |
| Significativo | `p-value < α'` (alfa efetivo da seção 2) |
| Intervalo de confiança da diferença | `(CRv − CRc) ± z(1 − α'/2)·SEdiff` (bicaudal); unicaudal mostra só o limite inferior, `(CRv − CRc) − z(1 − α')·SEdiff` (nota de escopo 21/10/2026: o z do unicaudal não tinha sido nomeado) |
| IC do lift relativo | IC da diferença dividido por `CRc` (aproximação, indicada no detalhamento) |
| Poder observado | `Φ(|z| − z crítico)` (exibido com a ressalva didática de que poder observado não substitui o planejamento) |

> As fórmulas seguem o ABTestGuide (erro padrão não agrupado) para que um usuário vindo de lá encontre os mesmos números.

### Edge cases

- **Variante idêntica ao controle (z = 0):** p-value = 1 (bicaudal); veredito segue as regras de inconclusiva.
- **Unicaudal com variante pior que o controle:** p-value próximo de 1; nunca vira "perdedora significativa" no unicaudal. A explicação inline avisa que o unicaudal não detecta pioras.
- **CR de 0% ou 100% num grupo:** SE do grupo = 0; o cálculo segue com o SE do outro grupo; se ambos forem 0, "—".

## 7. Análise do teste: Bayesiano (padrão)

### Modelo

Cada grupo tem uma distribuição de crença sobre sua taxa de conversão real, atualizada com os dados. Responde direto à pergunta que o usuário tem: **"qual a probabilidade de a variante ser melhor que o controle?"** e **"quanto eu perco, em média, se implementar?"** (contando como zero os cenários em que a variante é melhor).

### Regras de cálculo

| Grandeza | Regra |
|---|---|
| Prior | Fixo **Beta(1, 1)** (não informativo) |
| Posterior de cada grupo | `Beta(1 + conversões, 1 + usuários − conversões)` |
| Simulação | Monte Carlo com **50.000 amostras** por grupo, gerador pseudoaleatório com **semente derivada do hash dos inputs** (mesmos números → mesmo resultado, sempre; essencial para links compartilhados e para o selo de desatualizado) |
| Probabilidade de vencer o controle | `P(CRv > CRc)` = fração das amostras em que a variante supera o controle |
| Probabilidade de ser a melhor (A/B/n) | Fração das amostras em que o grupo tem a maior CR entre todos (exibida com 3+ grupos) |
| Risco esperado de implementar | `E[max(CRc − CRv, 0)]`, em p.p. de CR e relativo à CRc. Menor é melhor |
| Intervalo de credibilidade do lift | Quantis `(1−conf)/2` e `1 − (1−conf)/2` de `(CRv − CRc)/CRc` |
| Vencedora | `P(CRv > CRc) ≥ confiança` (95% → ≥ 95%) |
| Perdedora | `P(CRv > CRc) ≤ 1 − confiança` |

- O Bayesiano não aplica Bonferroni nem hipótese uni/bicaudal; os controles somem da interface quando ele está selecionado (ficam lembrados para quando o usuário voltar ao Z test).
- O cálculo roda num **Web Worker** se passar do orçamento de 16 ms por recálculo (seção 18).

> Nota (21/10/2026): o Node 24 (V8 com Maglev OSR, nodejs/node#66457) corrompia campos decimais de objetos montados na mesma função do laço Monte Carlo, dando números diferentes para a mesma entrada em cerca de 1 de cada 80 execuções. O motor mantém os laços quentes em funções separadas e o teste `src/stats/jit.test.ts` compara motores frios com o interpretador. O projeto exige Node 26.12 ou superior (`.nvmrc`).

### Edge cases

- **Bayesiano e Z test discordam** (ex.: P(vencer) = 96% mas p-value bicaudal = 0,08; nota de escopo 21/10/2026: o exemplo anterior, 0,06, não era coerente com 96%): não é bug, é esperado perto do limiar. Gera achado de regra informativo "métodos discordam" com explicação (seção 11).
- **Amostras muito pequenas (< 30 usuários por grupo):** cálculo roda, mas o alerta de poucos dados dispara.
- **Troca de método com TL;DR gerado:** TL;DR fica desatualizado (o resultado mostrado mudou).

### Pontos a definir

- Se 50.000 amostras são suficientes para estabilidade na segunda casa decimal com 5 grupos (validar na implementação; ajustar o número, não a regra).

## 8. Veredito e checagens

### Veredito por variante (quatro estados)

| Estado | Z test | Bayesiano |
|---|---|---|
| **Vencedora** | Significativo e lift > 0 | `P(vencer) ≥ confiança` |
| **Perdedora** | Significativo e lift < 0 (só bicaudal) | `P(vencer) ≤ 1 − confiança` |
| **Inconclusiva, sem diferença relevante** | Não significativo **e** MDE atingido ≤ lift alvo de referência | Mesma regra de amostra, com P(vencer) entre os limiares |
| **Inconclusiva, sem poder** | Não significativo **e** MDE atingido > lift alvo de referência | Idem |

- **Lift alvo de referência:** vem do plano (seção 3) ou, sem plano, padrão **10%** (editável no passo 3).
- **MDE atingido:** o MDE que a amostra atual de cada variante consegue detectar, com a mesma fórmula do pré-teste.
- Lógica: se o teste já tinha amostra para detectar o efeito que importava e não detectou, "não há diferença relevante". Se não tinha, "ainda não dá para saber".
- Frase-manchete em linguagem natural para cada estado (estilo ABTestGuide), por exemplo: "A Variante B converteu 6,0% a mais que o controle. A chance de ela ser realmente melhor é de 97%."

### Dias adicionais necessários

`dias adicionais = max(0, ⌈ (amostra necessária para o lift alvo de referência − menor amostra entre as variantes) × grupos / tráfego diário no teste ⌉)`, com tráfego diário no teste = total de usuários / dias de teste. Sem dias de teste informados, mostra "—" e pede o dado.

### Checagens determinísticas (alertas)

| ID | Condição | Severidade | Texto-base |
|---|---|---|---|
| `srm` | Qui-quadrado de aderência (usuários observados vs split pretendido), `p < 0,01` | Crítico | "Possível Sample Ratio Mismatch: a divisão de tráfego não bate com o split pretendido. Verifique a distribuição antes de confiar no resultado." |
| `low_data` | Resultado significativo **e** diferença ponderada de conversões ≤ 20 (`|convV − convC × usuáriosV/usuáriosC| ≤ 20`) | Atenção | "Resultado significativo, mas sustentado por 20 conversões de diferença ou menos." |
| `under_7_days` | Dias de teste < 7 | Atenção | "O teste não cobriu um ciclo semanal completo." |
| `incomplete_weeks` | Dias de teste ≥ 7 e não múltiplo de 7 | Info | "Semanas incompletas: considere fechar em <próximo múltiplo de 7> dias para equilibrar os dias da semana." |
| `over_8_weeks` | Dias de teste > 56 | Atenção | "Testes longos sofrem com poluição de amostra (cookies apagados, sazonalidade)." |
| `stopped_early` | Há plano vindo do pré-teste, amostra atual < planejada, toggle sequencial desligado (nota de escopo 21/10/2026: sem plano não dispara; com "amostra necessária calculada" ele dispararia em quase todo teste) | Crítico | "Possível peeking: o teste parou antes da amostra planejada." |
| `underpowered` | Veredito "Inconclusiva, sem poder" | Atenção | "Amostra insuficiente para detectar o lift alvo de <X%>." |
| `mde_high` | MDE atingido > 10% | Info | "Com esta amostra, só efeitos acima de <X%> seriam detectados." |
| `bonferroni_off` | 3+ grupos e Bonferroni desligado | Atenção | "Sem correção para múltiplas comparações, a chance de falso positivo cresce." |
| `methods_disagree` | Veredito Z test ≠ veredito Bayesiano | Info | "Os dois métodos discordam; o resultado está perto do limiar." |
| `seq_not_crossed` | Toggle sequencial ligado e z não cruzou a fronteira | Info | "Fronteira desta espiada não cruzada: continue até a próxima." |

O qui-quadrado usa `χ² = Σ (observado − esperado)² / esperado`, com esperado = total de usuários × split pretendido e `grupos − 1` graus de liberdade.

Esses achados alimentam a UI diretamente (alertas) e são a lista-base enviada à IA (seção 11). Cada um tem texto-padrão pré-escrito em PT e EN, usado também como fallback quando a IA falha.

### Edge cases

- **SRM com split intencionalmente desigual (ex.: 90/10):** o usuário informa o split; o qui-quadrado usa o esperado correto.
- **Vários alertas críticos ao mesmo tempo:** todos aparecem, ordenados por severidade e depois pela ordem da tabela.
- **Veredito "Vencedora" com `srm` ativo:** o veredito continua visível, mas recebe um selo "não confiável até resolver o SRM".

## 9. Receita

### Modelo

Traduz o lift em dinheiro, como o Speero: quanto a variante acrescenta por mês e no horizonte escolhido.

### Estrutura e regras

| Campo / saída | Regra |
|---|---|
| Valor por conversão | Um número só (ticket médio ou valor de lead), aplicado a todos os grupos |
| Moeda | R$ / $ / € / £ / ¥ (só rótulo e formatação; sem conversão cambial) |
| Horizonte | 3 / 6 / 12 meses, padrão 6 |
| Visitantes mensais da página | `(total de usuários no teste / dias de teste) × 30 / (% no teste)` |
| Transações extras por mês (por variante) | `visitantes mensais × (CRv − CRc)` |
| Contribuição monetária mensal | `transações extras × valor por conversão` |
| Impacto no horizonte | `contribuição mensal × meses` (projeção linear, sem decaimento) |
| Previsão de receita (controle e cada variante) | `visitantes mensais × CR do grupo × valor × meses` |

### Edge cases

- **Sem dias de teste ou sem valor por conversão:** bloco de receita mostra "Informe a duração do teste e o valor por conversão".
- **Lift negativo:** valores negativos exibidos como perda, em vermelho.
- **Variante inconclusiva:** valores exibidos com o selo "estimativa não confirmada estatisticamente".

### Pontos a definir

- Se o Bayesiano usa a média posterior (em vez da CR observada) para a projeção de receita. Hoje: CR observada nos dois métodos.

## 10. Gráficos

Todos com a paleta neon do design system (ver DESIGN.md), legíveis em light e dark.

| Gráfico | Aba | Conteúdo |
|---|---|---|
| Curva MDE x semanas | Pré-teste | MDE relativo por semana, faixa > 10% marcada, ponto da semana escolhida para o plano |
| Distribuições das CRs | Pós | Uma curva de densidade por grupo: normal (Z test) ou posterior Beta (Bayesiano). Região do intervalo marcada |
| Distribuição do lift | Pós | Curva/histograma do lift relativo de cada variante vs controle; área > 0 destacada (no Bayesiano, essa área é a P(vencer)) |
| Intervalos do lift | Pós | Barras horizontais com o IC (ou intervalo de credibilidade) de cada variante e a linha do zero |
| Projeção de receita | Pós | Linha acumulada mês a mês no horizonte, controle vs variantes |

- Gráficos reagem ao recálculo sem animação longa (transição ≤ 150 ms).
- Cada gráfico tem uma tabela equivalente acessível (para leitores de tela e para copiar números).

## 11. Diagnóstico por IA

### Modelo

Depois que a análise é válida, o botão **"Gerar TL;DR"** pede à IA um resumo humano do resultado e a explicação de cada problema. A IA **não calcula estatística**: ela recebe os números já calculados e a lista de achados das regras (seção 8), explica o que significam e pode **apontar problemas adicionais** que perceber nos números. Achados da IA são sempre marcados como tal.

### Estrutura

**Entrada enviada ao endpoint** (só números, nenhum texto livre do usuário):

| Bloco | Conteúdo |
|---|---|
| Contexto | idioma ativo, método, confiança, poder, hipótese, Bonferroni |
| Grupos | nome, usuários, conversões, CR, split pretendido |
| Resultados | por variante: lift, p-value, P(vencer), IC do método ativo, risco esperado, MDE atingido, veredito, e o estado sequencial (espiada, fronteira, z observado, cruzou) |
| Duração e plano | dias, % de tráfego, amostra planejada, lift alvo de referência, dias adicionais |
| Receita | por variante: contribuição mensal e impacto no horizonte (se houver) |

> Nota de escopo (21/10/2026): contrato v2 em `src/shared/tldr-contract.ts`. Números sem valor finito (intervalo aberto, MDE ou dias adicionais infinitos) viajam como `null`. Grupos podem ter ids não contíguos (A, B, D) para manter a cor de cada slot.
| Achados das regras | lista de IDs com parâmetros (ex.: `srm` com p = 0,003) |
| Turnstile | token de verificação |

Os nomes dos grupos são os únicos textos do usuário enviados; são truncados em 40 caracteres.

**Saída (JSON validado contra esquema):**

| Campo | Regra |
|---|---|
| `tldr` | 2 a 4 frases, no idioma ativo |
| `findings[]` | Lista de achados |
| `findings[].source` | `rule` (veio da seção 8) ou `ai` (inferido pela IA) |
| `findings[].rule_id` | ID da regra, quando `source = rule` |
| `findings[].severity` | `critical` / `warning` / `info`. **`critical` só para achados de origem `rule`**; achados de origem `ai` vão no máximo até `warning`. Se a IA devolver `critical` num achado próprio, a UI rebaixa para `warning` |
| `findings[].title` | Uma linha |
| `findings[].explanation` | O problema em linguagem simples, citando os números |
| `findings[].action` | O que fazer |

Todo achado de regra enviado precisa voltar na resposta (a IA explica, não descarta). A UI ordena por severidade e mostra um selo "apontado pela IA" nos de origem `ai`.

### Regras

| Regra | Valor |
|---|---|
| Gatilho | Só pelo botão; nunca automático |
| Pré-condição | Análise válida (pelo menos um veredito calculado) |
| Provedor | **OpenRouter** com o modelo `anthropic/claude-haiku-5.5` (configurado só em `vars.AI_MODEL`), chamado pelo Worker com JSON schema estrito, raciocínio desligado e `provider.data_collection: "deny"` (só provedores que não guardam dados; o OpenRouter pode servir o modelo pela Anthropic, Azure, Google Cloud ou AWS). Chave no segredo `OPENROUTER_API_KEY`. Nota de escopo (21/10/2026): substituiu o Workers AI |
| Rate limit | **20 gerações por dia por IP** |
| Anti-bot | **Turnstile** antes de cada chamada; token validado no Worker |
| Persistência | Nenhuma no servidor: nem entrada, nem saída, nem cache |
| Timeout | 20 s; depois disso, fallback |
| JSON inválido | Uma nova tentativa; persistindo, fallback |
| Achado de regra ausente na resposta | A UI completa com o texto-padrão da regra |
| Prompt | Instrui: não recalcular, não contradizer os números recebidos, não inventar dados, responder no idioma ativo, separar o que veio das regras do que foi inferido |

**Fallback** (cota, timeout, rate limit, erro): o bloco mostra os achados das regras com os textos-padrão pré-escritos e o aviso "TL;DR indisponível agora. Tente de novo." Com rate limit estourado: "Você atingiu o limite de 20 resumos por dia."

**TL;DR desatualizado:** se qualquer input, o método ou um grupo muda depois da geração, o bloco fica esmaecido com o selo **"Dados mudaram"** e o botão **"Gerar de novo"**. A detecção compara o hash dos inputs atuais com o hash gravado junto do TL;DR.

### Edge cases

- **IA aponta um "problema" que contradiz um número calculado:** o prompt proíbe, mas a UI não tem como verificar texto; por isso o selo "apontado pela IA" e a ordem (regras primeiro em empate de severidade).
- **Usuário gera, compartilha o link, quem abre muda os números:** o TL;DR compartilhado fica desatualizado para quem abriu (hash diferente).
- **Idioma trocado depois de gerar:** TL;DR continua no idioma original, com selo "gerado em PT/EN" e botão para gerar no idioma atual.

### Pontos a definir

- **Modelo:** decidido pelo dono em 21/10/2026, Claude Haiku 5.5 via OpenRouter. Custo medido numa chamada pequena: US$ 0,0000636; um TL;DR completo fica perto de US$ 0,0004 (estimativa). O Workers AI com `llama-3.3-70b` cabia só uns 70 TL;DR por dia na cota grátis da conta inteira.
- **Implementação do limite diário:** o binding de Rate Limiting dos Workers só trabalha com janelas curtas (10 ou 60 s), então "20 por dia" precisa de um contador próprio (proposta: Durable Object com chave = hash do IP e expiração em 24 h; guarda só o contador, nunca dados do teste). Usar o binding de Rate Limiting por cima, para rajadas.

## 12. Explicações didáticas

### Modelo

Tudo **inline**, dentro da calculadora, junto do controle a que se refere: um ícone "?" ou um link "o que é isso?" abre um acordeão no lugar. Não existe página de guia separada.

Cada explicação tem **duas camadas**:

1. **Para todo mundo:** um parágrafo com analogia, sem fórmula.
2. **Ver detalhes:** fórmula, premissas, e quando o método engana.

Quando há dados, a explicação **usa os números do usuário** ("no seu teste, P(vencer) = 97% quer dizer que..."). Sem dados, usa um exemplo fixo.

### Conceitos cobertos

| Conceito | Onde abre | Pontos obrigatórios da camada técnica |
|---|---|---|
| Bayesiano | Seletor de método | Prior Beta(1,1), posterior, P(vencer), risco esperado; por que não precisa de "significância" |
| Z test | Seletor de método | Hipótese nula, Z-score, p-value; premissa de amostra grande |
| Bayesiano vs Z test | Seletor de método | Quando cada um é melhor; por que podem discordar perto do limiar |
| p-value | Card da variante | O que **não** é (não é a probabilidade de a variante ser melhor) |
| Confiança e poder | Botões de configuração | Erro tipo I e tipo II, com a troca entre eles |
| MDE e tamanho de amostra | Pré-teste | Por que tráfego baixo só detecta efeitos grandes |
| Uni vs bicaudal | Seletor de hipótese | O unicaudal não detecta pioras |
| Bonferroni | Toggle | Múltiplas comparações e falso positivo |
| Risco esperado | Resultado Bayesiano | "Quanto eu perco, em média, se implementar": `P(pior) × perda média quando pior`, não a perda dado que errei |
| SRM | Alerta de SRM | Causas comuns (bots, redirect, cache, bucketing) |
| Peeking e sequencial | Toggle "teste em andamento" e alerta `stopped_early` | Por que espiar infla o falso positivo; como as fronteiras resolvem |

### Regras

- Textos escritos por gente e revisados para correção estatística; **não** são gerados pela IA.
- Textos em PT e EN nos catálogos de tradução.
- Os trechos dinâmicos são templates com variáveis (ex.: `{probabilidade}`), formatados por locale.

### Revisão

- A correção estatística dos textos (explicações, textos-padrão dos achados, frases-manchete, página Sobre e metodologia) é revisada pelo Claude antes do lançamento, conferindo cada afirmação contra as fórmulas deste PRD. Decisão do dono do produto em 20/10/2026.

## 13. Compartilhamento e rascunho local

### Modelo

O resultado é compartilhável por link, sem conta. Tudo o que está na tela vai codificado na URL, inclusive o TL;DR da IA. Quem abre vê exatamente o que foi visto, sem gastar IA.

### Regras

| Item | Regra |
|---|---|
| O que vai na URL | Aba ativa, todos os inputs das duas abas, configurações compartilhadas, método, moeda, horizonte, plano, estado do sequencial, TL;DR (texto + achados + hash dos inputs + data + idioma) |
| Formato | Estado serializado e comprimido no fragmento (`#s=...`), para não ir ao servidor nem para logs |
| Botão | "Salvar e compartilhar link" copia a URL para a área de transferência e mostra "Link copiado" |
| Rascunho local | `localStorage` guarda o estado atual a cada mudança (debounce de 500 ms); botão "Limpar" apaga o rascunho e zera a tela |
| Precedência ao abrir | Estado na URL > rascunho local > página vazia |
| TL;DR compartilhado | Exibido com "Gerado por IA em <data>" |

### Edge cases

- **URL corrompida ou de versão antiga do formato:** ignora o estado, abre vazio e avisa "Não foi possível ler este link". O formato tem número de versão.
- **URL longa demais (TL;DR + 5 grupos):** o estado é comprimido; se a URL final passar de 8.000 caracteres (limite seguro para apps de mensagem e encurtadores), o link é gerado sem o TL;DR e avisa.
- **Abrir link com rascunho local existente:** o link vence; o rascunho anterior é substituído (com aviso "seu rascunho anterior foi substituído pelo link").

## 14. Restrições invioláveis

| Restrição | Racional |
|---|---|
| **Zero servidor próprio.** Só Cloudflare (Workers e Static Assets, mais primitivas da própria plataforma). Nada de VPS, container ou banco gerenciado | Menor infraestrutura possível, custo praticamente zero, nada para manter |
| **Dados do teste não persistem.** Os números do usuário nunca são gravados no servidor; só passam pela IA no momento do TL;DR | Privacidade e confiança: dados de teste são sensíveis para empresas |
| **Estatística 100% no navegador.** Nenhum cálculo estatístico depende da rede ou da IA; a IA só interpreta números já calculados | Resultado instantâneo, auditável e reprodutível; a IA nunca pode errar uma conta |

## 15. Decisões estratégicas registradas

- **Clonar todas as features do Speero e do ABTestGuide:** o objetivo é ser a calculadora mais completa; nenhum usuário vindo de lá pode sentir falta de algo.
- **Bayesiano como método padrão:** responde a pergunta que o usuário realmente faz ("qual a chance de ser melhor?"), como o Speero destaca.
- **Limiar Bayesiano igual à confiança escolhida:** um controle só governa os dois métodos; menos confusão.
- **Prior fixo Beta(1,1):** simples e auditável; prior configurável seria poder demais para pouco uso.
- **Fórmulas de erro padrão iguais às do ABTestGuide:** quem compara números entre ferramentas encontra os mesmos.
- **Bonferroni ligado por padrão:** honestidade estatística por padrão; quem sabe o que faz desliga.
- **Confiança e poder só em botões:** evita configurações sem sentido e simplifica as explicações.
- **Pré-teste em uma tela com dois modos inversos:** absorve três ferramentas do Speero sem triplicar inputs.
- **Group sequential O'Brien-Fleming em vez de always-valid (mSPRT):** padrão de mercado, mais fácil de explicar, e casa com o planejamento por semanas.
- **Veredito em quatro estados:** separa "não há diferença" de "ainda não dá para saber", a confusão mais comum em testes inconclusivos.
- **Problemas detectados por regras + IA:** as regras garantem o básico de forma determinística; a IA acrescenta leitura de contexto, sempre marcada.
- **Só as regras definem um achado como crítico:** a IA vai no máximo até "atenção". O alarme mais alto fica reservado ao que é verificável por conta.
- **IA só por botão, com Turnstile e 20 por dia por IP:** controla custo e abuso sem conta de usuário.
- **OpenRouter com Claude Haiku 5.5 em vez do Workers AI (21/10/2026, substituiu a decisão de 20/10/2026):** a cota grátis do Workers AI comportava uns 70 TL;DR por dia na conta inteira com o modelo provisório, e o Haiku escreve melhor em português e segue o JSON. Continua sem servidor próprio; o custo passa a ser por chamada (perto de US$ 0,0004) e os números do TL;DR passam por OpenRouter e por provedores que não guardam dados.
- **IA recebe só números:** nada de texto livre do usuário; reduz risco de vazamento de informação sensível e de prompt injection.
- **Sem cache de respostas da IA:** cache seria persistência de dados do teste, o que fere a restrição.
- **TL;DR vai no link compartilhado:** reproduz exatamente o que foi visto, sem gastar IA de novo.
- **Estado no fragmento da URL (`#`):** o estado nunca chega ao servidor nem aos logs.
- **Explicações só inline, escritas por gente:** o aprendizado acontece no momento da dúvida; texto didático gerado por IA não tem garantia de correção.
- **Desktop-first:** analistas usam no notebook; o mobile funciona empilhado.
- **Idiomas com prefixo de URL (`/pt`, `/en`):** cada idioma indexável, bom para SEO de um produto que quer crescer.
- **Umami para analytics (substituiu Cloudflare Web Analytics em 20/10/2026):** escolha do dono do produto. Desde 21/10/2026 usa a instância do próprio dono (`umami.tarvos.cc`), que já existe fora deste produto; o produto continua sem servidor próprio. O fragmento da URL nunca é enviado.

**Deliberadamente fora do v1:**

- **Conta, histórico e monetização:** o v1 é anônimo e gratuito; registrado como direção futura de produto, sem arquitetura agora.
- **Métricas contínuas** (receita por visitante, ticket médio como métrica, t-test de Welch): v1 só trata taxa de conversão.
- **Calculadora de FDR** (False Discovery Rate do programa de testes).
- **Import de CSV ou colar planilha.**
- **Integrações com GA4, VWO, Optimizely:** exigiriam OAuth e tokens, o que conflita com zero servidor e nada persistido.
- **Campo de contexto livre para a IA.**
- **Página de guia separada sobre os métodos.**
- **Fronteira de futilidade no sequencial** (ponto a definir na seção 4).

## 16. Arquitetura e dados (Cloudflare)

### Visão conceitual

O produto é um **site estático** com um **único endpoint dinâmico**. O navegador baixa a página, calcula tudo localmente e só fala com a rede para pedir o TL;DR.

| Peça | Papel |
|---|---|
| **Cloudflare Workers + Static Assets** | Serve o HTML, CSS, JS e fontes pré-gerados para `/pt` e `/en`. Redireciona `/` para o idioma detectado |
| **Motor estatístico (no navegador)** | Módulo puro, sem dependência de UI: pré-teste, Z test, Bayesiano, sequencial, SRM, regras de achados. Testável isoladamente. Pode rodar num Web Worker |
| **Worker `/api/tldr`** | Valida o Turnstile, aplica rate limit, monta o prompt com o payload, chama o OpenRouter, valida o JSON, responde. Sem estado de dados |
| **OpenRouter + Claude Haiku 5.5** | Modelo de linguagem que redige o TL;DR e os achados. Só provedores que não guardam dados (`data_collection: deny`) |
| **Turnstile** | Verificação anti-bot antes de cada geração |
| **Contador de limite diário** | Ponto a definir na seção 11 (proposta: Durable Object com contador por hash de IP, TTL 24 h) |
| **Umami (`umami.tarvos.cc`)** | Pageviews e eventos anônimos de uso, sem cookie (seção 19). Instância do dono, externa ao produto |

### Fluxo de dados

1. Usuário digita → motor estatístico recalcula no navegador → UI atualiza.
2. Estado → serializado no fragmento da URL e no `localStorage`.
3. Usuário clica "Gerar TL;DR" → Turnstile emite token → navegador envia payload numérico para `/api/tldr`.
4. Worker valida token e limite → chama o OpenRouter → valida JSON → devolve. Nada é gravado no Worker.
5. Navegador renderiza o TL;DR, guarda junto do hash dos inputs, atualiza a URL.

Não há dados externos nem rotinas de sincronização.

### Pontos a definir

- Nenhum em aberto na stack de front: Astro (estático) + ilhas Preact + Tailwind v4, gráficos em SVG próprio. Detalhes em DESIGN.md seção 10.

## 17. Internacionalização

### Modelo

- Dois idiomas no lançamento: **Português (Brasil)** e **Inglês**.
- **Prefixo na URL:** `/pt` e `/en`, com slugs traduzidos por aba (`/pt/analise`, `/pt/pre-teste`, `/en/analysis`, `/en/pre-test`). A raiz `/` redireciona para o idioma do navegador (`Accept-Language`), com fallback para `/en`.
- Seletor de idioma no cabeçalho troca de rota **preservando o estado** (o fragmento `#s=...` vai junto).
- Cada idioma tem título, descrição e `hreflang` próprios para SEO.

### Escopo

| Item | Tratamento |
|---|---|
| UI, alertas, textos-padrão dos achados, explicações | Traduzidos nos catálogos PT e EN |
| Números, porcentagens, moeda | Formatados por locale (`1.234,5` em PT, `1,234.5` em EN) |
| Entrada numérica | Aceita o separador decimal do locale ativo |
| TL;DR da IA | Gerado no idioma ativo no momento da geração |
| Nomes de grupos | Não traduzidos (texto do usuário) |

## 18. Performance

Requisito, não polimento.

| Meta | Valor |
|---|---|
| Lighthouse (performance, desktop e mobile) | ≥ 95 |
| JavaScript total enviado (gzip) | ≤ 150 KB |
| Recálculo por tecla | < 16 ms na thread principal; o que passar disso (simulação Bayesiana com 5 grupos, fronteiras sequenciais) vai para um Web Worker |
| Primeira renderização | Página estática pré-gerada, sem esperar JS para mostrar o layout |
| Resposta do TL;DR | Botão mostra estado de carregamento imediato; timeout em 20 s |

- Fontes auto-hospedadas e subconjuntadas.
- Gráficos carregados de forma tardia (só quando a área de resultados aparece).
- Nenhuma chamada de rede no caminho do cálculo.

## 19. Analytics (Umami)

> Nota de escopo (20/10/2026): substituiu Cloudflare Web Analytics + Workers Analytics Engine. Decisão do dono do produto: usar Umami.

### Modelo

> Nota de escopo (21/10/2026): substituiu o Umami Cloud pela instância que o dono já mantém, `umami.tarvos.cc` (website id `b6e24c23-8f7b-4e52-bf87-b5b641d4f119`). O produto não ganha servidor: a instância existe e é operada fora dele.

O script do Umami é carregado de forma assíncrona e mede pageviews (cada aba é uma rota, então a troca de aba já conta como pageview) e eventos personalizados via `umami.track`. Sem cookie.

### Regras

| Regra | Valor |
|---|---|
| Fragmento da URL | **Nunca enviado ao Umami.** O fragmento `#s=...` carrega os números do teste; o tracker é configurado para excluir o hash (e a query string) da URL registrada. Verificar no lançamento, com o painel do Umami, que nenhuma URL registrada contém `#` |
| Dados dos eventos | Só os campos da tabela abaixo; nenhum número do teste, nenhum nome de grupo, nenhum texto da IA |
| Carregamento | `defer`, fora do caminho crítico. O script remoto não entra na medição local do orçamento de JS da seção 18 |
| Domínio | `data-domains=ab-test.iago.wtf`: dev, preview e verificação local nunca registram visitas |
| Bloqueadores de anúncio | Aceito: se o script for bloqueado, a calculadora funciona igual |

### Eventos

| Evento | Dados anexos permitidos |
|---|---|
| `method_changed` | método escolhido |
| `pretest_mode_changed` | Modo A / Modo B |
| `plan_used` | nº de grupos, sequencial sim/não |
| `variant_added` | nº de grupos resultante |
| `sequential_toggled` | ligado / desligado |
| `tldr_requested` | idioma |
| `tldr_result` | sucesso / fallback / rate limit |
| `share_link_copied` | com ou sem TL;DR |
| `example_data_loaded` | aba |
| `explanation_opened` | ID do conceito |
| `language_switched` | idioma de destino |
| `theme_switched` | light / dark |

Os eventos saem direto do navegador para o Umami; não passam pelo Worker.

### Pontos a definir

- Proxy do script do Umami pelo Worker, para reduzir bloqueio por adblock. Hoje o script vem direto de `umami.tarvos.cc`.
