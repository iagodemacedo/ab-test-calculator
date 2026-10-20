import { useState } from "preact/hooks";
import type { AnalysisResult, GroupId } from "../stats/types";
import { GROUP_IDS } from "../stats/types";
import type { AnalysisFields } from "../app/state";
import type { Formatter } from "../app/format";
import type { Ui } from "../i18n/ui";
import { Button } from "./controls";

type DensitySeries = {
  id: GroupId;
  name: string;
  points: { x: number; y: number }[];
  interval: [number, number] | null;
  mass: number | null;
};
const W = 600,
  H = 280,
  L = 64,
  R = 24,
  T = 32,
  B = 48;
const color = (id: GroupId) => `var(--series-${GROUP_IDS.indexOf(id) + 1})`;

function DensityChart({
  title,
  axis,
  series,
  stepped,
  fmt,
  t,
}: {
  title: string;
  axis: string;
  series: DensitySeries[];
  stepped: boolean;
  fmt: Formatter;
  t: Ui;
}) {
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const points = series.flatMap((s) => s.points);
  if (!points.length)
    return (
      <p class="small-note">
        {title} · {t.noDensity}
      </p>
    );
  const lo = Math.min(...points.map((p) => p.x));
  const hi = Math.max(...points.map((p) => p.x));
  const peak = Math.max(...points.map((p) => p.y), 0.0001) * 1.12;
  const x = (n: number) => L + ((n - lo) / (hi - lo || 1)) * (W - L - R);
  const y = (n: number) => H - B - (n / peak) * (H - B - T);
  const xs = series[0]?.points.map((p) => p.x) ?? [];
  const nearest = (value: number) =>
    xs.reduce(
      (best, n, i) =>
        Math.abs(n - value) < Math.abs((xs[best] ?? lo) - value) ? i : best,
      0,
    );
  const path = (s: DensitySeries) =>
    s.points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : stepped ? "H" : "L"}${x(p.x)}${i > 0 && stepped ? `V${y(p.y)}` : `,${y(p.y)}`}`,
      )
      .join(" ");
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + ((hi - lo) * i) / 4);
  const positive = series.some((s) => s.mass !== null);
  const clip = title === t.crChart ? "cr-density" : "lift-density";
  const formatX = (n: number) => fmt.pct(n, positive ? 1 : 2);
  const exactX = (n: number) => fmt.pct(n, 4);
  return (
    <figure class="chart-frame density-chart">
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
            {s.mass === null
              ? ""
              : ` · ${t.massAboveZero} ${fmt.pct(s.mass, 1)}`}
          </span>
        ))}
      </div>
      <p class="small-note">{positive ? t.positiveShade : t.intervalShade}</p>
      {table ? (
        <div class="table-scroll">
          <table class="data-table" aria-label={title}>
            <caption>
              {series
                .map(
                  (s) =>
                    `${s.name} · ${s.interval ? `${t.rateInterval} ${s.interval.map(exactX).join(" … ")}` : `${t.massAboveZero} ${s.mass === null ? "—" : fmt.pct(s.mass, 1)}`}`,
                )
                .join(". ")}
            </caption>
            <thead>
              <tr>
                <th>{axis}</th>
                {series.map((s) => (
                  <th key={s.id}>
                    {s.name} · {t.density}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {xs.map((n, i) =>
                stepped && i % 2 !== 0 ? null : (
                  <tr key={i}>
                    <td>
                      {exactX(n)}
                      {stepped ? ` … ${exactX(xs[i + 1] ?? n)}` : ""}
                    </td>
                    {series.map((s) => (
                      <td key={s.id}>{fmt.num(s.points[i]?.y ?? NaN, 4)}</td>
                    ))}
                  </tr>
                ),
              )}
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
            <defs>
              {series.map((s) => {
                const start = s.interval?.[0] ?? Math.max(0, lo);
                const end = s.interval?.[1] ?? hi;
                return (
                  <clipPath id={`${clip}-${s.id}`} key={s.id}>
                    <rect
                      x={x(Math.max(lo, start))}
                      y={T}
                      width={Math.max(
                        0,
                        x(Math.min(hi, end)) - x(Math.max(lo, start)),
                      )}
                      height={H - B - T}
                    />
                  </clipPath>
                );
              })}
            </defs>
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i}>
                <line
                  x1={L}
                  x2={W - R}
                  y1={y((peak * i) / 4)}
                  y2={y((peak * i) / 4)}
                  stroke="var(--rule)"
                />
                <text x={L - 8} y={y((peak * i) / 4) + 4} text-anchor="end">
                  {fmt.num((peak * i) / 4, peak > 10 ? 0 : 1)}
                </text>
              </g>
            ))}
            <text x={L} y={16}>
              {t.density}
            </text>
            {series.map((s, index) => (
              <g key={s.id}>
                <path
                  d={`${path(s)} L${x(hi)},${y(0)} L${x(lo)},${y(0)} Z`}
                  fill={color(s.id)}
                  fill-opacity="0.18"
                  clip-path={`url(#${clip}-${s.id})`}
                />
                <path
                  d={path(s)}
                  fill="none"
                  stroke={color(s.id)}
                  stroke-width="2"
                  stroke-linejoin="miter"
                />
                {series.length <= 4 &&
                  (() => {
                    const floor = Math.max(...s.points.map((p) => p.y)) * 0.22;
                    const end = s.points.findLast((p) => p.y >= floor);
                    return end ? (
                      <text
                        class="direct-label"
                        x={Math.min(W - R, x(end.x) + 8)}
                        y={Math.max(T + 12, y(end.y) - 8 - index * 14)}
                        text-anchor="end"
                      >
                        {s.name}
                      </text>
                    ) : null;
                  })()}
                {s.interval?.map((bound) => (
                  <line
                    key={bound}
                    x1={x(bound)}
                    x2={x(bound)}
                    y1={y(0) - 8}
                    y2={y(0)}
                    stroke={color(s.id)}
                    stroke-width="2"
                  />
                ))}
              </g>
            ))}
            {positive && lo <= 0 && hi >= 0 && (
              <line
                x1={x(0)}
                x2={x(0)}
                y1={T}
                y2={H - B}
                stroke="var(--muted)"
                stroke-dasharray="4 4"
              />
            )}
            {ticks.map((n) => (
              <text key={n} x={x(n)} y={H - B + 20} text-anchor="middle">
                {formatX(n)}
              </text>
            ))}
            <text x={W - R} y={H - 4} text-anchor="end">
              {axis}
            </text>
            {hover !== null && (
              <line
                x1={x(xs[hover] ?? lo)}
                x2={x(xs[hover] ?? lo)}
                y1={T}
                y2={H - B}
                stroke="var(--muted)"
              />
            )}
            <rect
              x={L}
              y={T}
              width={W - L - R}
              height={H - B - T}
              fill="transparent"
              tabIndex={0}
              role="slider"
              aria-label={`${title} · ${axis}`}
              aria-valuemin={lo}
              aria-valuemax={hi}
              aria-valuenow={xs[hover ?? 0] ?? lo}
              aria-valuetext={formatX(xs[hover ?? 0] ?? lo)}
              onMouseMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                setHover(
                  nearest(
                    lo +
                      ((event.clientX - bounds.left) / bounds.width) *
                        (hi - lo),
                  ),
                );
              }}
              onFocus={() => setHover(0)}
              onBlur={() => setHover(null)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                setHover(
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? xs.length - 1
                      : Math.max(
                          0,
                          Math.min(
                            xs.length - 1,
                            (hover ?? 0) +
                              (event.key === "ArrowRight" ? 1 : -1),
                          ),
                        ),
                );
              }}
            />
          </svg>
          {hover !== null && (
            <div class="chart-tooltip" aria-live="polite">
              {axis} {formatX(xs[hover] ?? lo)} ·{" "}
              {series
                .map(
                  (s) => `${s.name} ${fmt.num(s.points[hover]?.y ?? NaN, 4)}`,
                )
                .join(" · ")}
            </div>
          )}
          {series.length <= 4 && (
            <div class="density-labels">
              {series.map((s) => (
                <span key={s.id}>
                  <i
                    class="series-marker"
                    style={{ background: color(s.id) }}
                    aria-hidden="true"
                  />
                  {s.name}
                  {s.interval ? ` · ${s.interval.map(exactX).join(" … ")}` : ""}
                </span>
              ))}
            </div>
          )}
        </>
      )}
      <Button
        variant="ghost"
        onClick={() => {
          setTable(!table);
          setHover(null);
        }}
        aria-expanded={table}
      >
        {table ? t.chart : t.table}
      </Button>
    </figure>
  );
}

export function DistributionCharts({
  result,
  fields,
  fmt,
  t,
}: {
  result: Extract<AnalysisResult, { kind: "ok" }>;
  fields: AnalysisFields;
  fmt: Formatter;
  t: Ui;
}) {
  const name = (id: GroupId) =>
    fields.groups.find((g) => g.id === id)?.name ?? id;
  const rate = result.distributions.rate;
  const lift = result.distributions.lift;
  const bayes = result.governingMethod === "bayesian";
  const rates = rate.groups.flatMap((group): DensitySeries[] => {
    const curve = bayes ? group.bayes : group.ztest;
    return curve
      ? [
          {
            id: group.id,
            name: name(group.id),
            interval: curve.interval,
            mass: null,
            points: rate.x.map((x, i) => ({ x, y: curve.density[i] ?? 0 })),
          },
        ]
      : [];
  });
  const lifts =
    lift?.variants.flatMap((group): DensitySeries[] => {
      const curve = bayes ? group.bayes : group.ztest;
      return curve
        ? [
            {
              id: group.id,
              name: name(group.id),
              interval: null,
              mass: curve.massAboveZero,
              points: curve.density.flatMap((y, i) => {
                const start = lift.edges[i],
                  end = lift.edges[i + 1];
                if (start === undefined || end === undefined) return [];
                return bayes
                  ? [
                      { x: start, y },
                      { x: end, y },
                    ]
                  : [{ x: (start + end) / 2, y }];
              }),
            },
          ]
        : [];
    }) ?? [];
  return (
    <>
      <DensityChart
        title={t.crChart}
        axis={t.cr}
        series={rates}
        stepped={false}
        fmt={fmt}
        t={t}
      />
      {rate.groups.some((group) => !bayes && !group.ztest) && (
        <p class="small-note">{t.noDensity}</p>
      )}
      {lift ? (
        <DensityChart
          title={t.liftChart}
          axis={t.lift}
          series={lifts}
          stepped={bayes}
          fmt={fmt}
          t={t}
        />
      ) : (
        <p class="small-note">{t.zeroControl}</p>
      )}
    </>
  );
}
