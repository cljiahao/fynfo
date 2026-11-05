'use client';

import { refreshQueriesAfterMutation } from '@/lib/query-refresh';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteCategoryBudget,
  getSpendingBudgets,
  setCategoryBudget,
} from '../actions/budget-actions';

export const BUDGETS_KEY = ['household-spending-budgets'] as const;

/** Decrypted category budgets; a locked household surfaces as an error, not a spinner. */
export function useSpendingBudgets() {
  return useQuery({
    queryKey: BUDGETS_KEY,
    queryFn: getSpendingBudgets,
    retry: false,
  });
}

export function useSetCategoryBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setCategoryBudget,
    onSuccess: () => refreshQueriesAfterMutation(qc, BUDGETS_KEY),
  });
}

export function useDeleteCategoryBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCategoryBudget,
    onSuccess: () => refreshQueriesAfterMutation(qc, BUDGETS_KEY),
  });
}
