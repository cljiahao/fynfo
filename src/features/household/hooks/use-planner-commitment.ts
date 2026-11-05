'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getPlannerCommitment } from '../actions/planner-actions';

export const PLANNER_COMMITMENT_KEY = ['household-planner-commitment'] as const;

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
