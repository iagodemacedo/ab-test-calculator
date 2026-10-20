import { useState } from "preact/hooks";
import { GROUP_IDS } from "../stats/types";
import type { AnalysisFields, PretestFields } from "../app/state";
import type {
  AnalysisResult,
  Currency,
  GroupId,
  PretestResult,
} from "../stats/types";
import type { Formatter } from "../app/format";
import type { Ui } from "../i18n/ui";
import { Button } from "./controls";
import { DistributionCharts } from "./distributions";

type Series = { id: GroupId; name: string; points: { x: number; y: number }[] };
const color = (id: GroupId) => `var(--series-${GROUP_IDS.indexOf(id) + 1})`;
const W = 600,
  H = 260,
  L = 64,
  R = 28,
  T = 24,
  B = 40;
export function LineChart({
  title,
  series,
  xLabel,
  formatX,
  formatY,
  t,
  warningLine,
  selectedX,
}: {
  title: string;
  series: Series[];
  xLabel: string;
  formatX: (n: number) => string;
  formatY: (n: number) => string;
  t: Ui;
  warningLine?: number;
  selectedX?: number;
}) {
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const points = series
    .flatMap((s) => s.points)
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!points.length) return null;
  const minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(0, ...points.map((p) => p.y));
  const top = Math.max(warningLine ?? 0, ...points.map((p) => p.y), 0.0001);
  const roughStep = (top - minY) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step =
    ([1, 2, 2.5, 5, 10].find((n) => n * magnitude >= roughStep) ?? 10) *
    magnitude;
  const maxY =
    warningLine === undefined ? top * 1.12 : Math.ceil(top / step) * step;
  const yTicks =
    warningLine === undefined
      ? [0, 1, 2, 3, 4].map((i) => minY + ((maxY - minY) * i) / 4)
      : Array.from({ length: Math.round(maxY / step) + 1 }, (_, i) => i * step);
  const x = (v: number) => L + ((v - minX) / (maxX - minX || 1)) * (W - L - R);
  const y = (v: number) => H - B - ((v - minY) / (maxY - minY)) * (H - B - T);
  const xs = [...new Set(points.map((p) => p.x))].sort((a, b) => a - b);
  return (
    <figure class="chart-frame">
      <h3>{title}</h3>
      <div class="chart-legend">
        {series.map((s) => (
          <span key={s.id}>
            <i
              class="series-marker"
              style={{ background: color(s.id) }}
              aria-hidden="true"
            />
            {s.name}
          </span>
        ))}
      </div>
      {table ? (
        <div class="table-scroll">
          <table class="data-table" aria-label={title}>
            <thead>
              <tr>
                <th>{xLabel}</th>
                {series.map((s) => (
                  <th key={s.id}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {xs.map((value) => (
                <tr key={value}>
                  <td>{formatX(value)}</td>
                  {series.map((s) => (
                    <td key={s.id}>
                      {formatY(s.points.find((p) => p.x === value)?.y ?? NaN)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={title}
            onMouseLeave={() => setHover(null)}
          >
            {warningLine !== undefined && (
              <>
                <rect
                  x={L}
                  y={T}
                  width={W - L - R}
                  height={Math.max(0, y(warningLine) - T)}
                  fill="var(--warning)"
                  opacity="0.08"
                />
                <line
                  x1={L}
                  x2={W - R}
                  y1={y(warningLine)}
                  y2={y(warningLine)}
                  stroke="var(--muted)"
                  stroke-dasharray="4 4"
                />
                <text x={W - R} y={T + 16} text-anchor="end">
                  {t.above10}
                </text>
              </>
            )}
            {yTicks.map((value, i) => {
              return (
                <g key={i}>
                  <line
                    x1={L}
                    x2={W - R}
                    y1={y(value)}
                    y2={y(value)}
                    stroke="var(--rule)"
                  />
                  <text x={L - 8} y={y(value) + 4} text-anchor="end">
                    {formatY(value)}
                  </text>
                </g>
              );
            })}
            {series.map((s) => {
              const valid = s.points.filter((p) => Number.isFinite(p.y));
              return (
                <g key={s.id}>
                  <path
                    d={valid
                      .map(
                        (p, i) => `${i === 0 ? "M" : "L"}${x(p.x)},${y(p.y)}`,
                      )
                      .join(" ")}
                    fill="none"
                    stroke={color(s.id)}
                    stroke-width="2"
                    stroke-linejoin="miter"
                  />
                  {valid.map((p) => (
                    <rect
                      key={p.x}
                      x={x(p.x) - 4}
                      y={y(p.y) - 4}
                      width="8"
                      height="8"
                      fill={color(s.id)}
                      stroke="var(--background)"
                      stroke-width={p.x === selectedX ? 0 : 2}
                    />
                  ))}
                  {series.length <= 4 && valid.length > 0 && (
                    <text
                      class="direct-label"
                      x={x(valid[valid.length - 1]?.x ?? 0) - 4}
                      y={y(valid[valid.length - 1]?.y ?? 0) - 10}
                      text-anchor="end"
                    >
                      {s.name}
                    </text>
                  )}
                </g>
              );
            })}
            {hover !== null && (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={T}
                y2={H - B}
                stroke="var(--muted)"
              />
            )}
            {xs.map((value) => (
              <g key={value}>
                <text x={x(value)} y={H - 20} text-anchor="middle">
                  {formatX(value)}
                </text>
                <rect
                  x={x(value) - Math.max(12, (W - L - R) / xs.length / 2)}
                  y={T}
                  width={Math.max(24, (W - L - R) / xs.length)}
                  height={H - B - T}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${formatX(value)}. ${series.map((s) => `${s.name} ${formatY(s.points.find((p) => p.x === value)?.y ?? NaN)}`).join(". ")}`}
                  onMouseEnter={() => setHover(value)}
                  onFocus={() => setHover(value)}
                  onBlur={() => setHover(null)}
                />
              </g>
            ))}
            <text x={W - R} y={H - 2} text-anchor="end">
              {xLabel}
            </text>
          </svg>
          {hover !== null && (
            <div class="chart-tooltip" aria-live="polite">
              {xLabel} {formatX(hover)} ·{" "}
              {series
                .map(
                  (s) =>
                    `${s.name} ${formatY(s.points.find((p) => p.x === hover)?.y ?? NaN)}`,
                )
                .join(" · ")}
            </div>
          )}
        </>
      )}
      <Button
        variant="ghost"
        onClick={() => setTable(!table)}
        aria-expanded={table}
      >
        {table ? t.chart : t.table}
      </Button>
    </figure>
  );
}
export function MdeChart({
  result,
  fields,
  fmt,
  t,
}: {
  result: Extract<PretestResult, { kind: "ok" }>;
  fields: PretestFields;
  fmt: Formatter;
  t: Ui;
}) {
  return (
    <LineChart
      title={t.mdeChart}
      series={[
        {
          id: "A",
          name: t.mdeRelative,
          points: result.weeks.map((row) => ({
            x: row.week,
            y: row.mdeRelative,
          })),
        },
      ]}
      xLabel={t.week}
      formatX={fmt.int}
      formatY={(n) => fmt.pct(n, Number.isInteger(n * 100) ? 0 : 1)}
      warningLine={0.1}
      selectedX={fields.selectedWeek ?? fields.horizonWeeks}
      t={t}
    />
  );
}
export function AnalysisCharts({
  result,
  fields,
  fmt,
  t,
  currency,
}: {
  currency: Currency;
  result: Extract<AnalysisResult, { kind: "ok" }>;
  fields: AnalysisFields;
  fmt: Formatter;
  t: Ui;
}) {
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const intervals = result.variants.map((v) => ({
    id: v.id,
    name: fields.groups.find((g) => g.id === v.id)?.name ?? v.id,
    interval:
      fields.method === "bayesian"
        ? v.bayes.credibleIntervalRelative
        : v.ztest.ciRelative,
    lift: v.ztest.lift,
  }));
  const finiteBounds = intervals
    .flatMap((v) => [...(v.interval ?? []), v.lift ?? 0])
    .filter(Number.isFinite);
  const min = Math.min(0, ...finiteBounds),
    max = Math.max(0.01, ...finiteBounds),
    padding = (max - min) * 0.15;
  const x = (n: number) =>
    L + ((n - min + padding) / (max - min + padding * 2)) * (W - L - R);
  const ticks = [min, 0, max]
    .filter((value, i, values) => values.indexOf(value) === i)
    .filter((value) => value === 0 || Math.abs(x(value) - x(0)) >= 72);
  return (
    <>
      <DistributionCharts result={result} fields={fields} fmt={fmt} t={t} />
      <figure class="chart-frame">
        <h3>{t.intervalsChart}</h3>
        <div class="chart-legend">
          {intervals.map((v) => (
            <span key={v.id}>
              <i
                class="series-marker"
                style={{ background: color(v.id) }}
                aria-hidden="true"
              />
              {v.name}
            </span>
          ))}
        </div>
        {table ? (
          <div class="table-scroll">
            <table class="data-table" aria-label={t.intervalsChart}>
              <thead>
                <tr>
                  <th>{t.group}</th>
                  <th>{t.lift}</th>
                  <th>{t.interval}</th>
                </tr>
              </thead>
              <tbody>
                {intervals.map((v) => (
                  <tr key={v.id}>
                    <td>{v.name}</td>
                    <td>{v.lift === null ? "—" : fmt.pct(v.lift)}</td>
                    <td>
                      {v.interval
                        ? `${fmt.pct(v.interval[0])} … ${Number.isFinite(v.interval[1]) ? fmt.pct(v.interval[1]) : "∞"}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${70 + intervals.length * 48}`}
            role="img"
            aria-label={t.intervalsChart}
          >
            <line
              x1={x(0)}
              x2={x(0)}
              y1={12}
              y2={24 + intervals.length * 48}
              stroke="var(--muted)"
              stroke-dasharray="4 4"
            />
            {ticks.map((n) => (
              <text
                key={n}
                x={x(n)}
                y={50 + intervals.length * 48}
                text-anchor="middle"
              >
                {fmt.pct(n, 1)}
              </text>
            ))}
            {intervals.map((v, i) => (
              <g key={v.id}>
                <text x={L} y={20 + i * 48} class="direct-label">
                  {v.name}
                </text>
                {v.interval ? (
                  <>
                    <rect
                      x={x(v.interval[0])}
                      y={30 + i * 48}
                      width={Math.max(
                        1,
                        x(
                          Number.isFinite(v.interval[1])
                            ? v.interval[1]
                            : max + padding,
                        ) - x(v.interval[0]),
                      )}
                      height="8"
                      fill={color(v.id)}
                      fill-opacity="0.18"
                      stroke={color(v.id)}
                      stroke-width="2"
                    />
                    {v.lift !== null && (
                      <rect
                        x={x(v.lift) - 4}
                        y={30 + i * 48}
                        width="8"
                        height="8"
                        fill={color(v.id)}
                      />
                    )}
                  </>
                ) : (
                  <text x={L} y={40 + i * 48}>
                    —
                  </text>
                )}
                <rect
                  x={L}
                  y={24 + i * 48}
                  width={W - L - R}
                  height="24"
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${v.name}, ${t.interval} ${v.interval ? v.interval.map((n) => (Number.isFinite(n) ? fmt.pct(n) : "∞")).join(" … ") : "—"}`}
                  onMouseEnter={() => setHover(v.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(v.id)}
                  onBlur={() => setHover(null)}
                />
              </g>
            ))}
          </svg>
        )}
        {hover && (
          <div class="chart-tooltip">
            {intervals
              .filter((v) => v.id === hover)
              .map(
                (v) =>
                  `${v.name} ${v.interval ? v.interval.map((n) => (Number.isFinite(n) ? fmt.pct(n) : "∞")).join(" … ") : "—"}`,
              )}
          </div>
        )}
        <Button
          variant="ghost"
          onClick={() => setTable(!table)}
          aria-expanded={table}
        >
          {table ? t.chart : t.table}
        </Button>
      </figure>
      {result.revenue && (
        <LineChart
          title={t.revenueChart}
          series={result.revenue.forecast.map((s) => ({
            id: s.id,
            name: fields.groups.find((g) => g.id === s.id)?.name ?? s.id,
            points: s.months.map((amount, i) => ({ x: i + 1, y: amount })),
          }))}
          xLabel={t.month}
          formatX={fmt.int}
          formatY={(n) => fmt.currency(n, currency)}
          t={t}
        />
      )}
    </>
  );
}
