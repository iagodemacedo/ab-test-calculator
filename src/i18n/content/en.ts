// English teaching and finding texts (PRD sections 8, 11 and 12).
// Written by hand and checked against the PRD formulas. Numbers always go through `fmt`.
import type { Finding } from "../../stats/types";
import type { ContentPack, ExplanationContext, Fmt, FindingText, HeadlineInput } from "./types";

const paragraphs = (...ps: string[]): string => ps.join("\n\n");

/** "of 0.012" or "below 0.001", for phrases like "a p-value of 0.012". */
function pValuePhrase(p: number, fmt: Fmt): string {
  return p < 0.001 ? `below ${fmt.num(0.001, 3)}` : `of ${fmt.num(p, 3)}`;
}

/** A probability that never rounds to 0% or 100%, which the method never claims. */
function chance(p: number, fmt: Fmt): string {
  if (p > 0.999) return `over ${fmt.pct(0.999, 1)}`;
  if (p < 0.001) return `under ${fmt.pct(0.001, 1)}`;
  return fmt.pct(p, 1);
}

const days = (n: number, fmt: Fmt): string => `${fmt.int(n)} ${n === 1 ? "day" : "days"}`;

function finding(f: Finding, fmt: Fmt): FindingText {
  const title = ruleTitle[f.rule];
  switch (f.rule) {
    case "srm":
      return {
        title,
        explanation: `The split of users across groups does not match the intended split. The chi-square test gave a p-value ${pValuePhrase(f.pValue, fmt)}, below the ${fmt.num(0.01, 2)} threshold. If assignment worked as planned, an imbalance this large would be very rare. So the result may be biased, even if it looks conclusive.`,
        action:
          "Do not make a decision on this result. First check that the split entered here matches the one configured in your testing tool. Then look for the usual causes, such as bots filtered out of only one group, a redirect that loses users, a cache serving the wrong version, or a bucketing bug. Fix the cause and run the test again.",
      };
    case "low_data":
      return {
        title,
        explanation: `The result for variant ${f.variant} is conclusive, but it rests on only ${fmt.num(Math.abs(f.weightedDiff), 1)} conversions of difference, already adjusted for group size. With a margin this thin, a few users more or less would change the verdict. Effects like this tend to shrink as the test keeps running.`,
        action:
          "Treat the result as an early signal. Let the test reach its planned sample before you ship, or confirm the effect in a second test.",
      };
    case "under_7_days":
      return {
        title,
        explanation: `The test ran for ${days(f.days, fmt)}, less than a week. Conversion often differs between weekdays and weekends, and the result only reflects part of that cycle.`,
        action: `Run the test for at least ${days(7, fmt)}, ideally in full weeks, before you decide.`,
      };
    case "incomplete_weeks":
      return {
        title,
        explanation: `The test has ${days(f.days, fmt)}, which is not a whole number of weeks. Some weekdays appear more often than others in the sample. If the variant's effect changes across the week, the result gives the repeated days more weight.`,
        action: `Consider ending the test at ${days(f.suggestedDays, fmt)} to balance the days of the week.`,
      };
    case "over_8_weeks":
      return {
        title,
        explanation: `The test has run for ${days(f.days, fmt)}, more than 8 weeks. In long tests, users clear cookies or switch devices and can land in another group. Seasonality and other site changes also mix into the variant's effect.`,
        action:
          "If the planned sample is already reached, stop and analyze. If the test still needs much more time, consider fewer variants, more traffic in the test, or a bolder change.",
      };
    case "stopped_early":
      return {
        title,
        explanation: `Variant ${f.variant} has ${fmt.int(f.current)} users, short of the ${fmt.int(f.planned)} planned, and the test is not set up as sequential. If you check results early and stop when they look significant, the false positive rate ends up well above the alpha you chose. Effects seen early also tend to be larger than the real ones.`,
        action:
          'Let the test run to the planned sample. If you need to monitor it while it runs, turn on "Test in progress" and decide by the sequential boundaries.',
      };
    case "underpowered":
      return {
        title,
        explanation: `The result for variant ${f.variant} is not conclusive, and the current sample is too small to detect the target lift of ${fmt.pct(f.referenceLift, 1)}. That does not mean there is no effect. A real effect of that size could still be hidden in the noise.`,
        action: `Keep the test running until it reaches the required sample, and check the additional days in step 1. If that takes too long, decide whether only an effect above ${fmt.pct(f.referenceLift, 1)} matters to the business.`,
      };
    case "mde_high":
      return {
        title,
        explanation: `With the current sample of variant ${f.variant}, the test only has the power you chose for lifts of ${fmt.pct(f.mde, 1)} or more. Smaller effects, which are the most common in conversion tests, can go unnoticed. If the result is significant anyway, the observed lift tends to overstate the real one.`,
        action:
          "If you expect a smaller effect, grow the sample. Run longer, send more traffic to the test, or cut the number of variants.",
      };
    case "bonferroni_off":
      return {
        title,
        explanation: `The test has ${fmt.int(f.groups)} groups and makes ${fmt.int(f.groups - 1)} comparisons against the control, without the Bonferroni correction. Each comparison uses the full alpha. The chance of at least one false positive across the whole test can approach ${fmt.int(f.groups - 1)} times that alpha.`,
        action:
          "Turn the Bonferroni correction on. If you prefer to keep it off, treat winners with a p-value near the threshold as hypotheses to confirm in a new test.",
      };
    case "methods_disagree":
      return {
        title,
        explanation: `For variant ${f.variant}, the Z test and the Bayesian method reach different verdicts. This happens near the decision threshold. The two methods answer different questions, and the Bayesian method uses neither Bonferroni nor the one-sided or two-sided choice. Neither one is wrong. The evidence is borderline.`,
        action:
          "Do not treat the result as settled. Look at the lift interval and the expected loss. If the decision matters, collect the planned sample before you decide.",
      };
    case "seq_not_crossed":
      return {
        title,
        explanation: `At look ${fmt.int(f.look)}, the observed z for variant ${f.variant} did not cross the O'Brien-Fleming boundary. Early boundaries are much stricter than the usual critical z, to pay for the repeated looks. Not crossing does not mean the variant does not work.`,
        action:
          "Keep the test running until the next planned look. Do not stop now based on the ordinary p-value, which ignores the looks.",
      };
    default: {
      const unreachable: never = f;
      return unreachable;
    }
  }
}

const ruleTitle: ContentPack["ruleTitle"] = {
  srm: "Possible sample ratio mismatch",
  stopped_early: "Possible peeking",
  low_data: "Few conversions of difference",
  under_7_days: "Less than a week of testing",
  over_8_weeks: "Test longer than 8 weeks",
  underpowered: "Sample too small for the target lift",
  bonferroni_off: "Bonferroni off with multiple variants",
  incomplete_weeks: "Incomplete weeks",
  mde_high: "High MDE",
  methods_disagree: "The methods disagree",
  seq_not_crossed: "Boundary not crossed",
};

function liftSentence(h: HeadlineInput, fmt: Fmt): string {
  const { variantName: v, controlName: c, lift } = h;
  if (lift === null) return `The relative lift of ${v} cannot be computed because ${c} had no conversions.`;
  if (lift === 0) return `${v} and ${c} converted at the same rate.`;
  const size = fmt.pct(Math.abs(lift), 1);
  return lift > 0 ? `${v} converted ${size} more than ${c}.` : `${v} converted ${size} less than ${c}.`;
}

const ENOUGH_SAMPLE =
  "The sample was already large enough to detect the target lift, so an effect of that size would likely have shown up.";
const NOT_ENOUGH_SAMPLE = "The sample is still too small to detect the target lift, so it is too early to tell.";

function bayesSentence(h: HeadlineInput, p: number, fmt: Fmt): string {
  switch (h.verdict) {
    case "winner":
      return `The chance that it is truly better is ${chance(p, fmt)}.`;
    case "loser":
      return `The chance that it is worse is ${chance(1 - p, fmt)}.`;
    case "no-difference":
      return `The chance that it is better is ${chance(p, fmt)}, short of a verdict. ${ENOUGH_SAMPLE}`;
    case "underpowered":
      return `The chance that it is better is ${chance(p, fmt)}, short of a verdict. ${NOT_ENOUGH_SAMPLE}`;
  }
}

function zSentence(h: HeadlineInput, p: number, fmt: Fmt): string {
  const pv = pValuePhrase(p, fmt);
  switch (h.verdict) {
    case "winner":
      return `With a p-value ${pv}, the difference is statistically significant.`;
    case "loser":
      return `With a p-value ${pv}, the drop is statistically significant.`;
    case "no-difference":
      return `With a p-value ${pv}, the difference is not statistically significant. ${ENOUGH_SAMPLE}`;
    case "underpowered":
      return `With a p-value ${pv}, the difference is not statistically significant. ${NOT_ENOUGH_SAMPLE}`;
  }
}

function headline(h: HeadlineInput, fmt: Fmt): string {
  const lead = liftSentence(h, fmt);
  if (h.method === "bayesian" && h.probabilityToBeat !== null) return `${lead} ${bayesSentence(h, h.probabilityToBeat, fmt)}`;
  if (h.method === "ztest" && h.pValue !== null) return `${lead} ${zSentence(h, h.pValue, fmt)}`;
  return lead;
}

const MISLEADS = "When it misleads.";

const SAMPLE_FORMULA =
  "`n = (zα × √(2 × p̄ × (1 − p̄)) + zβ × √(p1 × (1 − p1) + p2 × (1 − p2)))² / (p2 − p1)²`";

const explanations: ContentPack["explanations"] = {
  bayes: {
    title: "Bayesian method",
    layer1: (ctx: ExplanationContext | null) => {
      const intro =
        "Think of a weather forecast. It does not promise sunshine. It says there is a 20% chance of rain. The Bayesian method does the same for your test. It starts with no preference for any conversion rate and updates that belief with every user who arrives. In the end it answers the question you actually have.";
      const p = ctx?.probabilityToBeat;
      return p
        ? `${intro} In your test, the variant has a ${p} chance of being better than the control. Given the data so far, it converts more than the control in ${p} of the plausible scenarios.`
        : `${intro} A 97% chance of being better means that, given the data, the variant converts more than the control in 97 out of 100 plausible scenarios.`;
    },
    layer2: paragraphs(
      "Each group starts with a `Beta(1, 1)` prior, which gives equal weight to every conversion rate between 0% and 100%. The data update that belief into the posterior `Beta(1 + conversions, 1 + users − conversions)`. The prior is worth one extra conversion and one extra non-conversion, so it carries little weight once each group has a few dozen conversions.",
      "The calculator draws 50,000 values from each group's posterior, with a seed derived from the test's numbers. The same numbers always give the same result. The probability to beat the control is the share of draws where the variant beats it, `P(beat) = P(CRv > CRc)`. With 3 or more groups, the probability to be best is the share of draws where a group has the highest rate of all.",
      "The expected loss is `E[max(CRc − CRv, 0)]`. It is the average conversion you lose by shipping the variant, counting the scenarios where it is better as zero. It is shown in percentage points and relative to the control's rate.",
      "The credible interval of the lift runs from the `(1 − confidence) / 2` quantile to the `1 − (1 − confidence) / 2` quantile of `(CRv − CRc) / CRc`. Under the model, the true lift lies inside it with probability equal to the confidence level. That reading holds for the Bayesian interval. It does not hold for the Z test's confidence interval.",
      "A variant wins when `P(beat) ≥ confidence` and loses when `P(beat) ≤ 1 − confidence`. There is no p-value and no significance test. The answer is already a probability about the business question, and the 95% threshold is the decision rule you picked. That is why the Bayesian method ignores the one-sided or two-sided choice and the Bonferroni correction.",
      `${MISLEADS} The probability is only as good as the model. The model assumes each user converts independently, at a rate that stays fixed during the test, and that group assignment worked. Sample ratio mismatch, novelty effects and seasonality break those assumptions. Checking every day and stopping when P(beat) passes 95% also raises the chance of calling a winner that is not better. The posterior still describes the data, but that stopping rule loses its error control, and the flat prior does not protect you. With small samples, P(beat) swings a lot from one day to the next, so check the interval and the expected loss too. With several variants, the chance that one crosses the threshold by luck grows, even though Bonferroni is not part of the math.`,
    ),
  },

  ztest: {
    title: "Z test",
    layer1: (ctx) => {
      const intro =
        "Picture a coin that might be loaded. You start by assuming it is fair and flip it 100 times. If you get 70 heads, a fair coin would almost never do that, and your suspicion grows. The Z test does the same with your test. It assumes the variant and the control convert at the same rate and measures how unusual a difference at least as large as the observed one would be. That measure is the p-value.";
      const p = ctx?.pValue;
      return p
        ? `${intro} In your test, the p-value is ${p}. If the variant and the control converted at the same rate, a difference at least this extreme would show up with probability ${p}.`
        : `${intro} The smaller the p-value, the harder it is to explain the difference by chance alone.`;
    },
    layer2: paragraphs(
      "The null hypothesis `H0` says the variant's true rate equals the control's. The test measures how far the data sit from that hypothesis, in standard errors.",
      "For each group, `CR = conversions / users` and `SE = √(CR × (1 − CR) / users)`. The standard error of the difference is `SEdiff = √(SEc² + SEv²)`, unpooled, as in ABTestGuide. The Z-score is `z = (CRv − CRc) / SEdiff`.",
      "The two-sided p-value is `2 × (1 − Φ(|z|))` and the one-sided p-value is `1 − Φ(z)`, where `Φ` is the cumulative normal distribution. The result is significant when `p-value < α'`. Alpha is `α' = 1 − confidence`, divided by `groups − 1` when the Bonferroni correction is on.",
      "The confidence interval of the difference is `(CRv − CRc) ± z(1 − α'/2) × SEdiff`. For a one-sided test, the calculator shows only the lower bound. The relative lift interval divides those bounds by `CRc`, an approximation that ignores the uncertainty in the control's rate. A 95% interval does not mean a 95% chance that the true value is inside it. It means that if you repeated the test many times, 95% of the intervals built this way would contain the true value.",
      "The test relies on the normal approximation, which needs a large sample. A rule of thumb is at least 10 conversions and 10 non-conversions in each group. At 0% or 100% conversion, a group's standard error becomes zero and the test understates the uncertainty.",
      `${MISLEADS} The p-value only holds if the sample size was fixed in advance and the test is analyzed once. Peeking and stopping at significance inflates false positives. To monitor a running test, use sequential mode. Testing several variants or several metrics also multiplies the chances of a false positive. A significant result does not mean the effect is large. With enough traffic, differences too small to matter become significant. A non-significant result does not prove the rates are equal either. It only shows the data are not enough to rule out equality.`,
    ),
  },

  "bayes-vs-z": {
    title: "Bayesian or Z test?",
    layer1: (ctx) => {
      const intro =
        "Both methods look at the same data and ask different questions. The Z test works like a court. It presumes the variant changes nothing and drops that presumption only with strong evidence. The Bayesian method works like someone pricing a bet. It tells you the chance that the variant is better. Far from the decision threshold, the two almost always agree. Close to it, one can say \"winner\" while the other says \"inconclusive\".";
      const pv = ctx?.pValue;
      const pb = ctx?.probabilityToBeat;
      return pv && pb
        ? `${intro} In your test, the Z test gives a p-value of ${pv} and the Bayesian method gives the variant a ${pb} chance of being better.`
        : intro;
    },
    layer2: paragraphs(
      "Use the Bayesian method when the question is which version to ship. It gives the probability that the variant is better and the expected loss if you are wrong, two numbers that map well onto a business decision. It is the calculator's default.",
      "Use the Z test when you need explicit control of the false positive rate, when you planned the sample with confidence and power, or when you will monitor the test while it runs. Sequential testing with O'Brien-Fleming boundaries is only available for the Z test. It also reproduces the numbers of tools like ABTestGuide.",
      "Why they disagree. With a `Beta(1, 1)` prior and large samples, `P(beat)` comes close to `1 − one-sided p-value`, which is `Φ(z)`. At 95% confidence, the Bayesian method calls a winner when `Φ(z) ≥ 0.95`, that is, when `z ≥ 1.645`. The two-sided Z test needs `|z| ≥ 1.96`. Between those values, the Bayesian method sees a winner and the Z test sees no significant difference. For example, `z = 1.75` gives a `P(beat)` near 96% and a two-sided p-value near 0.08.",
      "The Bonferroni correction widens that gap. With 3 or more groups, the Z test gets stricter while the Bayesian threshold stays put. A disagreement is not a calculation error. It shows that the evidence is borderline and that the decision depends on the rule you chose.",
    ),
  },

  "p-value": {
    title: "p-value",
    layer1: (ctx) => {
      const intro =
        "Say you flip a coin 10 times and get heads every time. With a fair coin, that happens about once in 1,000 tries. A p-value is that kind of number. It starts from the assumption that the variant and the control convert at the same rate and tells you how unusual a difference at least as large as yours would be.";
      const p = ctx?.pValue;
      return p
        ? `${intro} In your test, the p-value is ${p}. If the variant and the control converted at the same rate, a difference at least this extreme would show up with probability ${p}. That does not mean there is a ${p} chance the result is luck, nor that the variant has the remaining chance of being better.`
        : `${intro} It does not tell you the chance that the variant is better.`;
    },
    layer2: paragraphs(
      "The p-value is `P(a difference at least as extreme as the observed one | H0)`, where `H0` says the true rates are equal. Two-sided, `p = 2 × (1 − Φ(|z|))`. One-sided, `p = 1 − Φ(z)`.",
      "What it is not. It is not the probability that `H0` is true. It is not the probability that the result is luck. And `1 − p` is not the probability that the variant is better. For that question, use the Bayesian method. The p-value does not measure the size of the effect either. For that, look at the lift and the confidence interval.",
      "When there is no real difference, the p-value is uniformly distributed between 0 and 1. With an alpha of 5%, 1 in 20 tests with no effect at all comes out significant by chance. A p-value above the threshold does not prove the rates are equal. And 0.049 and 0.051 are, in practice, the same evidence.",
      `${MISLEADS} The p-value assumes a sample size fixed in advance, a single analysis and clean data. Peeking and stopping at the first low p-value, looking at many metrics, or a sample ratio mismatch make low p-values appear by chance far more often than the threshold promises.`,
    ),
  },

  "confidence-power": {
    title: "Confidence and power",
    layer1: (ctx) => {
      const intro =
        "A fire alarm can fail in two ways. It can ring with no fire, or stay silent during one. Confidence controls the first mistake and power controls the second. Making the alarm stricter cuts false alarms but raises the risk of missing a small fire. To reduce both at once, the test needs more data.";
      const c = ctx?.confidence;
      const pw = ctx?.power;
      if (!c || !pw) {
        return `${intro} With 95% confidence and 80% power, a variant that changes nothing gets flagged as different 5% of the time. A variant with the target lift gets detected 80% of the time, as long as the test runs to the planned sample.`;
      }
      const alpha = ctx.alpha
        ? ` If the variant changes nothing, the chance that the test flags a difference by mistake is ${ctx.alpha}.`
        : "";
      return `${intro} In your test, confidence is ${c} and power is ${pw}.${alpha} If the variant has the target lift, the chance that the test detects it is ${pw}, as long as it runs to the planned sample.`;
    },
    layer2: paragraphs(
      "A type I error is calling a difference that does not exist, a false positive. Its probability is alpha, `α = 1 − confidence`. With Bonferroni on and 3 or more groups, each comparison uses `α' = (1 − confidence) / (groups − 1)`.",
      "A type II error is missing a difference that does exist, a false negative. Its probability is `β = 1 − power`. Power always refers to a specific effect size. 80% power means an 80% chance of detecting the difference if the true lift equals the target lift. For smaller true lifts, power is lower.",
      `Both errors compete for the same sample, which comes from ${SAMPLE_FORMULA}. Here \`p1\` is the baseline rate, \`p2 = p1 × (1 + lift)\`, \`p̄ = (p1 + p2) / 2\`, \`zβ = z(power)\`, and \`zα = z(1 − α'/2)\` two-sided or \`z(1 − α')\` one-sided. With a fixed sample, raising confidence lowers power. To keep both, the sample has to grow. At 80% power, going from 95% to 99% confidence takes about 50% more users. At 95% confidence, going from 80% to 90% power takes about 34% more.`,
      'In the Bayesian method, confidence is the `P(beat)` threshold for calling a winner. There is no power there, but the "underpowered" verdict uses the same sample rule as the Z test.',
      `${MISLEADS} 95% confidence does not mean a 95% chance that the result is right. If few of the ideas you test really work, far more than 5% of declared winners can be false. Power is not the chance that the result is right either. It is a property of the plan, computed before the test. Observed power, \`Φ(|z| − critical z)\`, is just the p-value written another way. It sits near 50% when the p-value is right at the threshold and says nothing about whether the sample was large enough. For that, compare the achieved MDE with the target lift.`,
    ),
  },

  "mde-sample": {
    title: "MDE and sample size",
    layer1: (ctx) => {
      const intro =
        "In a noisy room, you only hear a whisper if you get close. A shout carries across the room. The MDE, or minimum detectable effect, is the smallest effect your test can hear with the sample it has. With little traffic, the test only hears shouts.";
      const mde = ctx?.mde;
      if (!mde) {
        return `${intro} For example, an MDE of 8.4% at 80% power means that if the variant lifts conversion by 8.4% or more, the test has at least an 80% chance of detecting it. Smaller lifts can go unnoticed.`;
      }
      const odds = ctx.power ? `at least ${ctx.power}` : "at least the power you chose";
      return `${intro} In your test, the MDE is ${mde}. If the variant lifts conversion by ${mde} or more, the chance that the test detects it is ${odds}. Smaller lifts can go unnoticed.`;
    },
    layer2: paragraphs(
      "The baseline rate is `p = weekly conversions / weekly traffic`. In week `w`, each group has `n(w) = weekly traffic × % in test × w / groups` visitors.",
      `The sample per variant for a target lift is ${SAMPLE_FORMULA}, with \`p1 = p\`, \`p2 = p × (1 + lift)\` and \`p̄ = (p1 + p2) / 2\`. The MDE for week \`w\` is the lift that requires exactly \`n(w)\` visitors in that formula. The calculator finds it by bisection, so the two pre-test modes are exact inverses of each other. The absolute MDE is \`p × relative MDE\`, in percentage points.`,
      "Why low traffic only detects large effects. The sample grows with the inverse square of the difference, `1 / (p2 − p1)²`. Detecting half the effect takes about 4 times as many users. Going the other way, the MDE shrinks with the square root of the sample, so running 4 times longer only halves the MDE. A low baseline rate makes it worse, because the same relative lift becomes a smaller absolute difference.",
      "Duration is `days = ⌈ n × groups / (weekly traffic / 7 × % in test) ⌉`. Each extra variant adds to the total sample, and the Bonferroni correction adds to each group's sample. With planned looks, `n` is multiplied by the inflation factor of the sequential design. Round the duration up to full weeks.",
      `${MISLEADS} The MDE is not the effect you should expect. Picking an optimistic target lift shortens the plan but leaves the test blind to realistic effects. In practice, few CRO tests show true lifts above 10%. When a test with a high MDE comes out significant, the observed lift tends to overstate the real effect. The calculation also assumes the baseline rate and the traffic hold steady during the test.`,
    ),
  },

  hypothesis: {
    title: "Two-sided or one-sided",
    layer1: (ctx) => {
      const intro =
        "A two-sided test is like a guard watching both doors of a house. A one-sided test watches only the front door. It spots anyone coming through that door sooner, but it never sees who comes in the back. In an A/B test, the front door is the variant raising conversion. The back door is the variant lowering it. A one-sided test never calls a variant a loser, however bad it is.";
      const a = ctx?.alpha;
      return a
        ? `${intro} In your test, alpha is ${a}. A two-sided test splits that alpha between both directions. A one-sided test puts all of it on the upside.`
        : intro;
    },
    layer2: paragraphs(
      "Two-sided. The null hypothesis is `CRv = CRc` and the alternative is `CRv ≠ CRc`. The critical z is `z(1 − α'/2)`, which is 1.96 at 95% confidence, and the p-value is `2 × (1 − Φ(|z|))`. It detects gains and losses.",
      "One-sided. The null hypothesis is `CRv ≤ CRc` and the alternative is `CRv > CRc`. The critical z is `z(1 − α')`, which is 1.645 at 95% confidence, and the p-value is `1 − Φ(z)`. With the same sample, a one-sided test detects smaller gains. For the same MDE, it needs about 20% fewer users.",
      "A one-sided test does not detect losses. If the variant converts less, z goes negative and the p-value gets close to 1. The verdict becomes inconclusive, never loser. For the same reason, the one-sided confidence interval only has a lower bound.",
      `${MISLEADS} The choice has to be made before you see the data. Picking the direction after seeing the result effectively doubles the false positive rate. Use a one-sided test only when a loss and a tie lead to the same decision, which is not to ship, and when nobody will need to know whether the variant made things worse. The Bayesian method does not use this choice.`,
    ),
  },

  bonferroni: {
    title: "Bonferroni correction",
    layer1: (ctx) => {
      const intro =
        "One lottery ticket gives you a small chance of winning. Four tickets give you almost four times the chance. Several variants work the same way, and each comparison with the control is a ticket for a false positive. The Bonferroni correction makes each comparison stricter, so that the chance of at least one false positive across the whole test stays within the level you chose.";
      const g = ctx?.groups;
      const a = ctx?.alpha;
      if (g === 2) return `${intro} Your test has only one comparison, so the correction changes nothing.`;
      if (g !== undefined && a) {
        return `${intro} In your test, ${g} groups make ${g - 1} comparisons against the control, and each one uses an alpha of ${a}.`;
      }
      return `${intro} With 3 groups and 95% confidence, each comparison uses an alpha of 2.5% instead of 5%.`;
    },
    layer2: paragraphs(
      "With `k = groups − 1` independent comparisons, each at alpha `α`, the chance of at least one false positive is `1 − (1 − α)^k`. At `α = 5%`, that is 9.75% with 2 comparisons and 18.5% with 4. Here the comparisons share the same control, so the real numbers are a bit lower, but they grow the same way.",
      "The correction uses `α' = (1 − confidence) / (groups − 1)` for each comparison. At 95% confidence, that is 2.5% with 3 groups, 1.67% with 4 and 1.25% with 5. By the Bonferroni inequality, the chance of at least one false positive stays at or below `1 − confidence`, whatever the relationship between the comparisons.",
      "The price is power. Each comparison gets stricter, so the pre-test asks for a larger sample per group. In a sequential test, the correction applies to the total alpha before it is spread across the looks. The Bayesian method does not apply the correction, and its winner threshold stays equal to the confidence level.",
      `${MISLEADS} Bonferroni is conservative. With many variants, it can hide real effects. It also only covers the comparisons against the control on this metric. Looking at several metrics or segments multiplies the chances of a false positive in the same way, and the correction does not protect you from that.`,
    ),
  },

  "expected-risk": {
    title: "Expected loss",
    layer1: (ctx) => {
      const intro =
        "A fair price for car insurance combines two things, the chance of a crash and the cost of the repair when one happens. Expected loss does the same math for the variant. It measures how much conversion you lose, on average, by shipping the variant, counting the cases where it is better as zero.";
      const loss = ctx?.expectedLoss;
      return loss
        ? `${intro} In your test, shipping the variant costs ${loss} of conversion rate on average, with the scenarios where it is better counted as zero.`
        : `${intro} An expected loss of 0.02 p.p. means that, after accounting for the chance of being wrong, the average loss you should expect is 0.02 percentage points of conversion rate.`;
    },
    layer2: paragraphs(
      "The expected loss is `E[max(CRc − CRv, 0)]`. The calculator averages `max(CRc − CRv, 0)` over the 50,000 posterior draws. In draws where the variant is better, the loss is zero. In the rest, it is how much less the variant converts. The result is shown in percentage points and relative to `CRc`. Lower is better.",
      "Expected loss combines the chance of being wrong with the size of the mistake. It equals `P(variant worse) × average loss when it is worse`. That is why it complements `P(beat)`. Two variants with a 90% chance to beat the control can carry very different risks if one of them could lose a lot in the remaining 10%.",
      "A common decision rule is to ship when the expected loss falls below a loss you can live with, such as 0.01 p.p. or 1% relative. That threshold is a business choice, not a statistical rule.",
      `${MISLEADS} Expected loss only measures conversion rate. It does not measure revenue, average order value or other metrics. It also depends on the model. With a sample ratio mismatch, a novelty effect or a very small sample, the number can look small and still be wrong. Values very close to zero carry simulation noise in the last digits.`,
    ),
  },

  srm: {
    title: "Sample ratio mismatch (SRM)",
    layer1: (ctx) => {
      const intro =
        "If you flip a coin 1,000 times and get 600 heads, something is wrong with the coin. In an A/B test, the coin is the random assignment that sends each user to a group. If the actual split lands far from the planned one, the assignment or the tracking has a problem. The users who are extra in one group or missing from another usually differ from the rest, and the result can be biased.";
      const g = ctx?.groups;
      return g !== undefined
        ? `${intro} In your test, the calculator compares the users in each of the ${g} groups with the split you entered.`
        : intro;
    },
    layer2: paragraphs(
      "The calculator runs a chi-square goodness-of-fit test, `χ² = Σ (observed − expected)² / expected`, with `expected = total users × intended split` and `groups − 1` degrees of freedom. The alert fires when `p < 0.01`. The threshold is stricter than usual because the check runs on every test, and at 0.05 it would raise a false alarm in 1 out of 20 healthy tests.",
      "Common causes. Bots and traffic filters can hit one group harder than another. A redirect on the variant loses users who leave before the page loads. A cache or CDN can serve the wrong version. Bucketing can be buggy, with users switching groups or a badly distributed hash. A tracking tag can fire on only one version. The split may have changed mid-test.",
      "What to do. Do not patch the numbers by hand or drop the extra users. Find the cause, fix it and run the test again. A wrong split entered in the calculator also triggers the alert, so first check that it matches the one configured in your tool.",
      `${MISLEADS} With millions of users, tiny deviations such as 50.2% against 49.8% already trigger the alert. It is still worth investigating, but the cause may be minor. With few users, the check has little power, and the absence of an alert does not prove that assignment worked.`,
    ),
  },

  "peeking-sequential": {
    title: "Peeking and sequential testing",
    layer1: (ctx) => {
      const intro =
        "Imagine you could blow the final whistle the moment your team takes the lead. You would win games you would lose over the full 90 minutes. Checking a test every day and stopping at the first significant result works the same way. Every look is another chance for luck to pass as a real effect. A sequential test agrees in advance on how many times you will look and demands a much bigger lead to stop early.";
      const look = ctx?.look;
      const planned = ctx?.plannedLooks;
      return look !== undefined && planned !== undefined
        ? `${intro} In your test, this is look ${look} of ${planned}. If the observed z crosses this look's boundary, you can stop. If it does not, keep going until the next look.`
        : intro;
    },
    layer2: paragraphs(
      "Why peeking inflates false positives. When there is no effect, each analysis has an alpha-sized chance of coming out significant by luck. Looking several times and stopping at the first significant result piles those chances up. At 95% two-sided with the usual threshold at every look, the overall false positive rate climbs to about 8% with 2 looks, 14% with 5 and 19% with 10. With endless looks, it heads toward 100%.",
      "How the boundaries fix it. A sequential test spends alpha gradually, using the Lan-DeMets O'Brien-Fleming-type spending function `α(t) = 2 − 2 × Φ(z(1 − α/2) / √t)` for two-sided tests. Here `t` is the information fraction, `current n / maximum planned n`. The boundaries come from that function by recursive numerical integration, the Armitage, McPherson and Rowe method. By the last look, the alpha spent adds up to exactly the alpha you chose. One-sided tests use the same idea with a single upper boundary. With Bonferroni on, the correction comes first and the corrected alpha is then spread across the looks.",
      "The early boundaries are very strict, and the last one sits close to the usual critical z. With 4 equally spaced looks at 95% two-sided, the boundaries are about `z = 3.92`, `2.77`, `2.30` and `2.04`. In exchange, the maximum sample grows only a little. With 5 looks, it is about 4% larger than the fixed-sample test.",
      "The calculator uses the actual sample at each look to compute `t`, not the planned one. That keeps alpha correct if a look comes early or late. Sequential testing only works with the Z test. Not crossing the boundary means keep going, not that the variant does not work. This calculator has no futility boundary, the kind that would let you stop for lack of a chance to win.",
      `${MISLEADS} The boundaries only protect you if the number of looks was set in advance and you only decide at those looks. Stopping at an unplanned look inflates the error again. A test that stops early by crossing a boundary tends to overstate the lift. The Bayesian method is not immune either. The probability still describes the data, but stopping on the first day it passes 95% raises the chance of calling a winner that is not better.`,
    ),
  },
};

export const content: ContentPack = {
  locale: "en",
  explanations,
  finding,
  ruleTitle,
  headline,
  verdictLabel: {
    winner: "Winner",
    loser: "Loser",
    "no-difference": "Inconclusive, no meaningful difference",
    underpowered: "Inconclusive, underpowered",
  },
};
