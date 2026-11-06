'use client';

import { refreshQueriesAfterMutation } from '@/lib/query-refresh';
import {
  keepPreviousData,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { getPlannerCommitment } from '../actions/planner-actions';

export const PLANNER_COMMITMENT_KEY = ['household-planner-commitment'] as const;

/** Goals, budgets, the split and membership all feed the commitment. */
export function refreshPlannerCommitment(qc: QueryClient): Promise<void> {
  return refreshQueriesAfterMutation(qc, PLANNER_COMMITMENT_KEY);
}

/**
 * The caller's household commitment for the personal planner. It never blocks
 * the planner: the planner treats loading and failure as "not included".
 */
export function usePlannerCommitment(horizonMonths: number) {
  return useQuery({
    queryKey: [...PLANNER_COMMITMENT_KEY, horizonMonths],
    queryFn: () => getPlannerCommitment({ horizonMonths }),
    retry: false,
    placeholderData: keepPreviousData,
  });
}
