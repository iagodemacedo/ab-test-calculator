import type { Locale } from "../stats/types";
export const formulas = [
  {
    pt: "Taxa de conversão",
    en: "Conversion rate",
    formula: "CR = conversões / usuários",
    formulaEn: "CR = conversions / users",
  },
  {
    pt: "Lift relativo e absoluto",
    en: "Relative and absolute lift",
    formula: "lift = (CRv − CRc) / CRc; Δ = CRv − CRc",
  },
  {
    pt: "Alfa efetivo",
    en: "Effective alpha",
    formula: "α′ = (1 − confiança) / (grupos − 1)",
    formulaEn: "α′ = (1 − confidence) / (groups − 1)",
    ptNote:
      "Com Bonferroni e 3+ grupos. Sem correção, α′ = 1 − confiança. O Bayesiano ignora Bonferroni e hipótese.",
    enNote:
      "With Bonferroni and 3+ groups. Without correction, α′ = 1 − confidence. Bayesian analysis ignores Bonferroni and hypothesis.",
  },
  {
    pt: "Valores críticos e poder",
    en: "Critical values and power",
    formula:
      "zα = Φ⁻¹(1 − α′/2) [bicaudal]; zα = Φ⁻¹(1 − α′) [unicaudal]; zβ = Φ⁻¹(poder)",
    formulaEn:
      "zα = Φ⁻¹(1 − α′/2) [two-sided]; zα = Φ⁻¹(1 − α′) [one-sided]; zβ = Φ⁻¹(power)",
  },
  {
    pt: "Amostra por variante",
    en: "Sample per variant",
    formula:
      "n = (zα√(2p̄(1−p̄)) + zβ√(p₁(1−p₁)+p₂(1−p₂)))² / (p₂−p₁)²; p₂ = p₁(1+lift); p̄ = (p₁+p₂)/2",
  },
  {
    pt: "Tráfego, MDE e duração",
    en: "Traffic, MDE and duration",
    formula:
      "p = conversões semanais / tráfego semanal; n(w) = tráfego semanal × fração no teste × w / grupos; dias = ceil(n × grupos / (tráfego semanal / 7 × fração no teste))",
    formulaEn:
      "p = weekly conversions / weekly traffic; n(w) = weekly traffic × traffic share × w / groups; days = ceil(n × groups / (weekly traffic / 7 × traffic share))",
    ptNote:
      "O MDE é o lift que exige n(w) visitantes, resolvido por bisseção na fórmula de amostra. MDE absoluto = p × MDE relativo. Conversões zero impedem planejar. p₂ não pode exceder 1.",
    enNote:
      "MDE is the lift requiring n(w) visitors, solved by bisection in the sample formula. Absolute MDE = p × relative MDE. Zero conversions prevent planning. p₂ cannot exceed 1.",
  },
  {
    pt: "Erro padrão não agrupado",
    en: "Unpooled standard error",
    formula: "SE = √(CR(1−CR)/n); SEdiff = √(SEc²+SEv²)",
  },
  {
    pt: "Z test",
    en: "Z test",
    formula:
      "z = (CRv−CRc)/SEdiff; p₂ = 2(1−Φ(|z|)); p₁ = 1−Φ(z); significativo se p < α′",
    formulaEn:
      "z = (CRv−CRc)/SEdiff; p₂ = 2(1−Φ(|z|)); p₁ = 1−Φ(z); significant if p < α′",
  },
  {
    pt: "Intervalo de confiança e poder observado",
    en: "Confidence interval and observed power",
    formula:
      "ICΔ = Δ ± Φ⁻¹(1−α′/2)SEdiff; IClift ≈ ICΔ/CRc; poder observado = Φ(|z|−zα)",
    formulaEn:
      "CIΔ = Δ ± Φ⁻¹(1−α′/2)SEdiff; CIlift ≈ CIΔ/CRc; observed power = Φ(|z|−zα)",
    ptNote:
      "Unicaudal mostra só limite inferior, Δ − zα SEdiff. O IC relativo é aproximado. Poder observado não substitui planejamento.",
    enNote:
      "One-sided analysis shows only the lower bound, Δ − zα SEdiff. Relative CI is approximate. Observed power does not replace planning.",
  },
  {
    pt: "Modelo Bayesiano",
    en: "Bayesian model",
    formula:
      "prior = Beta(1,1); posterior = Beta(1+conversões,1+usuários−conversões)",
    formulaEn:
      "prior = Beta(1,1); posterior = Beta(1+conversions,1+users−conversions)",
    ptNote:
      "50.000 amostras Monte Carlo por grupo. Semente derivada de usuários e conversões, com resultados reprodutíveis.",
    enNote:
      "50,000 Monte Carlo draws per group. Seed derived from users and conversions, giving reproducible results.",
  },
  {
    pt: "Probabilidades, risco e credibilidade",
    en: "Probabilities, loss and credibility",
    formula:
      "P(vencer) = P(CRv>CRc); P(melhor) = P(CRg = max CR); risco = E[max(CRc−CRv,0)]; risco relativo = risco/CRc; intervalo = quantis [(1−conf)/2,1−(1−conf)/2] do lift",
    formulaEn:
      "P(beat) = P(CRv>CRc); P(best) = P(CRg = max CR); loss = E[max(CRc−CRv,0)]; relative loss = loss/CRc; interval = lift quantiles [(1−conf)/2,1−(1−conf)/2]",
  },
  {
    pt: "Teste sequencial",
    en: "Sequential testing",
    formula: "g(α,t) = 2−2Φ(Φ⁻¹(1−α/2)/√t); t = n atual / n máximo",
    formulaEn: "g(α,t) = 2−2Φ(Φ⁻¹(1−α/2)/√t); t = current n / maximum n",
    ptNote:
      "Lan-DeMets tipo O'Brien-Fleming. Unicaudal g(α,t). Bicaudal, cada lado g(α/2,t), convenção gsDesign/ldbounds. Fronteiras por integração recursiva de Armitage-McPherson-Rowe. Bonferroni vem antes do gasto. A amostra fixa cresce pelo fator de inflação do desenho. Sem plano, frações igualmente espaçadas. Amostra máxima atingida implica análise final. Sem fronteira de futilidade.",
    enNote:
      "Lan-DeMets O'Brien-Fleming type. One-sided g(α,t). Two-sided, each side g(α/2,t), using the gsDesign/ldbounds convention. Boundaries use Armitage-McPherson-Rowe recursive integration. Bonferroni precedes spending. Fixed sample grows by the design inflation factor. Without a plan, information fractions are equally spaced. Reaching maximum sample implies final analysis. No futility boundary.",
  },
  {
    pt: "Veredito",
    en: "Verdict",
    formula:
      "Bayesiano: vencedora P≥conf; perdedora P≤1−conf. Z test: significativo e Δ>0 vence; significativo e Δ<0 perde só no bicaudal.",
    formulaEn:
      "Bayesian: winner P≥conf; loser P≤1−conf. Z test: significant and Δ>0 wins; significant and Δ<0 loses only two-sided.",
    ptNote:
      "Sem resultado conclusivo, MDE atingido ≤ lift de referência implica sem diferença relevante. Acima disso, sem poder. No sequencial, significativo significa cruzar a fronteira.",
    enNote:
      "Without a conclusive result, achieved MDE ≤ reference lift means no meaningful difference. Above it means underpowered. In sequential mode, significant means crossing the boundary.",
  },
  {
    pt: "Dias adicionais",
    en: "Additional days",
    formula:
      "max(0,ceil((n necessário − min n grupos) × grupos / (total usuários / dias)))",
    formulaEn:
      "max(0,ceil((required n − min group n) × groups / (total users / days)))",
  },
  {
    pt: "SRM",
    en: "SRM",
    formula:
      "χ² = Σ(observado−esperado)²/esperado; esperado = total usuários × split; gl = grupos−1; alerta p<0,01",
    formulaEn:
      "χ² = Σ(observed−expected)²/expected; expected = total users × split; df = groups−1; alert p<0.01",
  },
  {
    pt: "Receita e projeção",
    en: "Revenue and forecast",
    formula:
      "visitantes mensais = (total usuários/dias) × 30/fração no teste; transações extras = visitantes mensais × Δ; contribuição mensal = extras × valor; impacto = contribuição × meses; previsão = visitantes mensais × CRg × valor × meses",
    formulaEn:
      "monthly visitors = (total users/days) × 30/traffic share; extra conversions = monthly visitors × Δ; monthly contribution = extras × value; impact = contribution × months; forecast = monthly visitors × CRg × value × months",
    ptNote:
      "Moeda só altera rótulo e formatação, sem câmbio. Taxa observada nos dois métodos. Valores inconclusivos são estimativas não confirmadas.",
    enNote:
      "Currency changes labels and formatting only, with no exchange conversion. Both methods use observed rates. Inconclusive values are unconfirmed estimates.",
  },
];
export const rules: Record<
  Locale,
  { id: string; condition: string; severity: string }[]
> = {
  pt: [
    { id: "srm", condition: "Qui-quadrado p < 0,01.", severity: "Crítico" },
    {
      id: "stopped_early",
      condition: "Há plano, amostra atual < planejada, sequencial desligado.",
      severity: "Crítico",
    },
    {
      id: "low_data",
      condition: "Significativo e |convV − convC × nV/nC| ≤ 20.",
      severity: "Atenção",
    },
    { id: "under_7_days", condition: "Duração < 7 dias.", severity: "Atenção" },
    {
      id: "over_8_weeks",
      condition: "Duração > 56 dias.",
      severity: "Atenção",
    },
    {
      id: "underpowered",
      condition: "Veredito inconclusivo e MDE > lift alvo de referência.",
      severity: "Atenção",
    },
    {
      id: "bonferroni_off",
      condition: "3+ grupos e Bonferroni desligado.",
      severity: "Atenção",
    },
    {
      id: "incomplete_weeks",
      condition:
        "Duração ≥ 7 dias e não múltipla de 7. Sugestão ceil(dias/7) × 7.",
      severity: "Info",
    },
    { id: "mde_high", condition: "MDE atingido > 10%.", severity: "Info" },
    {
      id: "methods_disagree",
      condition: "Vereditos Bayesiano e Z test diferem.",
      severity: "Info",
    },
    {
      id: "seq_not_crossed",
      condition:
        "Sequencial ligado, fronteira não cruzada e não é análise final.",
      severity: "Info",
    },
  ],
  en: [
    { id: "srm", condition: "Chi-square p < 0.01.", severity: "Critical" },
    {
      id: "stopped_early",
      condition:
        "Plan exists, current sample < planned sample, sequential off.",
      severity: "Critical",
    },
    {
      id: "low_data",
      condition: "Significant and |convV − convC × nV/nC| ≤ 20.",
      severity: "Warning",
    },
    {
      id: "under_7_days",
      condition: "Duration < 7 days.",
      severity: "Warning",
    },
    {
      id: "over_8_weeks",
      condition: "Duration > 56 days.",
      severity: "Warning",
    },
    {
      id: "underpowered",
      condition: "Inconclusive verdict and MDE > reference target lift.",
      severity: "Warning",
    },
    {
      id: "bonferroni_off",
      condition: "3+ groups and Bonferroni off.",
      severity: "Warning",
    },
    {
      id: "incomplete_weeks",
      condition:
        "Duration ≥ 7 days and not a multiple of 7. Suggest ceil(days/7) × 7.",
      severity: "Info",
    },
    { id: "mde_high", condition: "Achieved MDE > 10%.", severity: "Info" },
    {
      id: "methods_disagree",
      condition: "Bayesian and Z test verdicts differ.",
      severity: "Info",
    },
    {
      id: "seq_not_crossed",
      condition:
        "Sequential on, boundary not crossed and not the final analysis.",
      severity: "Info",
    },
  ],
};
