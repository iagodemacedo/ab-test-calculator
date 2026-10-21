// Lift translated into money, as in Speero (PRD section 9). Linear projection, no decay.
import type { AnalysisInput, GroupStats, RevenueResult } from "./types";

const DAYS_PER_MONTH = 30;

export function projectRevenue(input: AnalysisInput, groups: readonly GroupStats[]): RevenueResult | null {
  if (input.days === null || input.revenue === null) return null;
  const { valuePerConversion: value, horizonMonths } = input.revenue;
  const totalUsers = input.groups.reduce((sum, g) => sum + g.users, 0);
  const monthlyVisitors = ((totalUsers / input.days) * DAYS_PER_MONTH) / input.trafficShare;
  const control = groups[0]!;
  const months = Array.from({ length: horizonMonths }, (_, m) => m + 1);
  return {
    monthlyVisitors,
    perVariant: groups.slice(1).map((g) => {
      const extraMonthlyConversions = monthlyVisitors * (g.rate - control.rate);
      const monthlyContribution = extraMonthlyConversions * value;
      return { id: g.id, extraMonthlyConversions, monthlyContribution, horizonImpact: monthlyContribution * horizonMonths };
    }),
    forecast: groups.map((g) => ({ id: g.id, months: months.map((m) => monthlyVisitors * g.rate * value * m) })),
  };
}
