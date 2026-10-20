import IconWarning from "~icons/ph/warning";
import type { PretestFields } from "../app/state";
import type { Plan, PretestResult } from "../stats/types";
import type { Ui } from "../i18n/ui";
import type { Formatter } from "../app/format";
import { Stat } from "./controls";

export function MdeTable({
  result,
  fields,
  select,
  fmt,
  t,
  name,
}: {
  result: Extract<PretestResult, { kind: "ok" }>;
  fields: PretestFields;
  select?: (week: number) => void;
  fmt: Formatter;
  t: Ui;
  name?: string;
}) {
  return (
    <div class="table-scroll">
      <table class="data-table" aria-label={name ?? t.mdeTable}>
        <thead>
          <tr>
            <th>{t.week}</th>
            <th>{t.mdeRelative}</th>
            <th>{t.mdeAbsolute}</th>
            <th>{t.visitors}</th>
            <th>
              <span class="sr-only">{t.alerts}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {result.weeks.map((row) => (
            <tr
              key={row.week}
              onClick={select ? () => select(row.week) : undefined}
              aria-selected={
                select
                  ? row.week === (fields.selectedWeek ?? fields.horizonWeeks)
                  : undefined
              }
            >
              <td>
                {select ? (
                  <button
                    type="button"
                    aria-label={`${t.chooseWeek} ${row.week}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      select(row.week);
                    }}
                  >
                    {row.week}
                  </button>
                ) : (
                  row.week
                )}
              </td>
              <td>{fmt.pct(row.mdeRelative)}</td>
              <td>{fmt.pp(row.mdeAbsolute)}</td>
              <td>{fmt.int(row.visitorsPerVariant)}</td>
              <td>
                {row.aboveMdeAlert && (
                  <span class="warning" title={t.above10}>
                    <IconWarning aria-label={t.above10} />
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function PlanningResults({
  result,
  plan,
  fields,
  select,
  fmt,
  t,
}: {
  result: PretestResult | null;
  plan: Plan | null;
  fields: PretestFields;
  select: (week: number) => void;
  fmt: Formatter;
  t: Ui;
}) {
  if (!result)
    return (
      <div class="empty-results">
        <span class="placeholder">—</span>
        <p>{t.introPretest}</p>
      </div>
    );
  if (result.kind === "invalid")
    return (
      <p class="warning">
        {result.reason === "no-conversions"
          ? t.noWeeklyConversions
          : t.liftTooHigh}
      </p>
    );
  return (
    <>
      <div class="stats">
        <Stat label={t.baseline} value={fmt.pct(result.baselineRate)} />
        <Stat
          label={t.confidence}
          value={fmt.pct(result.settings.confidence, 0)}
        />
      </div>
      {fields.mode === "mde-by-week" ? (
        <MdeTable
          result={result}
          fields={fields}
          select={select}
          fmt={fmt}
          t={t}
        />
      ) : (
        <>
          <div class="stats">
            <Stat
              hero
              label={t.sample}
              value={fmt.int(
                result.sequential?.maxSamplePerVariant ??
                  result.targetLift.samplePerVariant,
              )}
            />
            <Stat
              label={t.days}
              value={`${fmt.int(plan?.days ?? result.targetLift.days)} ${t.dayUnit}`}
              note={`${fmt.num((plan?.days ?? result.targetLift.days) / 7, 1)} ${t.weeks}`}
            />
          </div>
          <p class="small-note">{t.roundWeeks}</p>
        </>
      )}
      {result.alerts.map((alert) => (
        <p class="warning" key={alert.kind}>
          <IconWarning aria-hidden="true" class="inline size-4" /> {t.warning}.{" "}
          {alert.kind === "all-weeks-above-mde"
            ? t.largeEffects
            : alert.kind === "duration-over-12-weeks"
              ? t.longPlan
              : t.shortPlan}
        </p>
      ))}
      {result.sequential && (
        <section class="result-section">
          <h3>{t.boundaries}</h3>
          <div class="stats">
            <Stat
              label={t.maxSample}
              value={fmt.int(result.sequential.maxSamplePerVariant)}
            />
            <Stat
              label={t.inflation}
              value={fmt.num(result.sequential.inflationFactor, 4)}
            />
          </div>
          <div class="table-scroll">
            <table aria-label={t.boundaries} class="data-table">
              <thead>
                <tr>
                  <th>{t.look}</th>
                  <th>{t.visitors}</th>
                  <th>{t.boundary}</th>
                  <th>{t.nominalP}</th>
                </tr>
              </thead>
              <tbody>
                {result.sequential.boundaries.map((row) => (
                  <tr key={row.look}>
                    <td>{row.look}</td>
                    <td>{fmt.int(row.visitorsPerVariant)}</td>
                    <td>{fmt.num(row.zBoundary, 4)}</td>
                    <td>{fmt.pvalue(row.nominalP)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
