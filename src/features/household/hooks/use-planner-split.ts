'use client';

import { refreshQueriesAfterMutation } from '@/lib/query-refresh';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPlannerSplit, setPlannerSplit } from '../actions/planner-actions';
import { refreshPlannerCommitment } from './use-planner-commitment';

export const PLANNER_SPLIT_KEY = ['household-planner-split'] as const;

/** Decrypted split; a locked household surfaces as an error, not a spinner. */
export function usePlannerSplit(enabled = true) {
  return useQuery({
    queryKey: PLANNER_SPLIT_KEY,
    queryFn: getPlannerSplit,
    enabled,
    retry: false,
  });
}

export function useSetPlannerSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setPlannerSplit,
    onSuccess: () =>
      Promise.all([
        refreshQueriesAfterMutation(qc, PLANNER_SPLIT_KEY),
        refreshPlannerCommitment(qc),
      ]),
  });
}
