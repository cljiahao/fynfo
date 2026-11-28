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

const PUBLISHED_FLAG = 'fynfo.invest.published';

function alreadyPublished(): boolean {
  try {
    return window.sessionStorage.getItem(PUBLISHED_FLAG) === '1';
  } catch {
    return false;
  }
}

function markPublished(): void {
  try {
    window.sessionStorage.setItem(PUBLISHED_FLAG, '1');
  } catch {
    // Storage blocked: the in-memory ref still prevents repeats within this page.
  }
}

/**
 * Publishes the sealed summary once per browser session, only when every input has loaded.
 * Surplus is null until snapshots, settings and expenses are all present, so partial data is
 * never sent. A failed publish is retried on the next mount, not in a loop.
 */
export function usePublishSummaryOnUnlock(): void {
  const snapshots = useSnapshots();
  const settings = usePlannerSettings();
  const expenses = useExpenses();
  const budget = useWeeklyBudget();
  const { override } = useExpensesOverride();
  const [now] = useState(() => new Date());
  const { mutate } = usePublishSummary();
  const attempted = useRef(false);

  const surplus =
    snapshots.data && settings.isSuccess && expenses.data
      ? derivePersonalSurplus({
          snapshots: snapshots.data,
          settings: settings.data,
          averageExpense: calcRecentAvgExpense(expenses.data, now, 12).average,
          override,
        })
      : null;
  const ready = surplus !== null && budget.isSuccess && budget.data !== null;

  useEffect(() => {
    if (!ready || surplus === null || attempted.current) return;
    attempted.current = true;
    if (alreadyPublished()) return;
    mutate(surplus, { onSuccess: markPublished });
  }, [ready, surplus, mutate]);
}
