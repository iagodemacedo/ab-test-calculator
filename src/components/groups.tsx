import IconPlus from "~icons/ph/plus";
import IconX from "~icons/ph/x";
import { GROUP_IDS } from "../stats/types";
import type { AnalysisResult } from "../stats/types";
import type { Action, AppState } from "../app/state";
import type { FieldError } from "../app/parse";
import type { Formatter } from "../app/format";
import type { Ui } from "../i18n/ui";
import { Button, NumberField } from "./controls";
import { track } from "../app/analytics";

export function Groups({
  state,
  dispatch,
  errors,
  result,
  fmt,
  t,
}: {
  state: AppState;
  dispatch: (action: Action) => void;
  errors: Record<string, FieldError>;
  result: AnalysisResult | null;
  fmt: Formatter;
  t: Ui;
}) {
  return (
    <>
      <table class="group-table" aria-label={t.data}>
        <thead>
          <tr>
            <th scope="col">{t.group}</th>
            <th scope="col">{t.users}</th>
            <th scope="col">{t.conversions}</th>
            <th scope="col">{t.split} %</th>
            <th scope="col">
              <span class="sr-only">{t.remove}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {state.analysis.groups.map((g) => {
            const stat =
              result?.kind === "ok"
                ? result.groups.find((s) => s.id === g.id)
                : undefined;
            const variant =
              result?.kind === "ok"
                ? result.variants.find((v) => v.id === g.id)
                : undefined;
            return (
              <tr key={g.id}>
                <td>
                  <div class="group-name">
                    <span
                      class="series-marker"
                      style={{
                        background: `var(--series-${GROUP_IDS.indexOf(g.id) + 1})`,
                      }}
                      aria-hidden="true"
                    />
                    <input
                      aria-label={`${t.groupName} ${g.id}`}
                      value={g.name}
                      maxLength={40}
                      onInput={(e) =>
                        dispatch({
                          type: "group",
                          id: g.id,
                          patch: { name: e.currentTarget.value },
                        })
                      }
                    />
                  </div>
                  <div class="group-output">
                    <p>
                      {t.cr}{" "}
                      <span class="metric">
                        {stat ? fmt.pct(stat.rate) : "—"}
                      </span>
                    </p>
                    {variant && (
                      <>
                        <p>
                          {t.lift}{" "}
                          <span class="metric">
                            {variant.ztest.lift === null
                              ? "—"
                              : fmt.pct(variant.ztest.lift)}
                          </span>
                        </p>
                        <p>
                          {state.analysis.method === "bayesian"
                            ? t.probability
                            : t.pvalue}{" "}
                          <span class="metric">
                            {state.analysis.method === "bayesian"
                              ? fmt.pct(
                                  variant.bayes.probabilityToBeatControl,
                                  1,
                                )
                              : fmt.pvalue(variant.ztest.pValue)}
                          </span>
                        </p>
                      </>
                    )}
                  </div>
                </td>
                {(["users", "conversions", "splitPct"] as const).map(
                  (field) => (
                    <td key={field}>
                      <NumberField
                        compact
                        id={`${g.id}-${field}`}
                        label={`${field === "users" ? t.users : field === "conversions" ? t.conversions : t.split} (${g.name})`}
                        value={g[field]}
                        onInput={(value) =>
                          dispatch({
                            type: "group",
                            id: g.id,
                            patch: { [field]: value },
                          })
                        }
                        error={
                          g[field] ? errors[`${g.id}.${field}`] : undefined
                        }
                        unit={field === "splitPct" ? "%" : undefined}
                        t={t}
                      />
                    </td>
                  ),
                )}
                <td class="remove-cell">
                  {g.id !== "A" && state.analysis.groups.length > 2 && (
                    <button
                      class="remove-group"
                      type="button"
                      aria-label={`${t.remove} ${g.name}`}
                      onClick={() =>
                        dispatch({ type: "remove-variant", id: g.id })
                      }
                    >
                      <IconX aria-hidden="true" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {errors.split && <p class="field-error">{t.splitError}</p>}
      {state.analysis.groups.length < 5 && (
        <Button
          variant="ghost"
          onClick={() => {
            dispatch({ type: "add-variant" });
            track("variant_added", {
              groups: state.analysis.groups.length + 1,
            });
          }}
        >
          <IconPlus aria-hidden="true" />
          {t.add}
        </Button>
      )}
    </>
  );
}
