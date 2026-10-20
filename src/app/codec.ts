import { GROUP_IDS, RULE_SEVERITY, toFraction, toLift } from "../stats";
import type { Locale, Plan, Tldr, TldrFinding } from "../stats";
import type { AppState, AnalysisFields, PretestFields, Tab } from "./state";
import { STATE_VERSION } from "./state";

export const DRAFT_KEY = "abcalc-draft-v1";
const MAX_BYTES = 262144;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const whole = (value: unknown, min: number, max: number): value is number =>
  finite(value) && Number.isInteger(value) && value >= min && value <= max;
const text = (value: unknown, max = 256): value is string =>
  typeof value === "string" && value.length <= max;
const isoDate = (value: unknown): value is string =>
  text(value, 40) &&
  /^\d{4}-\d{2}-\d{2}T/.test(value) &&
  Number.isFinite(Date.parse(value));
const groupCount = (value: unknown): value is PretestFields["groups"] =>
  value === 2 || value === 3 || value === 4 || value === 5;
const isLocale = (value: unknown): value is Locale =>
  value === "pt" || value === "en";

function pretest(value: unknown): PretestFields | null {
  if (
    !record(value) ||
    !text(value.weeklyTraffic) ||
    !text(value.weeklyConversions) ||
    !groupCount(value.groups) ||
    !text(value.trafficPct) ||
    !whole(value.horizonWeeks, 1, 12) ||
    !text(value.targetLiftPct)
  )
    return null;
  if (value.mode !== "mde-by-week" && value.mode !== "target-lift") return null;
  if (
    value.selectedWeek !== null &&
    !whole(value.selectedWeek, 1, value.horizonWeeks)
  )
    return null;
  const looks = value.looks;
  if (!record(looks)) return null;
  const lookPlan =
    looks.kind === "single"
      ? { kind: "single" as const }
      : looks.kind === "weekly"
        ? { kind: "weekly" as const }
        : looks.kind === "fixed" && whole(looks.count, 2, 12)
          ? { kind: "fixed" as const, count: looks.count }
          : null;
  if (!lookPlan) return null;
  return {
    weeklyTraffic: value.weeklyTraffic,
    weeklyConversions: value.weeklyConversions,
    groups: value.groups,
    trafficPct: value.trafficPct,
    horizonWeeks: value.horizonWeeks,
    targetLiftPct: value.targetLiftPct,
    selectedWeek: value.selectedWeek,
    mode: value.mode,
    looks: lookPlan,
  };
}
function analysis(value: unknown): AnalysisFields | null {
  if (
    !record(value) ||
    !text(value.days) ||
    !text(value.trafficPct) ||
    !text(value.referenceLiftPct) ||
    !text(value.valuePerConversion)
  )
    return null;
  if (value.method !== "bayesian" && value.method !== "ztest") return null;
  if (
    value.horizonMonths !== 3 &&
    value.horizonMonths !== 6 &&
    value.horizonMonths !== 12
  )
    return null;
  const seq = value.sequential;
  if (
    !record(seq) ||
    typeof seq.enabled !== "boolean" ||
    !text(seq.plannedLooks) ||
    !text(seq.currentLook)
  )
    return null;
  if (seq.enabled && value.method !== "ztest") return null;
  if (!Array.isArray(value.groups) || !groupCount(value.groups.length))
    return null;
  const groups: AnalysisFields["groups"] = [];
  for (const g of value.groups) {
    if (
      !record(g) ||
      !text(g.name, 1000) ||
      !text(g.users) ||
      !text(g.conversions) ||
      !text(g.splitPct)
    )
      return null;
    const id = GROUP_IDS.find((id) => id === g.id);
    if (!id || groups.some((g) => g.id === id)) return null;
    groups.push({
      id,
      name: g.name,
      users: g.users,
      conversions: g.conversions,
      splitPct: g.splitPct,
    });
  }
  if (
    groups[0]?.id !== "A" ||
    groups.some((g, i) => i > 0 && g.id <= (groups[i - 1]?.id ?? "A"))
  )
    return null;
  return {
    days: value.days,
    trafficPct: value.trafficPct,
    referenceLiftPct: value.referenceLiftPct,
    valuePerConversion: value.valuePerConversion,
    method: value.method,
    horizonMonths: value.horizonMonths,
    sequential: {
      enabled: seq.enabled,
      plannedLooks: seq.plannedLooks,
      currentLook: seq.currentLook,
    },
    groups,
  };
}
function plan(value: unknown): Plan | null {
  if (
    !record(value) ||
    !isoDate(value.createdAt) ||
    !groupCount(value.groups) ||
    !finite(value.trafficShare) ||
    !finite(value.referenceLift) ||
    !whole(value.samplePerVariant, 1, Number.MAX_SAFE_INTEGER) ||
    !whole(value.days, 1, Number.MAX_SAFE_INTEGER) ||
    !whole(value.looks, 1, Number.MAX_SAFE_INTEGER)
  )
    return null;
  const trafficShare = toFraction(value.trafficShare);
  const referenceLift = toLift(value.referenceLift);
  if (!trafficShare || !referenceLift) return null;
  return {
    createdAt: value.createdAt,
    groups: value.groups,
    trafficShare,
    referenceLift,
    samplePerVariant: value.samplePerVariant,
    days: value.days,
    looks: value.looks,
  };
}
export function parseFindings(value: unknown): TldrFinding[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const findings: TldrFinding[] = [];
  for (const f of value) {
    if (
      !record(f) ||
      !text(f.title, 1000) ||
      !text(f.explanation, 16000) ||
      !text(f.action, 16000)
    )
      return null;
    if (f.source !== "rule" && f.source !== "ai") return null;
    if (
      f.severity !== "critical" &&
      f.severity !== "warning" &&
      f.severity !== "info"
    )
      return null;
    const ruleId = Object.keys(RULE_SEVERITY).find((id) => id === f.ruleId);
    if (
      (f.source === "rule" && !ruleId) ||
      (f.source === "ai" && f.ruleId !== null)
    )
      return null;
    const id =
      ruleId && ruleId in RULE_SEVERITY
        ? (ruleId as keyof typeof RULE_SEVERITY)
        : null;
    findings.push({
      source: f.source,
      ruleId: id,
      severity:
        f.source === "ai" && f.severity === "critical"
          ? "warning"
          : id
            ? RULE_SEVERITY[id]
            : f.severity,
      title: f.title,
      explanation: f.explanation,
      action: f.action,
    });
  }
  return findings;
}
function tldr(value: unknown): Tldr | null {
  if (
    !record(value) ||
    !text(value.tldr, 16000) ||
    !text(value.inputHash, 256) ||
    !isLocale(value.locale) ||
    !isoDate(value.generatedAt)
  )
    return null;
  const findings = parseFindings(value.findings);
  return findings
    ? {
        tldr: value.tldr,
        inputHash: value.inputHash,
        locale: value.locale,
        generatedAt: value.generatedAt,
        findings,
      }
    : null;
}
export function parseState(value: unknown): AppState | null {
  if (!record(value) || value.v !== STATE_VERSION || !record(value.settings))
    return null;
  const s = value.settings;
  if (s.confidence !== 0.9 && s.confidence !== 0.95 && s.confidence !== 0.99)
    return null;
  if (s.power !== 0.8 && s.power !== 0.9) return null;
  if (s.hypothesis !== "two-sided" && s.hypothesis !== "one-sided") return null;
  if (typeof s.bonferroni !== "boolean") return null;
  if (
    value.currency !== "BRL" &&
    value.currency !== "USD" &&
    value.currency !== "EUR" &&
    value.currency !== "GBP" &&
    value.currency !== "JPY"
  )
    return null;
  const p = pretest(value.pretest),
    a = analysis(value.analysis);
  const pl = value.plan === null ? null : plan(value.plan);
  const source = value.planSource === null ? null : pretest(value.planSource);
  const summary = value.tldr === null ? null : tldr(value.tldr);
  if (
    !p ||
    !a ||
    (value.plan !== null && !pl) ||
    (value.planSource !== null && !source) ||
    (value.tldr !== null && !summary) ||
    Boolean(pl) !== Boolean(source)
  )
    return null;
  return {
    v: STATE_VERSION,
    settings: {
      confidence: s.confidence,
      power: s.power,
      hypothesis: s.hypothesis,
      bonferroni: s.bonferroni,
    },
    currency: value.currency,
    pretest: p,
    analysis: a,
    plan: pl,
    planSource: source,
    tldr: summary,
  };
}
function translateFields(state: AppState, from: Locale, to: Locale): AppState {
  if (from === to) return state;
  const number = (s: string) =>
    to === "en" ? s.replace(",", ".") : s.replace(".", ",");
  const p = (v: PretestFields): PretestFields => ({
    ...v,
    weeklyTraffic: number(v.weeklyTraffic),
    weeklyConversions: number(v.weeklyConversions),
    targetLiftPct: number(v.targetLiftPct),
    trafficPct: number(v.trafficPct),
  });
  return {
    ...state,
    pretest: p(state.pretest),
    planSource: state.planSource ? p(state.planSource) : null,
    analysis: {
      ...state.analysis,
      days: number(state.analysis.days),
      trafficPct: number(state.analysis.trafficPct),
      referenceLiftPct: number(state.analysis.referenceLiftPct),
      valuePerConversion: number(state.analysis.valuePerConversion),
      groups: state.analysis.groups.map((g) => ({
        ...g,
        users: number(g.users),
        conversions: number(g.conversions),
        splitPct: number(g.splitPct),
      })),
    },
  };
}
function serialize(state: AppState, locale: Locale, tab?: Tab): string {
  return JSON.stringify({ locale, state, ...(tab ? { tab } : {}) });
}
function deserialize(raw: string, locale: Locale): AppState | null {
  if (raw.length > MAX_BYTES) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || !isLocale(value.locale)) return null;
    const state = parseState(value.state);
    return state ? translateFields(state, value.locale, locale) : null;
  } catch {
    return null;
  }
}
async function compress(raw: string): Promise<string> {
  const stream = new Blob([raw])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return btoa(Array.from(bytes, (n) => String.fromCharCode(n)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export async function encode(
  state: AppState,
  locale: Locale,
  baseLength = 0,
): Promise<{ fragment: string; omittedTldr: boolean }> {
  let fragment = `#s=${await compress(serialize(state, locale))}`;
  const omittedTldr =
    baseLength + fragment.length > 8000 && state.tldr !== null;
  if (omittedTldr)
    fragment = `#s=${await compress(serialize({ ...state, tldr: null }, locale))}`;
  return { fragment, omittedTldr };
}
export async function decode(
  fragment: string,
  locale: Locale,
): Promise<AppState | null> {
  if (!/^#s=[A-Za-z0-9_-]+$/.test(fragment) || fragment.length > MAX_BYTES)
    return null;
  try {
    const bytes = Uint8Array.from(
      atob(fragment.slice(3).replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const reader = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"))
      .getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(chunk.value);
    }
    const buffer = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    return deserialize(
      new TextDecoder("utf-8", { fatal: true }).decode(buffer),
      locale,
    );
  } catch {
    return null;
  }
}
export function readDraft(storage: Storage, locale: Locale): AppState | null {
  try {
    const value = storage.getItem(DRAFT_KEY);
    return value ? deserialize(value, locale) : null;
  } catch {
    return null;
  }
}
export function saveDraft(
  storage: Storage,
  state: AppState,
  locale: Locale,
  tab: Tab,
): void {
  try {
    storage.setItem(DRAFT_KEY, serialize(state, locale, tab));
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
}
export function clearDraft(storage: Storage): void {
  try {
    storage.removeItem(DRAFT_KEY);
  } catch {
    /* The calculator works without storage. */
  }
}

export function readDraftTab(storage: Storage): Tab | null {
  try {
    const raw = storage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return record(value) &&
      (value.tab === "analysis" || value.tab === "pretest")
      ? value.tab
      : null;
  } catch {
    return null;
  }
}
