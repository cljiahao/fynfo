'use client';

import {
  calcRecentAvgExpense,
  computeSalaryPlan,
  sumByCategory,
  useExpensesOverride,
  usePlannerSettings,
  useSnapshots,
} from '@/features/assets';
import { useExpenses } from '@/features/expenses';
import { HouseholdOverview } from '@/features/household';
import { useState } from 'react';

const DEFAULT_EMERGENCY_MONTHS = 3;
const DEFAULT_WAR_CHEST_MONTHS = 9;

/**
 * Spare savings above the emergency fund and war chest, derived the way the
 * personal planner does it. Everything is read and computed in this browser;
 * null until every input has loaded, so nothing is shown from partial data.
 */
function usePersonalSurplus(): number | null {
  const snapshots = useSnapshots();
  const settings = usePlannerSettings();
  const expenses = useExpenses();
  const { override } = useExpensesOverride();
  const [now] = useState(() => new Date());

  if (!snapshots.data || !settings.isSuccess || !expenses.data) return null;
  const snapshot = snapshots.data.at(-1);
  if (!snapshot) return null;

  const average = Math.round(
    calcRecentAvgExpense(expenses.data, now, 12).average
  );
  const plan = computeSalaryPlan({
    salary: 0,
    expenses: override ?? average,
    emergencyMonths: settings.data?.emergencyMonths ?? DEFAULT_EMERGENCY_MONTHS,
    warChestMonths: settings.data?.warChestMonths ?? DEFAULT_WAR_CHEST_MONTHS,
    titheEnabled: false,
    tithePctInput: 0,
    allowanceEnabled: false,
    allowancePctInput: 0,
    currentSavings: sumByCategory(snapshot.entries, 'savings'),
    currentBonds: sumByCategory(snapshot.entries, 'bonds'),
  });
  return Math.max(0, plan.goalsFunded - plan.goalsNeeded);
}

export function HouseholdWithSavings() {
  return <HouseholdOverview personalSurplus={usePersonalSurplus()} />;
}
