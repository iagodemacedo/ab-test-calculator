import { useEffect, useRef, useState } from "preact/hooks";
import IconSparkle from "~icons/ph/sparkle";
import IconWarning from "~icons/ph/warning";
import type { Action, AppState } from "../app/state";
import type { AnalysisInput, AnalysisResult, Locale } from "../stats/types";
import type { ContentPack } from "../i18n/content/types";
import type { Formatter } from "../app/format";
import type { Ui } from "../i18n/ui";
import { parseTldrResponse, turnstileToken } from "../app/tldr";
import { toTldrRequest } from "../shared/tldr-request";
import { track } from "../app/analytics";
import { Button } from "./controls";
import { Findings, ruleFindings } from "./findings";

type Generation = "idle" | "generating" | "fallback" | "daily-limit";
export function TldrBlock({
  state,
  dispatch,
  input,
  result,
  locale,
  content,
  fmt,
  t,
  busy,
}: {
  state: AppState;
  dispatch: (action: Action) => void;
  input: AnalysisInput | null;
  result: AnalysisResult | null;
  locale: Locale;
  content: ContentPack;
  fmt: Formatter;
  t: Ui;
  busy: boolean;
}) {
  const [generation, setGeneration] = useState<Generation>("idle");
  const widget = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const rules =
    result?.kind === "ok" ? ruleFindings(result.findings, content, fmt) : [];
  const stale = Boolean(
    state.tldr &&
      (busy ||
        result?.kind !== "ok" ||
        state.tldr.inputHash !== result.inputHash),
  );
  const generate = async () => {
    if (
      !input ||
      result?.kind !== "ok" ||
      busy ||
      !widget.current ||
      generation === "generating"
    )
      return;
    const current = new AbortController();
    controller.current = current;
    const timer = setTimeout(() => current.abort(), 20000);
    let dispose = () => {};
    setGeneration("generating");
    track("tldr_requested", { locale });
    try {
      const verification = await Promise.race([
        turnstileToken(
          widget.current,
          import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? "",
          current.signal,
        ),
        new Promise<never>((_, reject) =>
          current.signal.addEventListener(
            "abort",
            () => reject(new Error("timeout")),
            { once: true },
          ),
        ),
      ]);
      dispose = verification.dispose;
      const response = await fetch("/api/tldr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          toTldrRequest(
            result,
            input,
            state.settings,
            locale,
            verification.token,
          ),
        ),
        signal: current.signal,
      });
      const value: unknown = await response.json();
      if (!response.ok) {
        if (
          response.status === 429 &&
          typeof value === "object" &&
          value !== null &&
          "error" in value &&
          value.error === "daily_limit"
        ) {
          setGeneration("daily-limit");
          track("tldr_result", { result: "rate_limit" });
          return;
        }
        throw new Error("api_failed");
      }
      const tldr = parseTldrResponse(value, rules, result.inputHash, locale);
      if (!tldr) throw new Error("invalid_response");
      dispatch({ type: "tldr", tldr });
      setGeneration("idle");
      track("tldr_result", { result: "success" });
    } catch {
      setGeneration("fallback");
      track("tldr_result", { result: "fallback" });
    } finally {
      clearTimeout(timer);
      dispose();
      controller.current = null;
    }
  };
  return (
    <section
      class="tldr-block"
      role="region"
      aria-label="TL;DR"
      aria-busy={generation === "generating"}
    >
      <h2>TL;DR</h2>
      {state.tldr &&
      generation !== "fallback" &&
      generation !== "daily-limit" ? (
        <div class={stale ? "stale-content" : ""}>
          <p class="tldr-text" lang={state.tldr.locale}>
            {state.tldr.tldr}
          </p>
          <Findings findings={state.tldr.findings} t={t} />
          <p class="tldr-meta">
            {t.generated} {fmt.date(state.tldr.generatedAt)} · {t.generatedIn}{" "}
            {state.tldr.locale.toUpperCase()}
          </p>
        </div>
      ) : generation === "fallback" || generation === "daily-limit" ? (
        <>
          <p class="warning">
            <IconWarning aria-hidden="true" class="inline size-4" />{" "}
            {generation === "daily-limit" ? t.dailyLimit : t.fallback}
          </p>
          <Findings findings={rules} t={t} />
        </>
      ) : (
        <p>{t.tldrIntro}</p>
      )}
      {generation === "generating" && <div class="progress" />}
      <div class="tldr-actions">
        {stale && <span class="badge">{t.stale}</span>}
        <Button
          variant="primary"
          disabled={
            !input ||
            result?.kind !== "ok" ||
            busy ||
            generation === "generating"
          }
          onClick={() => void generate()}
        >
          <IconSparkle aria-hidden="true" />
          {generation === "generating"
            ? t.generating
            : state.tldr
              ? t.regenerate
              : t.generate}
        </Button>
      </div>
      <div ref={widget} />
    </section>
  );
}
