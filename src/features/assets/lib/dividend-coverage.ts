import { expenseCoverage } from '@/features/equity';
import {
  DEFAULT_DIVIDEND_SPEND_SHARE_PCT,
  DEFAULT_DIVIDEND_SPEND_THRESHOLD_PCT,
  DIVIDEND_COVERAGE_MILESTONES,
} from '../constants';

export interface DividendCoverage {
  coverage: number | null;
  reached: number | null;
  next: number | null;
  /** Extra trailing-12-month dividends (SGD a year) needed for the next milestone. */
  gapTtmSgd: number | null;
}

const EMPTY: DividendCoverage = {
  coverage: null,
  reached: null,
  next: null,
  gapTtmSgd: null,
};

export function computeDividendCoverage({
  ttmMonthlyAvg,
  monthlyExpenses,
}: {
  ttmMonthlyAvg: number | null;
  monthlyExpenses: number | null;
}): DividendCoverage {
  if (
    ttmMonthlyAvg === null ||
    !Number.isFinite(ttmMonthlyAvg) ||
    ttmMonthlyAvg < 0
  ) {
    return EMPTY;
  }
  const coverage = expenseCoverage(ttmMonthlyAvg, monthlyExpenses);
  if (coverage === null || monthlyExpenses === null) return EMPTY;

  let reached: number | null = null;
  let next: number | null = null;
  for (const milestone of DIVIDEND_COVERAGE_MILESTONES) {
    if (coverage >= milestone) reached = milestone;
    else if (next === null) next = milestone;
  }
  const gapTtmSgd =
    next === null
      ? null
      : Math.max(0, next * monthlyExpenses - ttmMonthlyAvg) * 12;
  return { coverage, reached, next, gapTtmSgd };
}

export interface DividendAllowance {
  monthlyAllowance: number;
  monthlyReinvest: number;
}

export function computeDividendAllowance({
  ttmMonthlyAvg,
  coverage,
  thresholdPct = DEFAULT_DIVIDEND_SPEND_THRESHOLD_PCT,
  sharePct = DEFAULT_DIVIDEND_SPEND_SHARE_PCT,
}: {
  ttmMonthlyAvg: number | null;
  coverage: number | null;
  thresholdPct?: number;
  sharePct?: number;
}): DividendAllowance | null {
  if (coverage === null || ttmMonthlyAvg === null) return null;
  const avg = Math.max(0, ttmMonthlyAvg);
  const share = Math.min(100, Math.max(0, sharePct));
  const monthlyAllowance =
    coverage >= thresholdPct / 100 ? (avg * share) / 100 : 0;
  return { monthlyAllowance, monthlyReinvest: avg - monthlyAllowance };
}
