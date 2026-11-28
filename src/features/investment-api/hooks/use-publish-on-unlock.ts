'use client';

import {
  calcRecentAvgExpense,
  derivePersonalSurplus,
  useExpensesOverride,
  usePlannerSettings,
  useSnapshots,
} from '@/features/assets';
import { useExpenses } from '@/features/expenses';
import { useEffect, useRef, useState } from 'react';
import { usePublishSummary, useWeeklyBudget } from './use-publish-budget';

const DAY_CHECK_MS = 10 * 60 * 1000;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Rolls over at midnight UTC so a tab left open republishes before callers' 8-day limit. */
function useToday(): string {
  const [day, setDay] = useState(today);
  useEffect(() => {
    const id = setInterval(() => setDay(today()), DAY_CHECK_MS);
    return () => clearInterval(id);
  }, []);
  return day;
}

/**
 * Publishes the sealed summary when the dashboard mounts unlocked, and again when the day, the
 * user or the saved weekly budget changes. The dashboard only mounts this while the vault is
 * unlocked, so locking and unlocking again remounts it and publishes afresh; no flag survives
 * a lock. Surplus is null until snapshots, settings and expenses have all loaded, so partial
 * data is never sent. A publish that sealed for nobody is not remembered, so it is retried.
 */
export function usePublishSummaryOnUnlock(userId: string): void {
  const snapshots = useSnapshots();
  const settings = usePlannerSettings();
  const expenses = useExpenses();
  const budget = useWeeklyBudget();
  const { override } = useExpensesOverride();
  const [now] = useState(() => new Date());
  const day = useToday();
  const { mutate } = usePublishSummary();
  const published = useRef<string | null>(null);
  const inFlight = useRef<string | null>(null);

  const surplus =
    snapshots.data && settings.isSuccess && expenses.data
      ? derivePersonalSurplus({
          snapshots: snapshots.data,
          settings: settings.data,
          averageExpense: calcRecentAvgExpense(expenses.data, now, 12).average,
          override,
        })
      : null;
  const weeklyBudget = budget.isSuccess ? budget.data : null;

  useEffect(() => {
    if (surplus === null || weeklyBudget === null) return;
    const key = `${userId}:${day}:${weeklyBudget}`;
    if (published.current === key || inFlight.current === key) return;
    inFlight.current = key;
    mutate(surplus, {
      onSuccess: (result) => {
        if (result.published > 0) published.current = key;
      },
      onSettled: () => {
        inFlight.current = null;
      },
    });
  }, [userId, day, surplus, weeklyBudget, mutate]);
}
