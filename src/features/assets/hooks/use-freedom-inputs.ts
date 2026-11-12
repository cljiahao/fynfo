'use client';

import {
  averageMonthlyTTM,
  dividendSummary,
  useDividends,
  useExchangeRate,
  validExchangeRate,
} from '@/features/equity';
import { useCallback, useMemo, useState } from 'react';
import type { PlannerValues } from '../components/salary-planner';
import {
  DEFAULT_EMERGENCY_MONTHS,
  DEFAULT_WAR_CHEST_MONTHS,
  INVESTMENT_CATEGORIES,
} from '../constants';
import {
  DEFAULT_RETURN_SPREAD_PCT,
  type FreedomInput,
  type LeverContext,
} from '../lib/freedom-projection';
import { sumByCategory, type RecentAvgExpense } from '../lib/salary-plan';
import type { PlannerSettingsData, SnapshotData } from '../types';
import {
  usePlannerSettings,
  useUpsertPlannerSettings,
} from './use-planner-settings';

export interface FreedomAssumptions {
  realReturnPct: number | null;
  withdrawalRatePct: number | null;
  targetYear: number | null;
}

export const NO_ASSUMPTIONS: FreedomAssumptions = {
  realReturnPct: null,
  withdrawalRatePct: null,
  targetYear: null,
};

export const FREEDOM_BOUNDS = {
  realReturnPct: { min: 0, max: 12 },
  withdrawalRatePct: { min: 1, max: 10 },
  targetYearSpan: 60,
} as const;

// Settings fields come back absent, not null, when unset.
export function assumptionsFromSettings(
  settings: PlannerSettingsData | null | undefined
): FreedomAssumptions {
  return {
    realReturnPct: settings?.freedomRealReturnPct ?? null,
    withdrawalRatePct: settings?.freedomWithdrawalRatePct ?? null,
    targetYear: settings?.freedomTargetYear ?? null,
  };
}

function isSet(assumptions: FreedomAssumptions): boolean {
  return (
    assumptions.realReturnPct !== null ||
    assumptions.withdrawalRatePct !== null ||
    assumptions.targetYear !== null
  );
}

/** Invested portfolio today: the snapshot's investment categories only. */
export function portfolioFromSnapshot(snapshot: SnapshotData | undefined) {
  if (!snapshot) return 0;
  return INVESTMENT_CATEGORIES.reduce(
    (sum, category) => sum + sumByCategory(snapshot.entries, category),
    0
  );
}

export function cpfFromSnapshot(snapshot: SnapshotData | undefined) {
  return snapshot ? sumByCategory(snapshot.entries, 'pension') : 0;
}

interface DriftArgs {
  /** The owner's own planner figure when one is set. */
  override: number | null;
  recentAvg: RecentAvgExpense;
  /** Spend of the last completed month. */
  lastMonth: number;
}

const MIN_DRIFT_MONTHS = 3;

/**
 * Percent by which spending runs above its comparison figure. With an
 * override the 12-month average is compared against it; without one the last
 * completed month is compared against the 12-month average.
 */
export function computeExpenseDriftPct({
  override,
  recentAvg,
  lastMonth,
}: DriftArgs): number | null {
  if (recentAvg.monthsUsed < MIN_DRIFT_MONTHS || !(recentAvg.average > 0)) {
    return null;
  }
  if (override !== null) {
    if (!(override > 0)) return null;
    return ((recentAvg.average - override) / override) * 100;
  }
  if (!(lastMonth > 0)) return null;
  return ((lastMonth - recentAvg.average) / recentAvg.average) * 100;
}

interface BuildArgs {
  planner: PlannerValues;
  snapshot: SnapshotData | undefined;
  assumptions: FreedomAssumptions;
  dividendAvgMonthly: number | null;
  now: Date;
}

export function buildFreedomInput({
  planner,
  snapshot,
  assumptions,
  dividendAvgMonthly,
  now,
}: BuildArgs): FreedomInput {
  return {
    now,
    portfolio: portfolioFromSnapshot(snapshot),
    annualCost:
      12 * (planner.expenses + planner.bufferAmt + planner.budgetsMonthly),
    withdrawalRatePct: assumptions.withdrawalRatePct,
    realReturnPct: assumptions.realReturnPct,
    returnSpreadPct: DEFAULT_RETURN_SPREAD_PCT,
    targetYear: assumptions.targetYear,
    monthlyInvesting: planner.investmentAmount,
    safetyRelease: planner.safetyRelease,
    householdGoalsToday: planner.goalsMonthly,
    householdGoalsMonthlyByYear: planner.householdGoalsMonthlyByYear,
    netMonthlyIncome: planner.netAfterCpf > 0 ? planner.netAfterCpf : null,
    savingsMonthly: planner.savingsAmt,
    dividendAvgMonthly,
  };
}

export function buildLeverContext(
  planner: PlannerValues,
  snapshot: SnapshotData | undefined
): LeverContext {
  const savings = snapshot ? sumByCategory(snapshot.entries, 'savings') : 0;
  const bonds = snapshot ? sumByCategory(snapshot.entries, 'bonds') : 0;
  return {
    surplusAfterEarmark:
      savings +
      bonds -
      planner.emergencyFundGoal -
      planner.warChestGoal -
      planner.householdEarmark,
    expenseDriftPct: planner.expenseDriftPct,
    expensesAnnual: planner.expenses * 12,
    householdGoalEnds: planner.householdGoalEnds,
  };
}

/** Trailing-twelve-month dividends as a monthly average; null until they can be valued. */
export function useDividendAvgMonthly(): number | null {
  const { data: dividends } = useDividends();
  const { data: rate, isError: rateError } = useExchangeRate('USD', 'SGD');
  return useMemo(() => {
    if (!dividends || dividends.length === 0) return null;
    const usdSgdRate = !rateError && validExchangeRate(rate) ? rate : null;
    const requiresRate = dividends.some((row) => row.currency === 'USD');
    if (requiresRate && usdSgdRate === null) return null;
    const asOf = new Date().toISOString().slice(0, 10);
    const { trailing12m } = dividendSummary(dividends, usdSgdRate ?? 1, asOf);
    return Number.isFinite(trailing12m) ? averageMonthlyTTM(trailing12m) : null;
  }, [dividends, rate, rateError]);
}

const FALLBACK_SETTINGS: PlannerSettingsData = {
  emergencyMonths: DEFAULT_EMERGENCY_MONTHS,
  warChestMonths: DEFAULT_WAR_CHEST_MONTHS,
  titheEnabled: true,
  tithePct: 10,
  allowanceEnabled: false,
  allowancePct: 5,
  expenseBufferPct: 0,
};

/**
 * The owner's saved freedom assumptions plus a save that writes all three, so
 * a blank field clears its stored value. Values just saved are kept for the
 * session only while the refetch returns none of the fields (the columns are
 * not there yet); once stored values come back they win, so a clear or an
 * edit from another device is never hidden. `persisted` is false in that
 * session-only case.
 */
export function useFreedomAssumptions() {
  const { data: saved } = usePlannerSettings();
  const upsert = useUpsertPlannerSettings();
  const [session, setSession] = useState<FreedomAssumptions | null>(null);
  const fromSaved = assumptionsFromSettings(saved);
  // Once stored values are seen the columns exist, so the session copy can only
  // be staler than the server and must not outlive them.
  if (session !== null && isSet(fromSaved)) setSession(null);
  const sessionOnly = session !== null && isSet(session) && !isSet(fromSaved);
  const assumptions = sessionOnly ? session : fromSaved;

  const { mutateAsync } = upsert;
  const save = useCallback(
    async (next: FreedomAssumptions) => {
      await mutateAsync({
        ...(saved ?? FALLBACK_SETTINGS),
        freedomRealReturnPct: next.realReturnPct,
        freedomWithdrawalRatePct: next.withdrawalRatePct,
        freedomTargetYear: next.targetYear,
      });
      setSession(next);
    },
    [mutateAsync, saved]
  );

  return {
    assumptions,
    save,
    isSaving: upsert.isPending,
    persisted: !sessionOnly,
  };
}
