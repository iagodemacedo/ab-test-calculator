import { lazy, Suspense } from "preact/compat";
import { useEffect, useState } from "preact/hooks";
import type { Action, PretestFields, Tab } from "../app/state";
import type { Locale } from "../stats/types";
import { ui } from "../i18n/ui";
import type { UiKey } from "../i18n/ui";
import { routes } from "../i18n/routes";
import { content as ptContent } from "../i18n/content/pt";
import { content as enContent } from "../i18n/content/en";
import { formatters } from "../app/format";
import { encode, saveDraft } from "../app/codec";
import { groupCount } from "../app/reducer";
import { useCalculatorState, useEngine } from "../app/hooks";
import { track } from "../app/analytics";
import { Button, NumberField, Segmented, Stat, Toggle } from "./controls";
import { Groups } from "./groups";
import { Settings } from "./settings";
import { Explanation } from "./explanation";
import { PlanningResults, MdeTable } from "./planning-results";
import { Verdicts } from "./verdicts";
import { Findings, ruleFindings } from "./findings";
import { TldrBlock } from "./tldr";

const AnalysisCharts = lazy(() =>
  import("./charts").then((module) => ({ default: module.AnalysisCharts })),
);
const MdeChart = lazy(() =>
  import("./charts").then((module) => ({ default: module.MdeChart })),
);
export default function Calculator({
  locale,
  initialTab,
}: {
  locale: Locale;
  initialTab: Tab;
}) {
  const t = ui[locale],
    fmt = formatters[locale],
    content = locale === "pt" ? ptContent : enContent;
  const { state, dispatch, ready, notice, setNotice } =
    useCalculatorState(locale);
  const { analysis, pretest, response, computedState, busy, error } = useEngine(
    state,
    locale,
    ready,
  );
  const [tab, setTab] = useState(initialTab);
  const [toast, setToast] = useState("");
  const [seqNotice, setSeqNotice] = useState(false);
  const [clearCount, setClearCount] = useState(0);
  const result = analysis.kind === "ok" ? (response?.analysis ?? null) : null;
  const planning = pretest.kind === "ok" ? (response?.pretest ?? null) : null;
  const ok = result?.kind === "ok" ? result : null;
  const errors = tab === "analysis" ? analysis.errors : pretest.errors;
  const activeAlpha =
    tab === "analysis"
      ? ok?.alpha
      : planning?.kind === "ok"
        ? planning.alpha
        : undefined;
  const context = {
    confidence: fmt.pct(state.settings.confidence, 0),
    power: fmt.pct(state.settings.power, 0),
    ...(activeAlpha !== undefined ? { alpha: fmt.pct(activeAlpha) } : {}),
    groups:
      tab === "analysis" ? state.analysis.groups.length : state.pretest.groups,
    ...(tab === "analysis" && ok?.variants[0]
      ? {
          probabilityToBeat: fmt.pct(
            ok.variants[0].bayes.probabilityToBeatControl,
            1,
          ),
          pValue: fmt.pvalue(ok.variants[0].ztest.pValue),
          mde: fmt.pct(ok.variants[0].achievedMde),
          expectedLoss: fmt.pp(ok.variants[0].bayes.expectedLossAbsolute),
        }
      : {}),
  };
  const navigate = async (next: Tab) => {
    const link = await encode(
      state,
      locale,
      location.origin.length + routes[locale][next].length,
    );
    history.pushState(null, "", routes[locale][next] + link.fragment);
    setTab(next);
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const pop = () =>
      setTab(
        location.pathname === routes[locale].pretest ? "pretest" : "analysis",
      );
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [locale]);
  useEffect(() => {
    document.title = `${t[tab]} · AB Test Calculator`;
    document
      .querySelectorAll<HTMLAnchorElement>("nav [data-calculator-link]")
      .forEach((a) => {
        if (a.pathname === routes[locale][tab])
          a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
    const language =
      document.querySelector<HTMLAnchorElement>("[data-language]");
    if (language)
      language.href =
        routes[locale === "pt" ? "en" : "pt"][tab] + location.hash;
    for (const language of ["pt", "en"] as const)
      document
        .querySelector<HTMLLinkElement>(
          `link[hreflang="${language === "pt" ? "pt-BR" : "en"}"]`,
        )
        ?.setAttribute(
          "href",
          `https://ab-test.iago.wtf${routes[language][tab]}`,
        );
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute("href", `https://ab-test.iago.wtf${routes[locale][tab]}`);
  }, [locale, tab, t]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (
        !(event.target instanceof Element) ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      const anchor = event.target.closest<HTMLAnchorElement>(
        "a[data-calculator-link],a[data-language]",
      );
      if (anchor) {
        event.preventDefault();
        const language =
          anchor.dataset.language === "en"
            ? "en"
            : anchor.dataset.language === "pt"
              ? "pt"
              : locale;
        if (
          language === locale &&
          (anchor.pathname === routes[locale].analysis ||
            anchor.pathname === routes[locale].pretest)
        ) {
          void navigate(
            anchor.pathname === routes[locale].pretest ? "pretest" : "analysis",
          );
        } else {
          void encode(
            state,
            locale,
            anchor.origin.length + anchor.pathname.length,
          ).then((link) => {
            try {
              saveDraft(localStorage, state, locale);
            } catch {}
            if (language !== locale)
              track("language_switched", { locale: language });
            location.assign(anchor.pathname + link.fragment);
          });
        }
      }
      if (event.target.closest("#share-link"))
        void (async () => {
          const link = await encode(
            state,
            locale,
            location.origin.length + location.pathname.length,
          );
          const url = location.origin + location.pathname + link.fragment;
          history.replaceState(null, "", location.pathname + link.fragment);
          try {
            await navigator.clipboard.writeText(url);
            setToast(link.omittedTldr ? t.omittedTldr : t.copied);
            track("share_link_copied", {
              tldr: Boolean(state.tldr) && !link.omittedTldr,
            });
          } catch {
            setNotice("copyFailed");
          }
        })();
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, [state, tab, locale]);
  const updatePretest = (patch: Partial<PretestFields>) =>
    dispatch({ type: "pretest", patch });
  const field = (
    key: "days" | "trafficPct" | "referenceLiftPct" | "valuePerConversion",
    label: string,
    unit?: string,
  ) => (
    <NumberField
      id={`analysis-${key}`}
      label={label}
      value={state.analysis[key]}
      onInput={(value) =>
        dispatch({ type: "analysis", patch: { [key]: value } })
      }
      error={state.analysis[key] ? analysis.errors[key] : undefined}
      t={t}
      unit={unit}
    />
  );
  const preField = (
    key: "weeklyTraffic" | "weeklyConversions" | "trafficPct" | "targetLiftPct",
    label: string,
    unit?: string,
  ) => (
    <NumberField
      id={`pretest-${key}`}
      label={label}
      value={state.pretest[key]}
      onInput={(value) => updatePretest({ [key]: value })}
      error={state.pretest[key] ? pretest.errors[key] : undefined}
      t={t}
      unit={unit}
    />
  );
  const planChanged =
    JSON.stringify(state.planSource) !== JSON.stringify(state.pretest) ||
    Boolean(
      state.plan &&
        response?.plan &&
        !busy &&
        (state.plan.groups !== response.plan.groups ||
          state.plan.trafficShare !== response.plan.trafficShare ||
          state.plan.referenceLift !== response.plan.referenceLift ||
          state.plan.samplePerVariant !== response.plan.samplePerVariant ||
          state.plan.days !== response.plan.days ||
          state.plan.looks !== response.plan.looks),
    );
  const usePlan = () => {
    if (!response?.plan || busy) return;
    const action: Action = {
      type: "use-plan",
      plan: { ...response.plan, createdAt: new Date().toISOString() },
    };
    dispatch(action);
    track("plan_used", {
      groups: response.plan.groups,
      sequential: response.plan.looks > 1,
    });
    history.pushState(null, "", routes[locale].analysis + location.hash);
    setTab("analysis");
    window.scrollTo({ top: 0 });
  };
  return (
    <>
      {notice && (
        <div class="notice" role="status">
          <p>{t[notice as UiKey] ?? notice}</p>
          <Button variant="ghost" onClick={() => setNotice("")}>
            {t.close}
          </Button>
        </div>
      )}
      <main class="calculator" data-ready={ready ? "true" : undefined}>
        <div class="page-heading">
          <div>
            <h1>{t[tab]}</h1>
            <p>{tab === "analysis" ? t.introAnalysis : t.introPretest}</p>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              dispatch({ type: "clear" });
              setSeqNotice(false);
              setClearCount((count) => count + 1);
            }}
          >
            {t.clear}
          </Button>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            dispatch({ type: "example", tab });
            track("example_data_loaded", { tab });
          }}
        >
          {t.example}
        </Button>
        {tab === "analysis" && state.plan && (
          <div class="plan-notice">
            <p>
              {t.planFrom}{" "}
              <span class="metric">{fmt.date(state.plan.createdAt)}</span> ·{" "}
              {t.sample}{" "}
              <span class="metric">{fmt.int(state.plan.samplePerVariant)}</span>
            </p>
            {planChanged && (
              <>
                <p class="small-note">{t.planChanged}</p>
                <Button onClick={usePlan} disabled={!response?.plan || busy}>
                  {t.updatePlan}
                </Button>
              </>
            )}
          </div>
        )}
        <div class="calculator-grid">
          <div class="inputs-column">
            {tab === "analysis" ? (
              <>
                <section class="input-section">
                  <h2>{t.duration}</h2>
                  <div class="fields">
                    {field("days", t.days)}
                    {field("trafficPct", t.trafficPct, "%")}
                  </div>
                </section>
                <section class="input-section">
                  <h2>{t.data}</h2>
                  <Groups
                    state={state}
                    dispatch={dispatch}
                    errors={analysis.errors}
                    result={result}
                    fmt={fmt}
                    t={t}
                  />
                </section>
                <section class="input-section">
                  <Settings
                    state={state}
                    dispatch={dispatch}
                    t={t}
                    content={content}
                    context={context}
                    groups={state.analysis.groups.length}
                    frequentist={state.analysis.method === "ztest"}
                  />
                </section>
                <section class="input-section stack">
                  <Toggle
                    label={t.sequential}
                    checked={state.analysis.sequential.enabled}
                    onChange={(enabled) => {
                      setSeqNotice(
                        enabled && state.analysis.method === "bayesian",
                      );
                      dispatch({
                        type: "analysis",
                        patch: {
                          sequential: { ...state.analysis.sequential, enabled },
                        },
                      });
                      track("sequential_toggled", { enabled });
                    }}
                  />
                  {seqNotice && <p class="small-note">{t.sequentialNotice}</p>}
                  {state.analysis.sequential.enabled && (
                    <div class="fields">
                      {state.plan && state.plan.looks > 1 ? (
                        <Stat
                          label={t.looks}
                          value={fmt.int(state.plan.looks)}
                        />
                      ) : (
                        <NumberField
                          id="planned-looks"
                          label={t.plannedLooks}
                          value={state.analysis.sequential.plannedLooks}
                          onInput={(plannedLooks) =>
                            dispatch({
                              type: "analysis",
                              patch: {
                                sequential: {
                                  ...state.analysis.sequential,
                                  plannedLooks,
                                },
                              },
                            })
                          }
                          error={analysis.errors.plannedLooks}
                          t={t}
                        />
                      )}
                      <NumberField
                        id="current-look"
                        label={t.currentLook}
                        value={state.analysis.sequential.currentLook}
                        onInput={(currentLook) =>
                          dispatch({
                            type: "analysis",
                            patch: {
                              sequential: {
                                ...state.analysis.sequential,
                                currentLook,
                              },
                            },
                          })
                        }
                        error={analysis.errors.currentLook}
                        t={t}
                      />
                    </div>
                  )}
                  <Explanation
                    id="peeking-sequential"
                    content={content}
                    context={context}
                    t={t}
                  />
                </section>
              </>
            ) : (
              <>
                <section class="input-section stack">
                  <Segmented
                    label={t.question}
                    value={state.pretest.mode}
                    options={[
                      { value: "mde-by-week", label: t.modeA },
                      { value: "target-lift", label: t.modeB },
                    ]}
                    onChange={(mode) => {
                      updatePretest({ mode });
                      track("pretest_mode_changed", { mode });
                    }}
                  />
                  <div class="fields">
                    {preField("weeklyTraffic", t.weeklyTraffic)}
                    {preField("weeklyConversions", t.weeklyConversions)}
                    {preField("trafficPct", t.trafficPct, "%")}
                    {state.pretest.mode === "target-lift" &&
                      preField("targetLiftPct", t.target, "%")}
                  </div>
                  <Segmented
                    label={t.groups}
                    value={state.pretest.groups}
                    options={[2, 3, 4, 5].map((value) => ({
                      value: groupCount(value),
                      label: String(value),
                    }))}
                    onChange={(groups) => updatePretest({ groups })}
                  />
                  <div class="select-field">
                    <label for="horizon-weeks">{t.horizonWeeks}</label>
                    <select
                      id="horizon-weeks"
                      value={state.pretest.horizonWeeks}
                      onChange={(e) =>
                        updatePretest({
                          horizonWeeks: Number(e.currentTarget.value),
                        })
                      }
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                  {Number(state.pretest.trafficPct.replace(",", ".")) < 10 && (
                    <p class="small-note">{t.lowTraffic}</p>
                  )}
                  <Explanation
                    id="mde-sample"
                    content={content}
                    context={
                      planning?.kind === "ok"
                        ? {
                            ...context,
                            mde: fmt.pct(
                              planning.weeks[
                                (state.pretest.selectedWeek ??
                                  state.pretest.horizonWeeks) - 1
                              ]?.mdeRelative ?? NaN,
                            ),
                          }
                        : context
                    }
                    t={t}
                  />
                </section>
                <section class="input-section">
                  <Settings
                    state={state}
                    dispatch={dispatch}
                    t={t}
                    content={content}
                    context={context}
                    groups={state.pretest.groups}
                    frequentist
                  />
                </section>
                <section class="input-section stack">
                  <Segmented
                    label={t.power}
                    value={state.settings.power}
                    options={[
                      { value: 0.8, label: "80%" },
                      { value: 0.9, label: "90%" },
                    ]}
                    onChange={(power) =>
                      dispatch({ type: "settings", patch: { power } })
                    }
                  />
                  <Segmented
                    label={t.lookPlan}
                    value={state.pretest.looks.kind}
                    options={[
                      { value: "single", label: t.singleLook },
                      { value: "weekly", label: t.weekly },
                      { value: "fixed", label: t.fixedLooks },
                    ]}
                    onChange={(kind) =>
                      updatePretest({
                        looks: kind === "fixed" ? { kind, count: 4 } : { kind },
                      })
                    }
                  />
                  {state.pretest.looks.kind === "fixed" && (
                    <div class="select-field">
                      <label for="look-count">{t.looks}</label>
                      <select
                        id="look-count"
                        value={state.pretest.looks.count}
                        onChange={(e) =>
                          updatePretest({
                            looks: {
                              kind: "fixed",
                              count: Number(e.currentTarget.value),
                            },
                          })
                        }
                      >
                        {Array.from({ length: 11 }, (_, i) => (
                          <option key={i} value={i + 2}>
                            {i + 2}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <Explanation
                    id="peeking-sequential"
                    content={content}
                    context={context}
                    t={t}
                  />
                  <Button
                    variant="primary"
                    disabled={
                      !response?.plan ||
                      pretest.kind !== "ok" ||
                      busy ||
                      !Number.isFinite(response.plan.referenceLift)
                    }
                    onClick={usePlan}
                  >
                    {t.usePlan}
                  </Button>
                </section>
              </>
            )}
          </div>
          <section
            class="results-column"
            id="results"
            role="region"
            aria-label={t.results}
            aria-busy={busy}
          >
            <div class="results-heading">
              <h2>{t.results}</h2>
              {tab === "analysis" && (
                <Segmented
                  label={t.method}
                  value={state.analysis.method}
                  options={[
                    { value: "bayesian", label: t.bayesian },
                    { value: "ztest", label: t.ztest },
                  ]}
                  onChange={(method) => {
                    dispatch({ type: "analysis", patch: { method } });
                    track("method_changed", { method });
                  }}
                />
              )}
            </div>
            {busy && (
              <div class="progress" role="status" aria-label={t.computing} />
            )}
            {error && <p role="alert">{t.computeError}</p>}
            <div class="results-body">
              {tab === "analysis" ? (
                <>
                  {ok ? (
                    <Verdicts
                      result={ok}
                      state={computedState ?? state}
                      content={content}
                      fmt={fmt}
                      t={t}
                      context={context}
                      locale={locale}
                    />
                  ) : (
                    <div class="empty-results">
                      <span class="placeholder">—</span>
                      <p>
                        {result?.kind === "no-conversions"
                          ? t.noConversions
                          : t.empty}
                      </p>
                    </div>
                  )}
                  <section
                    class="result-section"
                    role="region"
                    aria-label={t.alerts}
                  >
                    <h2>{t.alerts}</h2>
                    {ok?.findings.length ? (
                      <Findings
                        findings={ruleFindings(ok.findings, content, fmt)}
                        t={t}
                      />
                    ) : (
                      <p class="small-note">{ok ? t.noAlerts : "—"}</p>
                    )}
                    {ok?.srm.mismatch && (
                      <Explanation
                        id="srm"
                        content={content}
                        context={context}
                        t={t}
                      />
                    )}
                  </section>
                  <TldrBlock
                    key={clearCount}
                    state={state}
                    dispatch={dispatch}
                    input={analysis.kind === "ok" ? analysis.input : null}
                    result={result}
                    locale={locale}
                    content={content}
                    fmt={fmt}
                    t={t}
                    busy={busy}
                  />
                  {ok && (
                    <Suspense fallback={null}>
                      <AnalysisCharts
                        result={ok}
                        fields={(computedState ?? state).analysis}
                        fmt={fmt}
                        t={t}
                        currency={(computedState ?? state).currency}
                      />
                    </Suspense>
                  )}
                  <Explanation
                    id="bayes"
                    content={content}
                    context={context}
                    t={t}
                  />
                  <Explanation
                    id="ztest"
                    content={content}
                    context={context}
                    t={t}
                  />
                  <Explanation
                    id="bayes-vs-z"
                    content={content}
                    context={context}
                    t={t}
                  />
                </>
              ) : (
                <>
                  <PlanningResults
                    result={planning}
                    plan={response?.plan ?? null}
                    fields={state.pretest}
                    select={(selectedWeek) => updatePretest({ selectedWeek })}
                    fmt={fmt}
                    t={t}
                  />
                  {planning?.kind === "ok" && (
                    <Suspense fallback={null}>
                      <MdeChart
                        result={planning}
                        fields={state.pretest}
                        fmt={fmt}
                        t={t}
                      />
                    </Suspense>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
        {tab === "analysis" && (
          <details class="full-details">
            <summary class="section-summary">{t.details}</summary>
            <div class="details-grid">
              <section class="stack">
                {field("referenceLiftPct", t.reference, "%")}
                <Segmented
                  label={t.power}
                  value={state.settings.power}
                  options={[
                    { value: 0.8, label: "80%" },
                    { value: 0.9, label: "90%" },
                  ]}
                  onChange={(power) =>
                    dispatch({ type: "settings", patch: { power } })
                  }
                />
                <h2>{t.revenue}</h2>
                {field("valuePerConversion", t.value)}
                <Segmented
                  label={t.currency}
                  value={state.currency}
                  options={[
                    { value: "BRL", label: "R$" },
                    { value: "USD", label: "$" },
                    { value: "EUR", label: "€" },
                    { value: "GBP", label: "£" },
                    { value: "JPY", label: "¥" },
                  ]}
                  onChange={(currency) =>
                    dispatch({ type: "currency", currency })
                  }
                />
                <Segmented
                  label={t.horizon}
                  value={state.analysis.horizonMonths}
                  options={[
                    { value: 3, label: `3 ${t.months}` },
                    { value: 6, label: `6 ${t.months}` },
                    { value: 12, label: `12 ${t.months}` },
                  ]}
                  onChange={(horizonMonths) =>
                    dispatch({ type: "analysis", patch: { horizonMonths } })
                  }
                />
                {!ok?.revenue && <p class="small-note">{t.revenueMissing}</p>}
              </section>
              <section class="stack">
                {ok?.variants.map((v) => (
                  <div key={v.id}>
                    <h3>
                      {state.analysis.groups.find((g) => g.id === v.id)?.name}
                    </h3>
                    <div class="stats">
                      <Stat
                        label={t.sample}
                        value={fmt.int(v.requiredSamplePerVariant)}
                      />
                      <Stat
                        label={t.achievedMde}
                        value={fmt.pct(v.achievedMde)}
                      />
                      {response?.details?.kind === "ok" && (
                        <Stat
                          label={t.days}
                          value={fmt.int(response.details.targetLift.days)}
                        />
                      )}
                    </div>
                    <dl class="formula-values">
                      {[
                        [
                          `${t.cr} (${state.analysis.groups[0]?.name ?? t.control})`,
                          fmt.pct(ok.groups[0]?.rate ?? NaN),
                        ],
                        [
                          `${t.cr} (${state.analysis.groups.find((g) => g.id === v.id)?.name ?? v.id})`,
                          fmt.pct(
                            ok.groups.find((g) => g.id === v.id)?.rate ?? NaN,
                          ),
                        ],
                        [
                          t.lift,
                          v.ztest.lift === null ? "—" : fmt.pct(v.ztest.lift),
                        ],
                        [t.zscore, fmt.num(v.ztest.z, 4)],
                        [t.pvalue, fmt.pvalue(v.ztest.pValue)],
                        [t.observedPower, fmt.pct(v.ztest.observedPower)],
                        [
                          t.se,
                          fmt.num(
                            ok.groups.find((g) => g.id === v.id)
                              ?.standardError ?? NaN,
                            6,
                          ),
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd class="metric">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p class="small-note">
                      {t.seDiff}{" "}
                      <code>
                        √({fmt.num(ok.groups[0]?.standardError ?? NaN, 6)}² +{" "}
                        {fmt.num(
                          ok.groups.find((g) => g.id === v.id)?.standardError ??
                            NaN,
                          6,
                        )}
                        ²)
                      </code>
                    </p>
                    <p class="small-note">{t.observedCaution}</p>
                    <p class="small-note">{t.approximation}</p>
                  </div>
                ))}
                {response?.details?.kind === "ok" && (
                  <MdeTable
                    result={response.details}
                    fields={state.pretest}
                    fmt={fmt}
                    t={t}
                  />
                )}
              </section>
            </div>
          </details>
        )}
        {(tab === "analysis" ? ok !== null : planning?.kind === "ok") && (
          <button
            type="button"
            class="mobile-result"
            onClick={() =>
              document
                .getElementById("results")
                ?.scrollIntoView({ behavior: "instant" })
            }
          >
            {t.seeResult}
          </button>
        )}
        <span class="sr-only" aria-live="polite">
          {Object.keys(errors).length === 0 && !busy ? t.results : ""}
        </span>
      </main>
      {toast && (
        <div class="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
