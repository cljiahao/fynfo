'use client';

import { useMemo, useState } from 'react';
import { jointGoalMonthly } from '../lib/household-joint-plan';
import { useHouseholdPlan } from './use-household-plan';

/**
 * Per-goal joint monthly figures from the same plan as the overview, or null
 * while it loads, fails, or there is no unlocked household.
 */
export function useJointGoalMonthly(): Map<string, number> | null {
  const plan = useHouseholdPlan();
  const [now] = useState(() => new Date());
  const input = plan.data;
  return useMemo(
    () =>
      input && input.state === 'ready' ? jointGoalMonthly(input, now) : null,
    [input, now]
  );
}
