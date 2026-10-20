import IconUp from "~icons/ph/trend-up-bold";
import IconDown from "~icons/ph/trend-down-bold";
import IconEquals from "~icons/ph/equals-bold";
import IconHourglass from "~icons/ph/hourglass-bold";
import IconWarning from "~icons/ph/warning-octagon";
import type { AnalysisResult, Locale } from "../stats/types";
import type { AppState } from "../app/state";
import type { ContentPack, ExplanationContext } from "../i18n/content/types";
import type { Ui } from "../i18n/ui";
import type { Formatter } from "../app/format";
import { Stat } from "./controls";
import { Explanation } from "./explanation";
const icons = {
  winner: IconUp,
  loser: IconDown,
  "no-difference": IconEquals,
  underpowered: IconHourglass,
};

export function Verdicts({
  result,
  state,
  content,
  fmt,
  t,
  context,
}: {
  result: Extract<AnalysisResult, { kind: "ok" }>;
  state: AppState;
  content: ContentPack;
  fmt: Formatter;
  t: Ui;
  context: ExplanationContext;
  locale: Locale;
}) {
  return (
    <>
      {result.variants.map((v) => {
        const group = state.analysis.groups.find((g) => g.id === v.id);
        if (!group) return null;
        const Icon = icons[v.verdict];
        const bayes = state.analysis.method === "bayesian";
        const interval = bayes
          ? v.bayes.credibleIntervalRelative
          : v.ztest.ciRelative;
        const money = result.revenue?.perVariant.find((r) => r.id === v.id);
        const ctx = {
          ...context,
          probabilityToBeat: fmt.pct(v.bayes.probabilityToBeatControl, 1),
          pValue: fmt.pvalue(v.ztest.pValue),
          expectedLoss: fmt.pp(v.bayes.expectedLossAbsolute),
          mde: fmt.pct(v.achievedMde),
          ...(v.sequential
            ? {
                look: v.sequential.look,
                plannedLooks: v.sequential.plannedLooks,
              }
            : {}),
        };
        return (
          <section
            class="verdict"
            data-verdict={v.verdict}
            aria-labelledby={`verdict-${v.id}`}
            key={v.id}
          >
            <div class="verdict-title">
              <span class="badge verdict-badge">
                <Icon aria-hidden="true" />
                {content.verdictLabel[v.verdict]}
              </span>
              <h3 id={`verdict-${v.id}`}>{group.name}</h3>
              {result.srm.mismatch && (
                <span class="badge critical">
                  <IconWarning aria-hidden="true" />
                  {t.unreliable}
                </span>
              )}
            </div>
            <p class="headline">
              {content.headline(
                {
                  verdict: v.verdict,
                  variantName: group.name,
                  controlName: state.analysis.groups[0]?.name ?? t.control,
                  lift: v.ztest.lift,
                  probabilityToBeat: v.bayes.probabilityToBeatControl,
                  pValue: v.ztest.pValue,
                  method: state.analysis.method,
                },
                fmt,
              )}
            </p>
            <div class="stats">
              <Stat
                hero
                label={bayes ? t.probability : t.lift}
                value={
                  bayes
                    ? fmt.pct(v.bayes.probabilityToBeatControl, 1)
                    : v.ztest.lift === null
                      ? "—"
                      : fmt.pct(v.ztest.lift)
                }
              />
              <Stat
                label={bayes ? t.lift : t.pvalue}
                value={
                  bayes
                    ? v.ztest.lift === null
                      ? "—"
                      : fmt.pct(v.ztest.lift)
                    : fmt.pvalue(v.ztest.pValue)
                }
              />
              <Stat
                label={bayes ? t.risk : t.zscore}
                value={
                  bayes
                    ? fmt.pp(v.bayes.expectedLossAbsolute)
                    : fmt.num(v.ztest.z, 4)
                }
              />
              {bayes && state.analysis.groups.length > 2 && (
                <Stat
                  label={t.best}
                  value={fmt.pct(v.bayes.probabilityToBeBest, 1)}
                />
              )}
            </div>
            {v.ztest.lift === null && (
              <p class="small-note">
                {t.absolute}{" "}
                <span class="metric">{fmt.pp(v.ztest.absoluteDiff)}</span>
              </p>
            )}
            <p class="small-note">
              {t.interval}{" "}
              <span class="metric">
                {interval
                  ? `${fmt.pct(interval[0])} … ${Number.isFinite(interval[1]) ? fmt.pct(interval[1]) : "∞"}`
                  : "—"}
              </span>
            </p>
            {v.sequential && (
              <div class="plan-notice">
                <p>
                  {t.look}{" "}
                  <span class="metric">
                    {v.sequential.look}/{v.sequential.plannedLooks}
                  </span>{" "}
                  · {t.information}{" "}
                  <span class="metric">
                    {fmt.pct(v.sequential.informationFraction)}
                  </span>
                </p>
                <p>
                  {t.boundary}{" "}
                  <span class="metric">
                    {fmt.num(v.sequential.zBoundary, 4)}
                  </span>{" "}
                  · {t.zscore}{" "}
                  <span class="metric">
                    {fmt.num(v.sequential.zObserved, 4)}
                  </span>
                </p>
                <p>
                  {v.sequential.isFinal
                    ? t.finalLook
                    : v.sequential.crossed
                      ? t.crossed
                      : t.notCrossed}
                </p>
                {v.sequential.isFinal && state.plan && (
                  <p class="small-note">{t.overPlan}</p>
                )}
              </div>
            )}
            {money && (
              <>
                <div class="stats">
                  <Stat
                    label={t.transactions}
                    value={fmt.num(money.extraMonthlyConversions)}
                    negative={money.extraMonthlyConversions < 0}
                  />
                  <Stat
                    label={t.monthly}
                    value={fmt.currency(
                      money.monthlyContribution,
                      state.currency,
                    )}
                    negative={money.monthlyContribution < 0}
                  />
                  <Stat
                    label={t.impact}
                    value={fmt.currency(money.horizonImpact, state.currency)}
                    negative={money.horizonImpact < 0}
                  />
                </div>
                {money.monthlyContribution < 0 && (
                  <p class="critical">{t.loss}</p>
                )}
                {(v.verdict === "underpowered" ||
                  v.verdict === "no-difference") && (
                  <p class="small-note">{t.unconfirmed}</p>
                )}
              </>
            )}
            <Explanation
              id={bayes ? "expected-risk" : "p-value"}
              content={content}
              context={ctx}
              t={t}
            />
          </section>
        );
      })}
      <div class="stats">
        <Stat
          label={t.extraDays}
          value={result.extraDays === null ? "—" : fmt.int(result.extraDays)}
          note={
            result.extraDays === null
              ? t.needDays
              : !Number.isFinite(result.extraDays)
                ? t.zeroControl
                : undefined
          }
        />
      </div>
    </>
  );
}
