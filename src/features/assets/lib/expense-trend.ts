import { EXPENSE_TREND_STEADY_PCT } from '../constants';

export type ExpenseTrend =
  | { direction: 'steady' }
  | { direction: 'up' | 'down'; pct: number };

/** Null drift (not enough data) hides the trend entirely. */
export function expenseTrend(driftPct: number | null): ExpenseTrend | null {
  if (driftPct === null || !Number.isFinite(driftPct)) return null;
  if (Math.abs(driftPct) < EXPENSE_TREND_STEADY_PCT) {
    return { direction: 'steady' };
  }
  return {
    direction: driftPct > 0 ? 'up' : 'down',
    pct: Math.round(Math.abs(driftPct)),
  };
}
