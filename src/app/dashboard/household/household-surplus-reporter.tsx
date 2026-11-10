'use client';

import {
  calcRecentAvgExpense,
  derivePersonalSurplus,
  useExpensesOverride,
  usePlannerSettings,
  useSnapshots,
} from '@/features/assets';
import { useExpenses } from '@/features/expenses';
import { useEffect, useState } from 'react';

/**
 * Spare savings above the emergency fund and war chest. Everything is read and
 * computed in this browser; null until every input has loaded, so nothing is
 * shown from partial data.
 */
function usePersonalSurplus(): number | null {
  const snapshots = useSnapshots();
  const settings = usePlannerSettings();
  const expenses = useExpenses();
  const { override } = useExpensesOverride();
  const [now] = useState(() => new Date());

  if (!snapshots.data || !settings.isSuccess || !expenses.data) return null;
  return derivePersonalSurplus({
    snapshots: snapshots.data,
    settings: settings.data,
    averageExpense: calcRecentAvgExpense(expenses.data, now, 12).average,
    override,
  });
}

interface Props {
  onSurplus: (surplus: number | null) => void;
}

/** Renders nothing; reports the surplus up so the overview never remounts. */
export default function HouseholdSurplusReporter({ onSurplus }: Props) {
  const surplus = usePersonalSurplus();
  useEffect(() => {
    onSurplus(surplus);
  }, [onSurplus, surplus]);
  return null;
}
