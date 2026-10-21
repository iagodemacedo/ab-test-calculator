import type { Locale, Tldr, TldrFinding } from "../stats/types";
import { parseFindings } from "./codec";

export function parseTldrResponse(
  value: unknown,
  rules: TldrFinding[],
  hash: string,
  locale: Locale,
): Tldr | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("tldr" in value) ||
    typeof value.tldr !== "string" ||
    value.tldr.length === 0 ||
    value.tldr.length > 16000 ||
    !("findings" in value)
  )
    return null;
  const findings = parseFindings(value.findings);
  if (!findings) return null;
  const returned = findings.filter(
    (f) => f.source === "ai" || rules.some((rule) => rule.ruleId === f.ruleId),
  );
  for (const finding of returned) {
    if (finding.source === "rule") {
      const rule = rules.find((rule) => rule.ruleId === finding.ruleId);
      if (rule) finding.title = rule.title;
    }
  }
  const remaining = returned.filter((finding) => finding.source === "rule");
  for (const rule of rules) {
    const index = remaining.findIndex(
      (finding) => finding.ruleId === rule.ruleId,
    );
    if (index < 0) returned.push(rule);
    else remaining.splice(index, 1);
  }
  return {
    tldr: value.tldr,
    findings: returned,
    inputHash: hash,
    locale,
    generatedAt: new Date().toISOString(),
  };
}
interface Turnstile {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      theme: "auto";
      size: "flexible";
    },
  ) => string;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
let loading: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!loading)
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loading = null;
        script.remove();
        reject(new Error("turnstile_unavailable"));
      };
      document.head.append(script);
    });
  return loading;
}
export async function turnstileToken(
  element: HTMLElement,
  sitekey: string,
  signal: AbortSignal,
): Promise<{ token: string; dispose: () => void }> {
  if (!sitekey) throw new Error("missing_sitekey");
  await loadTurnstile();
  signal.throwIfAborted();
  const turnstile = window.turnstile;
  if (!turnstile) throw new Error("turnstile_unavailable");
  return new Promise((resolve, reject) => {
    let id: string | undefined;
    const dispose = () => {
      if (id) turnstile.remove(id);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      dispose();
      reject(new Error("turnstile_timeout"));
    };
    signal.addEventListener("abort", abort, { once: true });
    id = turnstile.render(element, {
      sitekey,
      theme: "auto",
      size: "flexible",
      callback: (token) => {
        signal.removeEventListener("abort", abort);
        resolve({ token, dispose });
      },
      "error-callback": () => {
        dispose();
        reject(new Error("turnstile_failed"));
      },
      "expired-callback": abort,
    });
  });
}
