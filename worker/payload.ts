import { TLDR_GROUP_NAME_MAX, TLDR_REQUEST_MAX_BYTES, type TldrRequest } from "../src/shared/tldr-contract";
import { GROUP_IDS, RULE_SEVERITY, type RuleId } from "../src/stats/types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isRuleId(value: unknown): value is RuleId {
  return typeof value === "string" && Object.hasOwn(RULE_SEVERITY, value);
}

function number(value: unknown, min = -Number.MAX_VALUE, max = Number.MAX_VALUE): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return number(value, min, max) && Number.isSafeInteger(value);
}

function nullable(value: unknown, check: (value: unknown) => boolean): boolean {
  return value === null || check(value);
}

function isPayload(value: unknown): value is TldrRequest {
  if (!isRecord(value) || (value.locale !== "pt" && value.locale !== "en") ||
      typeof value.turnstileToken !== "string" || !value.turnstileToken.trim() || value.turnstileToken.length > 2048) return false;
  const c = value.context;
  if (!isRecord(c) || (c.method !== "bayesian" && c.method !== "ztest") ||
      (c.confidence !== 0.9 && c.confidence !== 0.95 && c.confidence !== 0.99) ||
      (c.power !== 0.8 && c.power !== 0.9) ||
      (c.hypothesis !== "two-sided" && c.hypothesis !== "one-sided") || typeof c.bonferroni !== "boolean") return false;
  const s = c.sequential;
  if (s !== null && (!isRecord(s) || !integer(s.plannedLooks, 2, 12) || !integer(s.look, 1, s.plannedLooks) ||
      !number(s.zBoundary, 0) || typeof s.crossed !== "boolean")) return false;
  if (!Array.isArray(value.groups) || value.groups.length < 2 || value.groups.length > 5) return false;
  if (!value.groups.every((g: unknown, i: number) => isRecord(g) && g.id === GROUP_IDS[i] &&
      typeof g.name === "string" && integer(g.users, 1) && integer(g.conversions, 0, g.users) &&
      number(g.rate, 0, 1) && number(g.intendedSplit, Number.MIN_VALUE, 1))) return false;
  const splits = value.groups.reduce((sum: number, g: TldrRequest["groups"][number]) => sum + g.intendedSplit, 0);
  if (Math.abs(splits - 1) > 1e-6) return false;
  if (!Array.isArray(value.variants) || value.variants.length !== value.groups.length - 1 ||
      !value.variants.every((v: unknown, i: number) => isRecord(v) && v.id === GROUP_IDS[i + 1] &&
        nullable(v.lift, x => number(x, -1)) && number(v.pValue, 0, 1) && number(v.probabilityToBeatControl, 0, 1) &&
        nullable(v.ciRelative, x => Array.isArray(x) && x.length === 2 && number(x[0]) && number(x[1]) && x[0] <= x[1]) &&
        nullable(v.expectedLossRelative, x => number(x, 0)) &&
        (v.verdict === "winner" || v.verdict === "loser" || v.verdict === "no-difference" || v.verdict === "underpowered"))) return false;
  const d = value.duration;
  if (!isRecord(d) || !nullable(d.days, x => integer(x, 1)) || !number(d.trafficShare, Number.MIN_VALUE, 1) ||
      !nullable(d.plannedSamplePerVariant, x => integer(x, 1)) || !number(d.referenceLift, Number.MIN_VALUE) ||
      !nullable(d.extraDays, x => integer(x, 0))) return false;
  const r = value.revenue;
  if (r !== null && (!isRecord(r) || (r.currency !== "BRL" && r.currency !== "USD" && r.currency !== "EUR" && r.currency !== "GBP" && r.currency !== "JPY") ||
      !number(r.monthlyContribution) || (r.horizonMonths !== 3 && r.horizonMonths !== 6 && r.horizonMonths !== 12) ||
      !number(r.horizonImpact))) return false;
  return Array.isArray(value.findings) && value.findings.every((f: unknown) => isRecord(f) && isRuleId(f.rule) &&
    Object.values(f).every(x => typeof x === "string" || number(x)));
}

export function parseTldrRequest(raw: unknown): { ok: true; value: TldrRequest } | { ok: false } {
  if (!isPayload(raw)) return { ok: false };
  return { ok: true, value: {
    locale: raw.locale,
    turnstileToken: raw.turnstileToken,
    context: {
      method: raw.context.method, confidence: raw.context.confidence, power: raw.context.power,
      hypothesis: raw.context.hypothesis, bonferroni: raw.context.bonferroni,
      sequential: raw.context.sequential === null ? null : {
        look: raw.context.sequential.look, plannedLooks: raw.context.sequential.plannedLooks,
        zBoundary: raw.context.sequential.zBoundary, crossed: raw.context.sequential.crossed,
      },
    },
    groups: raw.groups.map(g => ({ id: g.id, name: g.name.slice(0, TLDR_GROUP_NAME_MAX), users: g.users,
      conversions: g.conversions, rate: g.rate, intendedSplit: g.intendedSplit })),
    variants: raw.variants.map(v => ({ id: v.id, lift: v.lift, pValue: v.pValue,
      probabilityToBeatControl: v.probabilityToBeatControl, ciRelative: v.ciRelative,
      expectedLossRelative: v.expectedLossRelative, verdict: v.verdict })),
    duration: { days: raw.duration.days, trafficShare: raw.duration.trafficShare,
      plannedSamplePerVariant: raw.duration.plannedSamplePerVariant, referenceLift: raw.duration.referenceLift,
      extraDays: raw.duration.extraDays },
    revenue: raw.revenue === null ? null : { currency: raw.revenue.currency,
      monthlyContribution: raw.revenue.monthlyContribution, horizonMonths: raw.revenue.horizonMonths,
      horizonImpact: raw.revenue.horizonImpact },
    findings: raw.findings.map(f => ({ ...f })),
  } };
}

export async function readTldrRequest(request: Request): Promise<ReturnType<typeof parseTldrRequest>> {
  if (Number(request.headers.get("Content-Length")) > TLDR_REQUEST_MAX_BYTES || !request.body) return { ok: false };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > TLDR_REQUEST_MAX_BYTES) {
        await reader.cancel();
        return { ok: false };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return parseTldrRequest(JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes)));
  } catch {
    return { ok: false };
  } finally {
    reader.releaseLock();
  }
}
