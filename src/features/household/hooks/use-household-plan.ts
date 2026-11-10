'use client';

import { refreshQueriesAfterMutation } from '@/lib/query-refresh';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { getHouseholdPlanInput } from '../actions/plan-actions';

export const PLANNER_COMMITMENT_KEY = ['household-planner-commitment'] as const;

/** Goals, budgets, the split and membership all feed the household plan. */
export function refreshPlannerCommitment(qc: QueryClient): Promise<void> {
  return refreshQueriesAfterMutation(qc, PLANNER_COMMITMENT_KEY);
}

/**
 * Under the commitment key prefix so the existing goal, split and budget
 * invalidations refresh it. It never blocks rendering: callers treat loading
 * and failure as "no plan".
 */
export function useHouseholdPlan() {
  return useQuery({
    queryKey: [...PLANNER_COMMITMENT_KEY, 'plan-input'],
    queryFn: getHouseholdPlanInput,
    retry: false,
  });
}
