// Textos didáticos e de achados em português do Brasil (PRD seções 8, 11 e 12).
// Escritos à mão e conferidos contra as fórmulas do PRD. Números sempre passam por `fmt`.
import type { Finding } from "../../stats/types";
import type { ContentPack, ExplanationContext, Fmt, FindingText, HeadlineInput } from "./types";

const paragraphs = (...ps: string[]): string => ps.join("\n\n");

/** "de 0,012" ou "abaixo de 0,001", para frases como "p-value de 0,012". */
function pValuePhrase(p: number, fmt: Fmt): string {
  return p < 0.001 ? `abaixo de ${fmt.num(0.001, 3)}` : `de ${fmt.num(p, 3)}`;
}

/** Probabilidade sem arredondar para 0% ou 100%, que o método nunca afirma. */
function chance(p: number, fmt: Fmt): string {
  if (p > 0.999) return `mais de ${fmt.pct(0.999, 1)}`;
  if (p < 0.001) return `menos de ${fmt.pct(0.001, 1)}`;
  return fmt.pct(p, 1);
}

const days = (n: number, fmt: Fmt): string => `${fmt.int(n)} ${n === 1 ? "dia" : "dias"}`;

function finding(f: Finding, fmt: Fmt): FindingText {
  const title = ruleTitle[f.rule];
  switch (f.rule) {
    case "srm":
      return {
        title,
        explanation: `A divisão de usuários entre os grupos não bate com o split pretendido. O teste qui-quadrado deu p-value ${pValuePhrase(f.pValue, fmt)}, abaixo do limite de ${fmt.num(0.01, 2)}. Se o sorteio dos grupos funcionasse como planejado, um desequilíbrio desse tamanho seria muito raro. Por isso o resultado pode estar enviesado, mesmo que pareça conclusivo.`,
        action:
          "Não decida com este resultado. Confira primeiro se o split informado aqui é o mesmo configurado na ferramenta de teste. Depois procure as causas comuns, como bots filtrados só num grupo, um redirect que perde usuários, cache servindo a versão errada ou erro no bucketing. Corrija a causa e rode o teste de novo.",
      };
    case "low_data":
      return {
        title,
        explanation: `O resultado da variante ${f.variant} é conclusivo, mas se apoia em só ${fmt.num(Math.abs(f.weightedDiff), 1)} conversões de diferença, já ajustadas pelo tamanho dos grupos. Com uma margem tão pequena, poucos usuários a mais ou a menos mudam o veredito. Efeitos assim costumam encolher quando o teste continua.`,
        action:
          "Trate o resultado como um sinal preliminar. Deixe o teste rodar até a amostra planejada antes de implementar, ou confirme o efeito num segundo teste.",
      };
    case "under_7_days":
      return {
        title,
        explanation: `O teste rodou ${days(f.days, fmt)}, menos que uma semana. A conversão costuma mudar entre dias úteis e fim de semana, e o resultado reflete só uma parte desse ciclo.`,
        action: `Deixe o teste rodar pelo menos ${days(7, fmt)}, de preferência em semanas cheias, antes de decidir.`,
      };
    case "incomplete_weeks":
      return {
        title,
        explanation: `O teste tem ${days(f.days, fmt)}, que não fecham semanas cheias. Alguns dias da semana aparecem mais vezes que outros na amostra. Se o efeito da variante muda ao longo da semana, o resultado pesa mais os dias repetidos.`,
        action: `Considere fechar o teste em ${days(f.suggestedDays, fmt)} para equilibrar os dias da semana.`,
      };
    case "over_8_weeks":
      return {
        title,
        explanation: `O teste já tem ${days(f.days, fmt)}, mais de 8 semanas. Em testes longos, usuários apagam cookies ou trocam de aparelho e podem cair em outro grupo. Sazonalidade e mudanças no site também se misturam ao efeito da variante.`,
        action:
          "Se a amostra planejada já foi atingida, encerre e analise. Se o teste ainda precisa de muito mais tempo, considere reduzir o número de variantes, colocar mais tráfego no teste ou testar uma mudança maior.",
      };
    case "stopped_early":
      return {
        title,
        explanation: `A variante ${f.variant} tem ${fmt.int(f.current)} usuários, abaixo dos ${fmt.int(f.planned)} planejados, e o teste não está marcado como sequencial. Se você olha o resultado antes da hora e para ao ver significância, a chance de um falso positivo fica bem acima do alfa escolhido. Efeitos vistos cedo também tendem a ser maiores que os reais.`,
        action:
          'Deixe o teste rodar até a amostra planejada. Se precisa acompanhar o teste enquanto ele roda, ligue "Teste em andamento" e decida pelas fronteiras do teste sequencial.',
      };
    case "underpowered":
      return {
        title,
        explanation: `O resultado da variante ${f.variant} não é conclusivo, e a amostra atual é pequena para detectar o lift alvo de ${fmt.pct(f.referenceLift, 1)}. Isso não quer dizer que não há efeito. Um efeito real desse tamanho ainda pode estar escondido no ruído.`,
        action: `Continue o teste até a amostra necessária e veja os dias adicionais no passo 1. Se isso levar tempo demais, decida se só um efeito acima de ${fmt.pct(f.referenceLift, 1)} interessa ao negócio.`,
      };
    case "mde_high":
      return {
        title,
        explanation: `Com a amostra atual da variante ${f.variant}, o teste só tem o poder escolhido para detectar lifts de ${fmt.pct(f.mde, 1)} ou mais. Efeitos menores, que são os mais comuns em testes de conversão, podem passar despercebidos. Se mesmo assim der significativo, o lift observado tende a ser maior que o real.`,
        action:
          "Se você espera um efeito menor, aumente a amostra. Rode por mais tempo, coloque mais tráfego no teste ou reduza o número de variantes.",
      };
    case "bonferroni_off":
      return {
        title,
        explanation: `O teste tem ${fmt.int(f.groups)} grupos e faz ${fmt.int(f.groups - 1)} comparações com o controle, sem a correção de Bonferroni. Cada comparação usa o alfa cheio. A chance de pelo menos um falso positivo no teste todo pode chegar perto de ${fmt.int(f.groups - 1)} vezes esse alfa.`,
        action:
          "Ligue a correção de Bonferroni. Se preferir deixar desligada, trate as vencedoras com p-value perto do limite como hipóteses a confirmar num novo teste.",
      };
    case "methods_disagree":
      return {
        title,
        explanation: `Para a variante ${f.variant}, o Z test e o Bayesiano chegam a vereditos diferentes. Isso acontece perto do limiar de decisão. Os dois métodos respondem perguntas diferentes, e o Bayesiano não usa Bonferroni nem a escolha entre uni e bicaudal. Nenhum dos dois está errado. A evidência está no limite.`,
        action:
          "Não trate o resultado como decidido. Olhe o intervalo do lift e o risco esperado. Se a decisão for importante, colete a amostra planejada antes de decidir.",
      };
    case "seq_not_crossed":
      return {
        title,
        explanation: `Na espiada ${fmt.int(f.look)}, o z observado da variante ${f.variant} não cruzou a fronteira de O'Brien-Fleming. Nas primeiras espiadas a fronteira é bem mais exigente que o z crítico normal, para compensar as várias olhadas. Não cruzar não quer dizer que a variante não funciona.`,
        action:
          "Continue o teste até a próxima espiada planejada. Não pare agora com base no p-value comum, que não leva em conta as espiadas.",
      };
    default: {
      const unreachable: never = f;
      return unreachable;
    }
  }
}

const ruleTitle: ContentPack["ruleTitle"] = {
  srm: "Possível Sample Ratio Mismatch",
  stopped_early: "Possível peeking",
  low_data: "Poucas conversões de diferença",
  under_7_days: "Menos de uma semana de teste",
  over_8_weeks: "Teste com mais de 8 semanas",
  underpowered: "Amostra insuficiente para o lift alvo",
  bonferroni_off: "Bonferroni desligado com múltiplas variantes",
  incomplete_weeks: "Semanas incompletas",
  mde_high: "MDE alto",
  methods_disagree: "Os métodos discordam",
  seq_not_crossed: "Fronteira não cruzada",
};

function liftSentence(h: HeadlineInput, fmt: Fmt): string {
  const { variantName: v, controlName: c, lift } = h;
  if (lift === null) return `Não dá para calcular o lift relativo de ${v}, porque o grupo ${c} não teve conversões.`;
  if (lift === 0) return `${v} e o grupo ${c} converteram na mesma taxa.`;
  const size = fmt.pct(Math.abs(lift), 1);
  return lift > 0 ? `${v} converteu ${size} a mais que o grupo ${c}.` : `${v} converteu ${size} a menos que o grupo ${c}.`;
}

const ENOUGH_SAMPLE =
  "A amostra já bastava para detectar o lift alvo, então um efeito desse tamanho provavelmente teria aparecido.";
const NOT_ENOUGH_SAMPLE = "A amostra ainda é pequena para detectar o lift alvo, então ainda não dá para saber.";

function bayesSentence(h: HeadlineInput, p: number, fmt: Fmt): string {
  switch (h.verdict) {
    case "winner":
      return `A chance de essa variante ser realmente melhor é de ${chance(p, fmt)}.`;
    case "loser":
      return `A chance de essa variante ser pior é de ${chance(1 - p, fmt)}.`;
    case "no-difference":
      return `A chance de essa variante ser melhor é de ${chance(p, fmt)}, sem chegar a um veredito. ${ENOUGH_SAMPLE}`;
    case "underpowered":
      return `A chance de essa variante ser melhor é de ${chance(p, fmt)}, sem chegar a um veredito. ${NOT_ENOUGH_SAMPLE}`;
  }
}

function zSentence(h: HeadlineInput, p: number, fmt: Fmt): string {
  const pv = pValuePhrase(p, fmt);
  switch (h.verdict) {
    case "winner":
      return `Com p-value ${pv}, a diferença é estatisticamente significativa.`;
    case "loser":
      return `Com p-value ${pv}, a queda é estatisticamente significativa.`;
    case "no-difference":
      return `Com p-value ${pv}, a diferença não é estatisticamente significativa. ${ENOUGH_SAMPLE}`;
    case "underpowered":
      return `Com p-value ${pv}, a diferença não é estatisticamente significativa. ${NOT_ENOUGH_SAMPLE}`;
  }
}

function headline(h: HeadlineInput, fmt: Fmt): string {
  const lead = liftSentence(h, fmt);
  if (h.method === "bayesian" && h.probabilityToBeat !== null) return `${lead} ${bayesSentence(h, h.probabilityToBeat, fmt)}`;
  if (h.method === "ztest" && h.pValue !== null) return `${lead} ${zSentence(h, h.pValue, fmt)}`;
  return lead;
}

const QUANDO_ENGANA = "Quando engana.";

const SAMPLE_FORMULA =
  "`n = (zα × √(2 × p̄ × (1 − p̄)) + zβ × √(p1 × (1 − p1) + p2 × (1 − p2)))² / (p2 − p1)²`";

const explanations: ContentPack["explanations"] = {
  bayes: {
    title: "Método Bayesiano",
    layer1: (ctx: ExplanationContext | null) => {
      const intro =
        "Pense na previsão do tempo. Ela não promete sol. Ela diz que a chance de chuva é de 20%. O método Bayesiano faz o mesmo com o seu teste. Ele começa sem preferência por nenhuma taxa de conversão e ajusta essa crença a cada usuário que chega. No fim, responde direto à pergunta que você tem.";
      const p = ctx?.probabilityToBeat;
      return p
        ? `${intro} No seu teste, a variante tem ${p} de chance de ser melhor que o controle. Quer dizer que, com os dados coletados até agora, ela converte mais que o controle em ${p} dos cenários plausíveis.`
        : `${intro} Se a variante tem 97% de chance de ser melhor, quer dizer que, com os dados coletados, ela converte mais que o controle em 97 de cada 100 cenários plausíveis.`;
    },
    layer2: paragraphs(
      "Cada grupo começa com a prior `Beta(1, 1)`, que dá o mesmo peso a qualquer taxa de conversão entre 0% e 100%. Os dados atualizam essa crença e geram a posterior `Beta(1 + conversões, 1 + usuários − conversões)`. A prior equivale a uma conversão e uma não conversão a mais, então pesa pouco assim que cada grupo tem algumas dezenas de conversões.",
      "A calculadora sorteia 50.000 valores da posterior de cada grupo, com uma semente derivada dos números do teste. Os mesmos números sempre dão o mesmo resultado. A probabilidade de vencer é a fração dos sorteios em que a variante supera o controle, `P(vencer) = P(CRv > CRc)`. Com 3 ou mais grupos, a probabilidade de ser a melhor é a fração dos sorteios em que o grupo tem a maior taxa entre todos.",
      "O risco esperado é `E[max(CRc − CRv, 0)]`. É a perda média de conversão ao implementar a variante, contando como zero os cenários em que ela é melhor. Aparece em pontos percentuais e relativo à taxa do controle.",
      "O intervalo de credibilidade do lift vai do quantil `(1 − confiança) / 2` ao quantil `1 − (1 − confiança) / 2` de `(CRv − CRc) / CRc`. Segundo o modelo, o lift real está dentro dele com probabilidade igual à confiança. Essa leitura vale para o intervalo Bayesiano. Ela não vale para o intervalo de confiança do Z test.",
      "A variante é vencedora quando `P(vencer) ≥ confiança` e perdedora quando `P(vencer) ≤ 1 − confiança`. Não existe p-value nem teste de significância. A resposta já é uma probabilidade sobre a pergunta de negócio, e o limiar de 95% é a regra de decisão que você escolheu. Por isso o Bayesiano ignora a escolha entre uni e bicaudal e a correção de Bonferroni.",
      `${QUANDO_ENGANA} A probabilidade só vale se o modelo vale. Ele supõe que cada usuário converte de forma independente, com uma taxa fixa durante o teste, e que o sorteio dos grupos funcionou. SRM, efeito novidade e sazonalidade quebram essas premissas. Espiar todo dia e parar quando P(vencer) passa de 95% também aumenta a chance de declarar vencedora uma variante que não é melhor. A posterior continua descrevendo os dados, mas essa regra de parada perde o controle de erro, e a prior plana não protege contra isso. Com amostras pequenas, P(vencer) oscila muito de um dia para o outro, então olhe também o intervalo e o risco esperado. Com várias variantes, a chance de alguma passar do limiar por acaso cresce, mesmo sem Bonferroni na conta.`,
    ),
  },

  ztest: {
    title: "Z test",
    layer1: (ctx) => {
      const intro =
        "Imagine uma moeda que pode estar viciada. Você parte do princípio de que ela é honesta e joga 100 vezes. Se sair 70 caras, uma moeda honesta quase nunca faria isso, e a sua desconfiança ganha força. O Z test faz o mesmo com o seu teste. Ele supõe que variante e controle convertem igual e mede quão raro seria ver uma diferença pelo menos do tamanho da observada. Essa medida é o p-value.";
      const p = ctx?.pValue;
      return p
        ? `${intro} No seu teste, o p-value é ${p}. Se variante e controle convertessem igual, uma diferença pelo menos tão extrema quanto a observada apareceria com probabilidade ${p}.`
        : `${intro} Quanto menor o p-value, mais difícil explicar a diferença só pelo acaso.`;
    },
    layer2: paragraphs(
      "A hipótese nula `H0` diz que a taxa real da variante é igual à do controle. O teste mede a distância entre os dados e essa hipótese, em erros padrão.",
      "Para cada grupo, `CR = conversões / usuários` e `SE = √(CR × (1 − CR) / usuários)`. O erro padrão da diferença é `SEdiff = √(SEc² + SEv²)`, sem agrupar os grupos, como no ABTestGuide. O Z-score é `z = (CRv − CRc) / SEdiff`.",
      "O p-value bicaudal é `2 × (1 − Φ(|z|))` e o unicaudal é `1 − Φ(z)`, onde `Φ` é a distribuição normal acumulada. O resultado é significativo quando `p-value < α'`. O alfa é `α' = 1 − confiança`, dividido por `grupos − 1` quando a correção de Bonferroni está ligada.",
      "O intervalo de confiança da diferença é `(CRv − CRc) ± z(1 − α'/2) × SEdiff`. No unicaudal, a calculadora mostra só o limite inferior. O intervalo do lift relativo divide esses limites por `CRc`, uma aproximação que ignora a incerteza da taxa do controle. Um intervalo de 95% não quer dizer 95% de chance de o valor real estar dentro dele. Quer dizer que, repetindo o teste muitas vezes, 95% dos intervalos calculados desse jeito conteriam o valor real.",
      "O teste usa a aproximação normal, que só funciona com amostra grande. Uma regra prática é ter pelo menos 10 conversões e 10 não conversões em cada grupo. Com 0% ou 100% de conversão, o erro padrão do grupo vira zero e o teste subestima a incerteza.",
      `${QUANDO_ENGANA} O p-value só vale se a amostra foi decidida antes e o teste foi analisado uma vez. Espiar e parar ao ver significância infla os falsos positivos. Para acompanhar o teste, use o modo sequencial. Testar várias variantes ou várias métricas também multiplica as chances de um falso positivo. Um resultado significativo não diz que o efeito é grande. Com muito tráfego, diferenças pequenas demais para importar ficam significativas. Um resultado não significativo também não prova que as taxas são iguais. Ele só mostra que os dados não bastam para descartar a igualdade.`,
    ),
  },

  "bayes-vs-z": {
    title: "Bayesiano ou Z test?",
    layer1: (ctx) => {
      const intro =
        "Os dois métodos olham os mesmos dados e fazem perguntas diferentes. O Z test age como um tribunal. Ele presume que a variante não muda nada e só abandona essa presunção diante de prova forte. O Bayesiano age como quem calcula as chances de uma aposta. Ele diz qual a chance de a variante ser melhor. Longe do limiar de decisão, os dois quase sempre concordam. Perto dele, um pode dizer \"vencedora\" e o outro \"inconclusiva\".";
      const pv = ctx?.pValue;
      const pb = ctx?.probabilityToBeat;
      return pv && pb
        ? `${intro} No seu teste, o Z test dá p-value de ${pv} e o Bayesiano dá ${pb} de chance de a variante ser melhor.`
        : intro;
    },
    layer2: paragraphs(
      "Use o Bayesiano quando a pergunta é qual versão implementar. Ele dá a probabilidade de a variante ser melhor e o risco esperado de errar, dois números fáceis de levar para uma decisão de negócio. É o método padrão da calculadora.",
      "Use o Z test quando você precisa controlar a taxa de falsos positivos de forma explícita, quando planejou a amostra com confiança e poder, ou quando vai acompanhar o teste enquanto ele roda. O teste sequencial com fronteiras de O'Brien-Fleming só existe no Z test. Ele também reproduz os números de ferramentas como o ABTestGuide.",
      "Por que discordam. Com a prior `Beta(1, 1)` e amostras grandes, `P(vencer)` fica perto de `1 − p-value unicaudal`, que é `Φ(z)`. Com 95% de confiança, o Bayesiano declara vencedora quando `Φ(z) ≥ 0,95`, ou seja, quando `z ≥ 1,645`. O Z test bicaudal exige `|z| ≥ 1,96`. Entre esses dois valores, o Bayesiano vê uma vencedora e o Z test não vê diferença significativa. Por exemplo, `z = 1,75` dá `P(vencer)` perto de 96% e p-value bicaudal perto de 0,08.",
      "A correção de Bonferroni aumenta essa distância. Com 3 ou mais grupos, o Z test fica mais exigente e o Bayesiano mantém o limiar. A discordância não é erro de cálculo. Ela mostra que a evidência está perto do limite e que a decisão depende da regra escolhida.",
    ),
  },

  "p-value": {
    title: "p-value",
    layer1: (ctx) => {
      const intro =
        "Imagine que você joga uma moeda 10 vezes e sai cara em todas. Com uma moeda honesta, isso acontece cerca de 1 vez em 1.000. O p-value é esse tipo de número. Ele parte do princípio de que variante e controle convertem igual e diz quão raro seria ver uma diferença pelo menos tão grande quanto a do seu teste.";
      const p = ctx?.pValue;
      return p
        ? `${intro} No seu teste, o p-value é ${p}. Se variante e controle convertessem igual, uma diferença pelo menos tão extrema apareceria com probabilidade ${p}. Isso não quer dizer que há ${p} de chance de o resultado ser acaso, nem que a variante tem o restante de chance de ser melhor.`
        : `${intro} Ele não diz qual a chance de a variante ser melhor.`;
    },
    layer2: paragraphs(
      "O p-value é `P(diferença pelo menos tão extrema quanto a observada | H0)`, onde `H0` diz que as taxas reais são iguais. No bicaudal, `p = 2 × (1 − Φ(|z|))`. No unicaudal, `p = 1 − Φ(z)`.",
      "O que ele não é. Não é a probabilidade de `H0` ser verdadeira. Não é a probabilidade de o resultado ser acaso. E `1 − p` não é a probabilidade de a variante ser melhor. Para essa pergunta, use o método Bayesiano. O p-value também não mede o tamanho do efeito. Para isso, olhe o lift e o intervalo de confiança.",
      "Quando não há diferença real, o p-value se distribui de forma uniforme entre 0 e 1. Com alfa de 5%, 1 em cada 20 testes sem efeito nenhum dá significativo por acaso. Um p-value acima do limite não prova que as taxas são iguais. E 0,049 e 0,051 são, na prática, a mesma evidência.",
      `${QUANDO_ENGANA} O p-value supõe uma amostra decidida antes, uma única análise e dados íntegros. Espiar e parar no primeiro p-value baixo, olhar muitas métricas ou ter SRM fazem p-values baixos aparecerem por acaso com muito mais frequência do que o limite promete.`,
    ),
  },

  "confidence-power": {
    title: "Confiança e poder",
    layer1: (ctx) => {
      const intro =
        "Um alarme de incêndio pode errar de dois jeitos. Ele pode tocar sem fogo ou ficar quieto com fogo. A confiança controla o primeiro erro e o poder controla o segundo. Deixar o alarme mais exigente reduz os alarmes falsos, mas aumenta o risco de não perceber um fogo pequeno. Para reduzir os dois ao mesmo tempo, o teste precisa de mais dados.";
      const c = ctx?.confidence;
      const pw = ctx?.power;
      if (!c || !pw) {
        return `${intro} Com 95% de confiança e 80% de poder, uma variante que não muda nada é apontada como diferente em 5% das vezes. Uma variante com o lift alvo é detectada em 80% das vezes, se o teste rodar com a amostra planejada.`;
      }
      const alpha = ctx.alpha
        ? ` Se a variante não muda nada, a chance de o teste apontar diferença por engano é de ${ctx.alpha}.`
        : "";
      return `${intro} No seu teste, a confiança é ${c} e o poder é ${pw}.${alpha} Se a variante tem o lift alvo, a chance de o teste detectar é de ${pw}, desde que ele rode com a amostra planejada.`;
    },
    layer2: paragraphs(
      "O erro tipo I é declarar diferença quando ela não existe, o falso positivo. A chance dele é o alfa, `α = 1 − confiança`. Com Bonferroni ligado e 3 ou mais grupos, cada comparação usa `α' = (1 − confiança) / (grupos − 1)`.",
      "O erro tipo II é não detectar uma diferença que existe, o falso negativo. A chance dele é `β = 1 − poder`. O poder sempre se refere a um tamanho de efeito. Poder de 80% quer dizer 80% de chance de detectar a diferença se o lift real for igual ao lift alvo. Para lifts reais menores, o poder é menor.",
      `Os dois erros disputam a mesma amostra, que sai da fórmula ${SAMPLE_FORMULA}. Nela, \`p1\` é a taxa base, \`p2 = p1 × (1 + lift)\`, \`p̄ = (p1 + p2) / 2\`, \`zβ = z(poder)\` e \`zα = z(1 − α'/2)\` no bicaudal ou \`z(1 − α')\` no unicaudal. Com a amostra fixa, subir a confiança derruba o poder. Para manter os dois, a amostra cresce. Com 80% de poder, subir de 95% para 99% de confiança pede cerca de 50% mais usuários. Com 95% de confiança, subir o poder de 80% para 90% pede cerca de 34% mais.`,
      'No Bayesiano, a confiança é o limiar de `P(vencer)` para declarar vencedora. Lá não existe poder, mas o veredito "sem poder" usa a mesma regra de amostra do Z test.',
      `${QUANDO_ENGANA} Confiança de 95% não quer dizer 95% de chance de o resultado estar certo. Se poucas das ideias testadas funcionam de verdade, bem mais que 5% das vencedoras declaradas podem ser falsas. O poder também não é a chance de o resultado estar certo. Ele é uma propriedade do plano, calculada antes do teste. O poder observado, \`Φ(|z| − z crítico)\`, é só outra forma de escrever o p-value. Ele fica perto de 50% quando o p-value está no limite e não diz se a amostra era suficiente. Para isso, compare o MDE atingido com o lift alvo.`,
    ),
  },

  "mde-sample": {
    title: "MDE e tamanho de amostra",
    layer1: (ctx) => {
      const intro =
        "Numa sala barulhenta, você só ouve um sussurro se chegar perto. Um grito você ouve de longe. O MDE, ou efeito mínimo detectável, é o menor efeito que o teste consegue ouvir com a amostra que tem. Com pouco tráfego, o teste só ouve gritos.";
      const mde = ctx?.mde;
      if (!mde) {
        return `${intro} Por exemplo, um MDE de 8,4% com poder de 80% quer dizer que, se a variante melhorar a conversão em 8,4% ou mais, o teste tem pelo menos 80% de chance de detectar. Melhoras menores podem passar despercebidas.`;
      }
      const odds = ctx.power ? `pelo menos ${ctx.power}` : "pelo menos o poder escolhido";
      return `${intro} No seu teste, o MDE é ${mde}. Se a variante melhorar a conversão em ${mde} ou mais, a chance de o teste detectar é de ${odds}. Melhoras menores podem passar despercebidas.`;
    },
    layer2: paragraphs(
      "A taxa base é `p = conversões semanais / tráfego semanal`. Na semana `w`, cada grupo tem `n(w) = tráfego semanal × % no teste × w / grupos` visitantes.",
      `A amostra por variante para um lift alvo é ${SAMPLE_FORMULA}, com \`p1 = p\`, \`p2 = p × (1 + lift)\` e \`p̄ = (p1 + p2) / 2\`. O MDE da semana \`w\` é o lift que, nessa fórmula, exige exatamente \`n(w)\` visitantes. A calculadora acha esse lift por bisseção, então os dois modos do pré-teste são inversos exatos um do outro. O MDE absoluto é \`p × MDE relativo\`, em pontos percentuais.`,
      "Por que tráfego baixo só detecta efeitos grandes. A amostra cresce com o inverso do quadrado da diferença, `1 / (p2 − p1)²`. Detectar metade do efeito exige cerca de 4 vezes mais usuários. No sentido contrário, o MDE cai com a raiz quadrada da amostra, e rodar 4 vezes mais tempo só corta o MDE pela metade. Taxa base baixa piora a conta, porque a mesma melhora relativa vira uma diferença absoluta menor.",
      "A duração é `dias = ⌈ n × grupos / (tráfego semanal / 7 × % no teste) ⌉`. Cada variante a mais aumenta a amostra total, e a correção de Bonferroni aumenta a amostra de cada grupo. Com espiadas planejadas, `n` é multiplicado pelo fator de inflação do desenho sequencial. Arredonde a duração para semanas cheias.",
      `${QUANDO_ENGANA} O MDE não é o efeito esperado. Escolher um lift alvo otimista encurta o plano, mas deixa o teste cego para os efeitos realistas. Na prática, poucos testes de CRO mostram lifts reais acima de 10%. Quando um teste com MDE alto dá significativo, o lift observado tende a exagerar o efeito real. O cálculo também supõe que a taxa base e o tráfego se mantêm durante o teste.`,
    ),
  },

  hypothesis: {
    title: "Bicaudal ou unicaudal",
    layer1: (ctx) => {
      const intro =
        "Um teste bicaudal é como um vigia que olha as duas portas da casa. O unicaudal olha só a porta da frente. Ele percebe mais cedo quem entra por ela, mas não vê quem entra pelos fundos. No teste A/B, a porta da frente é a variante melhorar a conversão. A dos fundos é ela piorar. O unicaudal nunca declara uma variante perdedora, por pior que ela seja.";
      const a = ctx?.alpha;
      return a
        ? `${intro} No seu teste, o alfa é ${a}. O bicaudal divide esse alfa entre as duas direções. O unicaudal põe todo ele na direção da melhora.`
        : intro;
    },
    layer2: paragraphs(
      "Bicaudal. A hipótese nula é `CRv = CRc` e a alternativa é `CRv ≠ CRc`. O z crítico é `z(1 − α'/2)`, que dá 1,96 com 95% de confiança, e o p-value é `2 × (1 − Φ(|z|))`. Detecta melhoras e pioras.",
      "Unicaudal. A hipótese nula é `CRv ≤ CRc` e a alternativa é `CRv > CRc`. O z crítico é `z(1 − α')`, que dá 1,645 com 95% de confiança, e o p-value é `1 − Φ(z)`. Com a mesma amostra, o unicaudal detecta melhoras menores. Para o mesmo MDE, precisa de cerca de 20% menos usuários.",
      "O unicaudal não detecta pioras. Se a variante converte menos, o z fica negativo e o p-value fica perto de 1. O veredito vira inconclusiva, nunca perdedora. Pelo mesmo motivo, o intervalo de confiança unicaudal só tem limite inferior.",
      `${QUANDO_ENGANA} A escolha precisa ser feita antes de ver os dados. Escolher a direção depois de ver o resultado dobra, na prática, a chance de falso positivo. Use o unicaudal só quando uma piora e um empate levam à mesma decisão, a de não implementar, e quando ninguém vai precisar saber se a variante piorou. O Bayesiano não usa essa escolha.`,
    ),
  },

  bonferroni: {
    title: "Correção de Bonferroni",
    layer1: (ctx) => {
      const intro =
        "Um bilhete de loteria dá pouca chance de ganhar. Quatro bilhetes dão quase quatro vezes mais chance. Com várias variantes acontece o mesmo, e cada comparação com o controle é um bilhete para um falso positivo. A correção de Bonferroni deixa cada comparação mais exigente, para que a chance de pelo menos um falso positivo no teste todo fique dentro do nível escolhido.";
      const g = ctx?.groups;
      const a = ctx?.alpha;
      if (g === 2) return `${intro} No seu teste há só uma comparação, e a correção não muda nada.`;
      if (g !== undefined && a) {
        return `${intro} No seu teste, com ${g} grupos, há ${g - 1} comparações com o controle, e cada uma usa alfa de ${a}.`;
      }
      return `${intro} Com 3 grupos e 95% de confiança, cada comparação passa a usar alfa de 2,5% em vez de 5%.`;
    },
    layer2: paragraphs(
      "Com `k = grupos − 1` comparações independentes, cada uma com alfa `α`, a chance de pelo menos um falso positivo é `1 − (1 − α)^k`. Com `α = 5%`, isso dá 9,75% com 2 comparações e 18,5% com 4. Aqui as comparações dividem o mesmo controle, então os números reais ficam um pouco abaixo desses, mas crescem do mesmo jeito.",
      "A correção usa `α' = (1 − confiança) / (grupos − 1)` em cada comparação. Com 95% de confiança, dá 2,5% com 3 grupos, 1,67% com 4 e 1,25% com 5. Pela desigualdade de Bonferroni, a chance de pelo menos um falso positivo fica em no máximo `1 − confiança`, qualquer que seja a relação entre as comparações.",
      "O preço é poder. Cada comparação fica mais exigente, então o pré-teste pede mais amostra por grupo. No teste sequencial, a correção vale para o alfa total, antes de ele ser distribuído entre as espiadas. O Bayesiano não aplica a correção, e o limiar de vencedora continua igual à confiança.",
      `${QUANDO_ENGANA} Bonferroni é conservadora. Com muitas variantes, ela pode esconder efeitos reais. Ela também só cobre as comparações com o controle nesta métrica. Olhar várias métricas ou segmentos multiplica as chances de falso positivo do mesmo jeito, e a correção não protege contra isso.`,
    ),
  },

  "expected-risk": {
    title: "Risco esperado",
    layer1: (ctx) => {
      const intro =
        "O preço justo de um seguro de carro junta duas coisas, a chance de batida e o custo do conserto quando ela acontece. O risco esperado faz essa conta para a variante. Ele mede quanto de conversão você perde, em média, se implementar a variante, contando como zero os casos em que ela é melhor.";
      const loss = ctx?.expectedLoss;
      return loss
        ? `${intro} No seu teste, implementar a variante custa em média ${loss} na taxa de conversão, já contando como zero os cenários em que ela é melhor.`
        : `${intro} Um risco de 0,02 p.p. quer dizer que, já contando a chance de erro, a perda média esperada é de 0,02 ponto percentual na taxa de conversão.`;
    },
    layer2: paragraphs(
      "O risco esperado é `E[max(CRc − CRv, 0)]`. A calculadora tira a média de `max(CRc − CRv, 0)` nos 50.000 sorteios das posteriores. Nos sorteios em que a variante é melhor, a perda é zero. Nos outros, é o quanto ela converte a menos. O resultado aparece em pontos percentuais e relativo à `CRc`. Menor é melhor.",
      "O risco junta a chance de errar e o tamanho do erro. Ele é igual a `P(variante pior) × perda média quando ela é pior`. Por isso completa o `P(vencer)`. Duas variantes com 90% de chance de vencer podem ter riscos bem diferentes, se uma delas pode perder muito nos 10% restantes.",
      "Uma regra de decisão comum é implementar quando o risco fica abaixo de uma perda que você aceita, como 0,01 p.p. ou 1% relativo. Esse limite é uma escolha de negócio, não uma regra estatística.",
      `${QUANDO_ENGANA} O risco mede só a taxa de conversão. Ele não mede receita, ticket médio nem outras métricas. Ele também depende do modelo. Com SRM, efeito novidade ou amostra muito pequena, o número pode parecer pequeno e estar errado. Valores muito perto de zero têm ruído da simulação nas últimas casas.`,
    ),
  },

  srm: {
    title: "Sample Ratio Mismatch (SRM)",
    layer1: (ctx) => {
      const intro =
        "Se você joga uma moeda 1.000 vezes e sai cara 600, alguma coisa está errada com a moeda. No teste A/B, a moeda é o sorteio que manda cada usuário para um grupo. Se a divisão real fica longe da planejada, o sorteio ou a medição tem um problema. Quem sobrou num grupo ou faltou no outro costuma ser diferente do resto, e o resultado pode ficar enviesado.";
      const g = ctx?.groups;
      return g !== undefined
        ? `${intro} No seu teste, a calculadora compara os usuários de cada um dos ${g} grupos com o split que você informou.`
        : intro;
    },
    layer2: paragraphs(
      "A calculadora usa o teste qui-quadrado de aderência, `χ² = Σ (observado − esperado)² / esperado`, com `esperado = total de usuários × split pretendido` e `grupos − 1` graus de liberdade. O alerta dispara com `p < 0,01`. O limite é mais rígido que o usual porque a checagem roda em todo teste, e com 0,05 ela daria alarme falso em 1 de cada 20 testes saudáveis.",
      "Causas comuns. Bots e filtros de tráfego podem atingir um grupo mais que o outro. Um redirect na variante perde os usuários que saem antes de a página carregar. Cache ou CDN podem servir a versão errada. O bucketing pode ter erro, como usuários que trocam de grupo ou um hash mal distribuído. A tag de medição pode disparar só numa das versões. O split pode ter mudado no meio do teste.",
      "O que fazer. Não corrija os números na mão nem descarte os usuários que sobraram. Ache a causa, corrija e rode o teste de novo. Um split informado errado na calculadora também dispara o alerta, então confira primeiro se ele bate com o configurado na ferramenta.",
      `${QUANDO_ENGANA} Com milhões de usuários, desvios pequenos, como 50,2% contra 49,8%, já disparam o alerta. Ainda vale investigar, mas a causa pode ser pequena. Com poucos usuários, a checagem tem pouco poder, e a ausência do alerta não prova que o sorteio funcionou.`,
    ),
  },

  "peeking-sequential": {
    title: "Peeking e teste sequencial",
    layer1: (ctx) => {
      const intro =
        "Imagine que você pudesse apitar o fim de uma partida no instante em que o seu time passa à frente. Você ganharia jogos que perderia no tempo normal. Espiar o teste todo dia e parar no primeiro resultado significativo funciona do mesmo jeito. Cada espiada é mais uma chance de o acaso parecer um efeito real. O teste sequencial combina antes quantas vezes você vai olhar e exige uma vantagem bem maior para encerrar cedo.";
      const look = ctx?.look;
      const planned = ctx?.plannedLooks;
      return look !== undefined && planned !== undefined
        ? `${intro} No seu teste, esta é a espiada ${look} de ${planned}. Se o z observado cruzar a fronteira desta espiada, você pode parar. Se não cruzar, continue até a próxima.`
        : intro;
    },
    layer2: paragraphs(
      "Por que espiar infla o falso positivo. Quando não há efeito, cada análise tem chance igual ao alfa de dar significativo por acaso. Olhar várias vezes e parar na primeira significância acumula essas chances. Com 95% bicaudal e o limite normal em cada olhada, a chance total de falso positivo sobe para cerca de 8% com 2 espiadas, 14% com 5 e 19% com 10. Com espiadas sem fim, ela tende a 100%.",
      "Como as fronteiras resolvem. O teste sequencial gasta o alfa aos poucos, com a função de gasto de Lan-DeMets tipo O'Brien-Fleming. No unicaudal, `α(t) = 2 − 2 × Φ(z(1 − α/2) / √t)`. No bicaudal, cada lado gasta metade do alfa com a mesma função, `α_lado(t) = 2 − 2 × Φ(z(1 − α/4) / √t)`, a convenção do gsDesign e do ldbounds. Aqui `t` é a fração de informação, `n atual / n máximo do plano`. As fronteiras saem dessa função por integração numérica recursiva, o método de Armitage, McPherson e Rowe. Até a última espiada, o alfa gasto soma exatamente o alfa escolhido. No unicaudal, a mesma ideia vale para uma fronteira só, a de melhora. Com Bonferroni ligado, a correção vem antes da divisão entre as espiadas.",
      "As primeiras fronteiras são muito exigentes, e a última fica perto do z crítico normal. Com 4 espiadas igualmente espaçadas e 95% bicaudal, as fronteiras ficam perto de `z = 4,33`, `2,96`, `2,36` e `2,01`. Em troca, a amostra máxima cresce pouco. Com 5 espiadas e 80% de poder, ela fica cerca de 2,5% acima da amostra do teste fixo.",
      "A calculadora usa a amostra real de cada espiada para calcular `t`, não a planejada. Assim o alfa continua certo se a espiada atrasar ou adiantar. O teste sequencial só funciona com o Z test. Não cruzar a fronteira quer dizer continuar, não que a variante não funciona. Esta calculadora não tem fronteira de futilidade, a que permitiria parar por falta de chance de vencer.",
      `${QUANDO_ENGANA} As fronteiras só protegem se o número de espiadas foi combinado antes e se você só decide nelas. Parar numa olhada fora do plano volta a inflar o erro. Um teste que para cedo por cruzar a fronteira tende a exagerar o lift. O Bayesiano também não fica imune. A probabilidade continua descrevendo os dados, mas parar no primeiro dia em que ela passa de 95% aumenta a chance de declarar vencedora uma variante que não é melhor.`,
    ),
  },
};

export const content: ContentPack = {
  locale: "pt",
  explanations,
  finding,
  ruleTitle,
  headline,
  verdictLabel: {
    winner: "Vencedora",
    loser: "Perdedora",
    "no-difference": "Inconclusiva, sem diferença relevante",
    underpowered: "Inconclusiva, sem poder",
  },
};
