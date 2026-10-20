// Wire contract between the browser and POST /api/tldr (PRD section 11).
// The browser builds TldrRequest from engine results; the Worker parses it at its boundary
// (worker/payload.ts) and answers TldrResponse | TldrError. Only numbers and group names cross.
import type {
  Confidence,
  GroupId,
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

export interface TldrRequest {
  locale: Locale;
  turnstileToken: string;
  context: {
    method: Method;
    confidence: Confidence;
    power: Power;
    hypothesis: Hypothesis;
    bonferroni: boolean;
    sequential: { look: number; plannedLooks: number; zBoundary: number; crossed: boolean } | null;
  };
  groups: { id: GroupId; name: string; users: number; conversions: number; rate: number; intendedSplit: number }[];
  variants: {
    id: GroupId;
    lift: number | null;
    pValue: number;
    probabilityToBeatControl: number;
    ciRelative: [number, number] | null;
    expectedLossRelative: number | null;
    verdict: Verdict;
  }[];
  duration: {
    days: number | null;
    trafficShare: number;
    plannedSamplePerVariant: number | null;
    referenceLift: number;
    extraDays: number | null;
  };
  revenue: { currency: string; monthlyContribution: number; horizonMonths: number; horizonImpact: number } | null;
  /** Rule findings with their numeric parameters, e.g. { rule: "srm", pValue: 0.003 }. */
  findings: ({ rule: RuleId } & Record<string, string | number>)[];
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
