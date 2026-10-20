// Wire contract v2 between the browser and POST /api/tldr (PRD section 11).
// The browser builds TldrRequest from engine results with toTldrRequest (src/shared/tldr-request.ts);
// the Worker parses it at its boundary (worker/payload.ts) and answers TldrResponse | TldrError.
// Only numbers and group names cross. Every number on the wire is finite: a value the engine can
// produce as non-finite (an unbounded interval, an infinite MDE or extra days, a degenerate
// boundary or finding parameter) travels as null.
import type {
  Confidence,
  Currency,
  GroupId,
  HorizonMonths,
  Hypothesis,
  Locale,
  Method,
  Power,
  RuleId,
  Severity,
  Verdict,
} from "../stats/types";

export const TLDR_GROUP_NAME_MAX = 40;
export const TLDR_REQUEST_MAX_BYTES = 32_768;
/** Weekly plans can have more looks than the 2..12 a user types by hand. */
export const TLDR_MAX_PLANNED_LOOKS = 100;

export interface TldrRequest {
  locale: Locale;
  turnstileToken: string;
  context: {
    method: Method;
    confidence: Confidence;
    power: Power;
    hypothesis: Hypothesis;
    bonferroni: boolean;
  };
  /** Ids follow isGroupIdSequence: A, then increasing slots of B..E. */
  groups: { id: GroupId; name: string; users: number; conversions: number; rate: number; intendedSplit: number }[];
  /** One per groups[1..], in the same order. */
  variants: {
    id: GroupId;
    lift: number | null; // null when the control rate is 0
    pValue: number;
    probabilityToBeatControl: number;
    /** Interval of the selected method; null upper bound for a one-sided Z test. */
    ciRelative: [number, number | null] | null;
    expectedLossRelative: number | null;
    achievedMde: number | null;
    verdict: Verdict;
    sequential: {
      look: number;
      plannedLooks: number;
      zBoundary: number | null;
      zObserved: number | null;
      crossed: boolean;
    } | null;
  }[];
  duration: {
    days: number | null; // null when the user did not inform the duration
    trafficShare: number;
    plannedSamplePerVariant: number | null;
    referenceLift: number;
    extraDays: number | null;
  };
  revenue: {
    currency: Currency;
    horizonMonths: HorizonMonths;
    perVariant: { id: GroupId; monthlyContribution: number; horizonImpact: number }[]; // same order as variants
  } | null;
  /** Rule findings with their parameters, e.g. { rule: "srm", pValue: 0.003 }. */
  findings: ({ rule: RuleId } & Record<string, string | number | null>)[];
}

export interface TldrResponse {
  tldr: string;
  findings: {
    source: "rule" | "ai";
    ruleId: RuleId | null;
    severity: Severity;
    title: string;
    explanation: string;
    action: string;
  }[];
  model: string;
}

export type TldrErrorCode =
  | "invalid_payload"
  | "turnstile_failed"
  | "burst_limit"
  | "daily_limit"
  | "ai_failed"
  | "ai_timeout";

export interface TldrError {
  error: TldrErrorCode;
}
