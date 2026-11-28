'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getWeeklyBudget, setWeeklyBudget } from '../actions/publish-budget';
import { publishInvestmentSummary } from '../actions/publish-summary';

export const WEEKLY_BUDGET_KEY = ['invest-weekly-budget'] as const;

export function useWeeklyBudget() {
  return useQuery({
    queryKey: WEEKLY_BUDGET_KEY,
    queryFn: () => getWeeklyBudget(),
  });
}

/** Saves the budget; the next publish picks it up. */
export function useSetWeeklyBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (weeklyBudget: number) => setWeeklyBudget({ weeklyBudget }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WEEKLY_BUDGET_KEY }),
  });
}

export function usePublishSummary() {
  return useMutation({
    mutationFn: (surplus: number) => publishInvestmentSummary({ surplus }),
  });
}
