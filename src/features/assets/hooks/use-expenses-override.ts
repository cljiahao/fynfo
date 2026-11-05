'use client';

import { useCallback, useState } from 'react';

export const EXPENSES_OVERRIDE_STORAGE_KEY = 'fynfo:planner-expenses-override';

// Storage can be missing or throw (private windows, blocked site data); the
// planner then just follows the average.
function readOverride(): number | null {
  try {
    const raw = window.localStorage.getItem(EXPENSES_OVERRIDE_STORAGE_KEY);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

function writeOverride(value: number | null): void {
  try {
    if (value === null)
      window.localStorage.removeItem(EXPENSES_OVERRIDE_STORAGE_KEY);
    else window.localStorage.setItem(EXPENSES_OVERRIDE_STORAGE_KEY, `${value}`);
  } catch {
    // Persistence is a per-browser convenience, so a failed write is ignored.
  }
}

/**
 * The user's own expenses figure, or null while the planner should follow the
 * recent average. Kept per browser: it is a plaintext amount, which personal
 * tables must not store.
 */
export function useExpensesOverride() {
  const [override, setOverrideState] = useState<number | null>(readOverride);

  const setOverride = useCallback((value: number | null) => {
    setOverrideState(value);
    writeOverride(value);
  }, []);

  return { override, setOverride };
}
