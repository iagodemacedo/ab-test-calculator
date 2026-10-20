// Deterministic checks (PRD section 8). One function per rule in RULE_SEVERITY; the mapped
// type makes a new registry row fail to compile until its rule exists.
import { RULE_SEVERITY } from "./types";
import type { AnalysisInput, Finding, GroupData, RuleId, Settings, Severity, VariantResult } from "./types";

const LOW_DATA_CONVERSIONS = 20;
const MDE_HIGH = 0.1;
const FULL_WEEK = 7;
const EIGHT_WEEKS = 56;

export interface FindingContext {
  input: AnalysisInput;
  settings: Settings;
  srmPValue: number;
  srmMismatch: boolean;
  variants: readonly VariantResult[];
}

type Rule<K extends RuleId> = (ctx: FindingContext) => Extract<Finding, { rule: K }>[];

function perVariant<K extends RuleId>(
  ctx: FindingContext,
  build: (v: VariantResult, group: GroupData) => Extract<Finding, { rule: K }> | null,
): Extract<Finding, { rule: K }>[] {
  return ctx.variants.flatMap((v, i) => build(v, ctx.input.groups[i + 1]!) ?? []);
}

const RULES: { [K in RuleId]: Rule<K> } = {
  srm: (ctx) => (ctx.srmMismatch ? [{ rule: "srm", pValue: ctx.srmPValue }] : []),

  stopped_early: (ctx) => {
    const planned = ctx.input.plannedSamplePerVariant;
    if (planned === null || ctx.input.sequential.enabled) return [];
    const control = ctx.input.groups[0]!;
    return perVariant(ctx, (v, g) => {
      const current = Math.min(control.users, g.users);
      return current < planned ? { rule: "stopped_early", variant: v.id, current, planned } : null;
    });
  },

  low_data: (ctx) => {
    const control = ctx.input.groups[0]!;
    return perVariant(ctx, (v, g) => {
      if (v.verdict !== "winner" && v.verdict !== "loser") return null;
      const weightedDiff = Math.abs(g.conversions - (control.conversions * g.users) / control.users);
      return weightedDiff <= LOW_DATA_CONVERSIONS ? { rule: "low_data", variant: v.id, weightedDiff } : null;
    });
  },

  under_7_days: ({ input: { days } }) => (days !== null && days < FULL_WEEK ? [{ rule: "under_7_days", days }] : []),

  over_8_weeks: ({ input: { days } }) => (days !== null && days > EIGHT_WEEKS ? [{ rule: "over_8_weeks", days }] : []),

  underpowered: (ctx) =>
    perVariant(ctx, (v) =>
      v.verdict === "underpowered" ? { rule: "underpowered", variant: v.id, referenceLift: ctx.input.referenceLift } : null,
    ),

  bonferroni_off: (ctx) => {
    const groups = ctx.input.groups.length;
    return groups >= 3 && !ctx.settings.bonferroni ? [{ rule: "bonferroni_off", groups }] : [];
  },

  incomplete_weeks: ({ input: { days } }) =>
    days !== null && days >= FULL_WEEK && days % FULL_WEEK !== 0
      ? [{ rule: "incomplete_weeks", days, suggestedDays: Math.ceil(days / FULL_WEEK) * FULL_WEEK }]
      : [],

  mde_high: (ctx) => perVariant(ctx, (v) => (v.achievedMde > MDE_HIGH ? { rule: "mde_high", variant: v.id, mde: v.achievedMde } : null)),

  methods_disagree: (ctx) =>
    perVariant(ctx, (v) => (v.verdictZ !== v.verdictBayes ? { rule: "methods_disagree", variant: v.id } : null)),

  seq_not_crossed: (ctx) =>
    perVariant(ctx, (v) =>
      v.sequential && !v.sequential.crossed && !v.sequential.isFinal
        ? { rule: "seq_not_crossed", variant: v.id, look: v.sequential.look }
        : null,
    ),
};

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/** Sorted by severity, then by the order of the PRD table (the registry order), then by variant. */
export function evaluateFindings(ctx: FindingContext): Finding[] {
  const ids = Object.keys(RULE_SEVERITY) as RuleId[];
  return ids
    .flatMap((id): Finding[] => RULES[id](ctx))
    .sort((a, b) => SEVERITY_RANK[RULE_SEVERITY[a.rule]] - SEVERITY_RANK[RULE_SEVERITY[b.rule]]);
}
