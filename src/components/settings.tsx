import type { Action, AppState } from "../app/state";
import type { ContentPack, ExplanationContext } from "../i18n/content/types";
import type { Ui } from "../i18n/ui";
import { Segmented, Toggle } from "./controls";
import { Explanation } from "./explanation";
export function Settings({
  state,
  dispatch,
  t,
  content,
  context,
  groups,
  frequentist,
}: {
  state: AppState;
  dispatch: (action: Action) => void;
  t: Ui;
  content: ContentPack;
  context: ExplanationContext;
  groups: number;
  frequentist: boolean;
}) {
  return (
    <div class="settings">
      <Segmented
        label={t.confidence}
        value={state.settings.confidence}
        options={[
          { value: 0.9, label: "90%" },
          { value: 0.95, label: "95%" },
          { value: 0.99, label: "99%" },
        ]}
        onChange={(confidence) =>
          dispatch({ type: "settings", patch: { confidence } })
        }
      />
      {frequentist && (
        <>
          <Segmented
            label={t.hypothesis}
            value={state.settings.hypothesis}
            options={[
              { value: "two-sided", label: t.twoSided },
              { value: "one-sided", label: t.oneSided },
            ]}
            onChange={(hypothesis) =>
              dispatch({ type: "settings", patch: { hypothesis } })
            }
          />
          <Explanation
            id="hypothesis"
            content={content}
            context={context}
            t={t}
          />
          {groups > 2 && (
            <>
              <Toggle
                label={t.bonferroni}
                checked={state.settings.bonferroni}
                onChange={(bonferroni) =>
                  dispatch({ type: "settings", patch: { bonferroni } })
                }
              />
              <Explanation
                id="bonferroni"
                content={content}
                context={context}
                t={t}
              />
            </>
          )}
        </>
      )}
      <Explanation
        id="confidence-power"
        content={content}
        context={context}
        t={t}
      />
    </div>
  );
}
