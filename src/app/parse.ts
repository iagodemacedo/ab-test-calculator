import { toFraction, toLift } from "../stats";
import type {
  AnalysisInput,
  GroupData,
  Currency,
  Locale,
  Plan,
  PretestInput,
} from "../stats";
import type { AnalysisFields, GroupFields, PretestFields } from "./state";

export type FieldError =
  | "required"
  | "invalid"
  | "integer"
  | "positive"
  | "nonnegative"
  | "range"
  | "exceeds"
  | "splitError"
  | "looksError"
  | "currentLookError"
  | "liftTooHigh";
export type Parsed<T> =
  | { kind: "ok"; input: T; errors: Record<string, FieldError> }
  | { kind: "invalid"; errors: Record<string, FieldError> };

export function readNumber(text: string, locale: Locale): number | null {
  const raw = text.trim();
  const pattern =
    locale === "pt"
      ? /^[-+]?(?:\d+(?:[,.]\d*)?|[,.]\d+)$/
      : /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (!pattern.test(raw)) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function reader(locale: Locale) {
  const errors: Record<string, FieldError> = {};
  const number = (
    key: string,
    raw: string,
    min: number,
    integer = false,
    max = Infinity,
  ): number => {
    const n = readNumber(raw, locale);
    if (n === null) errors[key] = raw.trim() === "" ? "required" : "invalid";
    else if (integer && !Number.isInteger(n)) errors[key] = "integer";
    else if (n < min)
      errors[key] =
        key === "trafficPct"
          ? "range"
          : key === "plannedLooks"
            ? "looksError"
            : min > 0
              ? "positive"
              : "nonnegative";
    else if (n > max)
      errors[key] = key === "plannedLooks" ? "looksError" : "range";
    return n ?? 0;
  };
  return { errors, number };
}
export function parseGroup(
  fields: GroupFields,
  locale: Locale,
): Parsed<GroupData> {
  const { errors, number } = reader(locale);
  const users = number(`${fields.id}.users`, fields.users, 1, true);
  const conversions = number(
    `${fields.id}.conversions`,
    fields.conversions,
    0,
    true,
  );
  if (conversions > users) errors[`${fields.id}.conversions`] = "exceeds";
  if (Object.keys(errors).length) return { kind: "invalid", errors };
  return {
    kind: "ok",
    errors,
    input: { id: fields.id, name: fields.name, users, conversions },
  };
}

export function parsePretest(
  fields: PretestFields,
  locale: Locale,
): Parsed<PretestInput> {
  const { errors, number } = reader(locale);
  const weeklyTraffic = number("weeklyTraffic", fields.weeklyTraffic, 1, true);
  const weeklyConversions = number(
    "weeklyConversions",
    fields.weeklyConversions,
    0,
    true,
  );
  if (weeklyConversions > weeklyTraffic) errors.weeklyConversions = "exceeds";
  const trafficShare = toFraction(
    number("trafficPct", fields.trafficPct, 1, false, 100) / 100,
  );
  const targetLift = toLift(
    number("targetLiftPct", fields.targetLiftPct, Number.MIN_VALUE) / 100,
  );
  if (
    fields.mode === "target-lift" &&
    weeklyTraffic > 0 &&
    (weeklyConversions / weeklyTraffic) * (1 + (targetLift ?? 0)) > 1
  )
    errors.targetLiftPct = "liftTooHigh";
  if (
    fields.looks.kind === "fixed" &&
    (!Number.isInteger(fields.looks.count) ||
      fields.looks.count < 2 ||
      fields.looks.count > 12)
  )
    errors.looks = "looksError";
  if (
    Object.keys(errors).length ||
    trafficShare === null ||
    targetLift === null
  )
    return { kind: "invalid", errors };
  return {
    kind: "ok",
    errors,
    input: {
      weeklyTraffic,
      weeklyConversions,
      groups: fields.groups,
      trafficShare,
      targetLift,
      horizonWeeks: fields.horizonWeeks,
      mode: fields.mode,
      looks: fields.looks,
    },
  };
}
export function parseAnalysis(
  fields: AnalysisFields,
  currency: Currency,
  plan: Plan | null,
  locale: Locale,
): Parsed<AnalysisInput> {
  const { errors, number } = reader(locale);
  const days = fields.days.trim() ? number("days", fields.days, 1, true) : null;
  const trafficShare = toFraction(
    number("trafficPct", fields.trafficPct, 1, false, 100) / 100,
  );
  const referenceLift = toLift(
    number("referenceLiftPct", fields.referenceLiftPct, Number.MIN_VALUE) / 100,
  );
  const parsedGroups = fields.groups.map((group) => parseGroup(group, locale));
  const groups = parsedGroups.flatMap((parsed) => {
    Object.assign(errors, parsed.errors);
    return parsed.kind === "ok" ? [parsed.input] : [];
  });
  const split = fields.groups.map((g) =>
    toFraction(
      number(`${g.id}.splitPct`, g.splitPct, Number.MIN_VALUE, false, 100) /
        100,
    ),
  );
  if (Math.abs(split.reduce<number>((sum, x) => sum + (x ?? 0), 0) - 1) > 1e-8)
    errors.split = "splitError";
  const intendedSplit = split.filter((x) => x !== null);
  const enabled = fields.sequential.enabled;
  const plannedLooks = enabled
    ? plan && plan.looks > 1
      ? plan.looks
      : number("plannedLooks", fields.sequential.plannedLooks, 2, true, 12)
    : 2;
  const currentLook = enabled
    ? number("currentLook", fields.sequential.currentLook, 1, true)
    : 1;
  if (enabled && currentLook > plannedLooks)
    errors.currentLook = "currentLookError";
  const valuePerConversion = fields.valuePerConversion.trim()
    ? number("valuePerConversion", fields.valuePerConversion, 0)
    : null;
  if (
    Object.keys(errors).length ||
    trafficShare === null ||
    referenceLift === null
  )
    return { kind: "invalid", errors };
  return {
    kind: "ok",
    errors,
    input: {
      days,
      trafficShare,
      groups,
      intendedSplit,
      method: fields.method,
      sequential: enabled
        ? { enabled: true, plannedLooks, currentLook }
        : { enabled: false },
      referenceLift,
      plannedSamplePerVariant: plan?.samplePerVariant ?? null,
      revenue:
        valuePerConversion === null
          ? null
          : {
              valuePerConversion,
              currency,
              horizonMonths: fields.horizonMonths,
            },
    },
  };
}
