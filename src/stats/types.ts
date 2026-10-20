// Domain model of the statistics engine. PRD.md sections 2 to 9 are the source of truth.
// Everything here is already parsed: the UI turns raw field text into these types at its
// boundary (src/stats/parse.ts), and the engine trusts them without re-validating.

export type Confidence = 0.9 | 0.95 | 0.99;
export type Power = 0.8 | 0.9;
export type Hypothesis = "two-sided" | "one-sided";
export type Method = "bayesian" | "ztest";
export type Currency = "BRL" | "USD" | "EUR" | "GBP" | "JPY";
export type HorizonMonths = 3 | 6 | 12;
export type Locale = "pt" | "en";

/** Settings shared by both tabs (PRD section 2). */
export interface Settings {
  confidence: Confidence;
  power: Power;
  hypothesis: Hypothesis;
  /** Only has an effect with 3+ groups. Default true. */
  bonferroni: boolean;
}

/** Slot order is identity: A is always the control, B..E the variants, and slot N owns chart color N. */
export type GroupId = "A" | "B" | "C" | "D" | "E";
export const GROUP_IDS: readonly GroupId[] = ["A", "B", "C", "D", "E"];
export type GroupCount = 2 | 3 | 4 | 5;

/** Fraction in (0, 1]. Branded so a percentage (e.g. 100) can never be passed where a fraction is expected. */
export type Fraction = number & { readonly __brand: "Fraction" };
/** Relative lift as a fraction: 0.1 means +10%. */
export type RelativeLift = number & { readonly __brand: "RelativeLift" };

// ---------------------------------------------------------------- pre-test (PRD section 3, 4)

/** How many times the user plans to look at the running test. */
export type LookPlan =
  | { kind: "single" }
  | { kind: "weekly" } // one look per week of the plan
  | { kind: "fixed"; count: number }; // 2..12 equally spaced looks

export type PretestMode = "mde-by-week" | "target-lift";

export interface PretestInput {
  weeklyTraffic: number; // > 0, users or sessions on the page
  weeklyConversions: number; // 0..weeklyTraffic
  groups: GroupCount;
  trafficShare: Fraction; // share of page traffic in the test
  horizonWeeks: number; // 1..12, Mode A table length
  mode: PretestMode;
  targetLift: RelativeLift; // Mode B input
  looks: LookPlan;
}

export interface WeekRow {
  week: number;
  visitorsPerVariant: number;
  mdeRelative: RelativeLift; // Number.POSITIVE_INFINITY when nothing is detectable
  mdeAbsolute: number; // in conversion-rate units (0.0017 = 0.17 p.p.)
  aboveMdeAlert: boolean; // mdeRelative > 0.10
}

export interface SequentialBoundary {
  look: number; // 1-based
  informationFraction: number;
  visitorsPerVariant: number; // cumulative
  zBoundary: number;
  nominalP: number;
}

export interface SequentialDesign {
  looks: number;
  inflationFactor: number;
  maxSamplePerVariant: number;
  boundaries: SequentialBoundary[];
}

export type PretestAlert =
  | { kind: "all-weeks-above-mde" }
  | { kind: "duration-over-12-weeks"; days: number }
  | { kind: "duration-under-7-days"; days: number };

export type PretestResult =
  | { kind: "invalid"; reason: "no-conversions" | "lift-exceeds-100-percent" }
  | {
      kind: "ok";
      settings: Settings; // the settings this plan was computed with; toPlan reuses them
      baselineRate: number;
      alpha: number; // after Bonferroni
      weeks: WeekRow[]; // Mode A
      targetLift: {
        samplePerVariant: number; // fixed-sample, before sequential inflation
        totalSample: number;
        days: number;
        weeks: number;
      };
      sequential: SequentialDesign | null; // null when looks is single
      alerts: PretestAlert[];
    };

/** What "Usar esse plano" carries into the analysis tab (PRD section 3, "Ponte para o pós-teste"). */
export interface Plan {
  createdAt: string; // ISO timestamp
  groups: GroupCount;
  trafficShare: Fraction;
  referenceLift: RelativeLift;
  samplePerVariant: number; // after sequential inflation when looks > 1
  days: number;
  looks: number; // 1 = fixed-sample test
}

// ---------------------------------------------------------------- analysis inputs (PRD section 5)

export interface GroupData {
  id: GroupId;
  name: string; // free text, truncated to 40 chars when sent to the AI
  users: number; // > 0
  conversions: number; // 0..users
}

export type Sequential =
  | { enabled: false }
  | { enabled: true; plannedLooks: number; currentLook: number };

export interface AnalysisInput {
  days: number | null; // null when not informed
  trafficShare: Fraction;
  groups: GroupData[]; // index 0 is the control; length 2..5
  intendedSplit: Fraction[]; // same length as groups, sums to 1
  method: Method;
  sequential: Sequential;
  referenceLift: RelativeLift; // from plan, else 0.10
  plannedSamplePerVariant: number | null; // from plan, enables stopped_early
  revenue: { valuePerConversion: number; currency: Currency; horizonMonths: HorizonMonths } | null;
}

// ---------------------------------------------------------------- analysis results (PRD sections 6 to 9)

export interface GroupStats {
  id: GroupId;
  rate: number;
  standardError: number;
}

export interface ZTestResult {
  lift: number | null; // null when control rate is 0
  absoluteDiff: number;
  z: number;
  pValue: number;
  significant: boolean;
  /** Absolute-difference interval; upper is +Infinity for one-sided. */
  ciAbsolute: [number, number];
  ciRelative: [number, number] | null;
  observedPower: number;
}

export interface BayesResult {
  probabilityToBeatControl: number;
  probabilityToBeBest: number; // across all groups; equals P(beat control) with 2 groups
  expectedLossAbsolute: number; // E[max(control - variant, 0)]
  expectedLossRelative: number | null;
  credibleIntervalRelative: [number, number] | null;
}

export type Verdict = "winner" | "loser" | "no-difference" | "underpowered";

export interface SequentialStatus {
  look: number;
  plannedLooks: number;
  informationFraction: number;
  zBoundary: number;
  zObserved: number;
  crossed: boolean;
  isFinal: boolean;
}

export interface VariantResult {
  id: GroupId;
  ztest: ZTestResult;
  bayes: BayesResult;
  verdict: Verdict; // for the selected method
  verdictZ: Verdict;
  verdictBayes: Verdict;
  achievedMde: RelativeLift;
  requiredSamplePerVariant: number; // for referenceLift
  sequential: SequentialStatus | null;
}

export interface RevenueResult {
  monthlyVisitors: number;
  perVariant: { id: GroupId; extraMonthlyConversions: number; monthlyContribution: number; horizonImpact: number }[];
  forecast: { id: GroupId; months: number[] }[]; // cumulative revenue per month of the horizon
}

export type AnalysisResult =
  | { kind: "empty" }
  | { kind: "no-conversions" }
  | {
      kind: "ok";
      alpha: number;
      groups: GroupStats[];
      variants: VariantResult[]; // one per non-control group
      srm: { chiSquare: number; pValue: number; mismatch: boolean };
      extraDays: number | null; // null without days
      revenue: RevenueResult | null;
      findings: Finding[];
      inputHash: string; // stable hash of the inputs, seeds the Monte Carlo and the TL;DR stale check
    };

// ---------------------------------------------------------------- findings (PRD section 8)

export type Severity = "critical" | "warning" | "info";

/** Rule registry: id -> severity. Adding a rule means adding a row here and a case in its params. */
export const RULE_SEVERITY = {
  srm: "critical",
  stopped_early: "critical",
  low_data: "warning",
  under_7_days: "warning",
  over_8_weeks: "warning",
  underpowered: "warning",
  bonferroni_off: "warning",
  incomplete_weeks: "info",
  mde_high: "info",
  methods_disagree: "info",
  seq_not_crossed: "info",
} as const satisfies Record<string, Severity>;

export type RuleId = keyof typeof RULE_SEVERITY;

export type Finding =
  | { rule: "srm"; pValue: number }
  | { rule: "low_data"; variant: GroupId; weightedDiff: number }
  | { rule: "under_7_days"; days: number }
  | { rule: "incomplete_weeks"; days: number; suggestedDays: number }
  | { rule: "over_8_weeks"; days: number }
  | { rule: "stopped_early"; variant: GroupId; current: number; planned: number }
  | { rule: "underpowered"; variant: GroupId; referenceLift: number }
  | { rule: "mde_high"; variant: GroupId; mde: number }
  | { rule: "bonferroni_off"; groups: number }
  | { rule: "methods_disagree"; variant: GroupId }
  | { rule: "seq_not_crossed"; variant: GroupId; look: number };

// ---------------------------------------------------------------- AI TL;DR (PRD section 11)

export type FindingSource = "rule" | "ai";

export interface TldrFinding {
  source: FindingSource;
  ruleId: RuleId | null; // set when source = rule
  severity: Severity; // "critical" only when source = rule
  title: string;
  explanation: string;
  action: string;
}

export interface Tldr {
  tldr: string;
  findings: TldrFinding[];
  inputHash: string;
  locale: Locale;
  generatedAt: string; // ISO timestamp
}
