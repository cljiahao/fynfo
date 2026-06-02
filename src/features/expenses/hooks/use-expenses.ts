'use client';

import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  deleteExpense,
  getDistinctPeople,
  getExpenses,
  settleMonthSplits,
  settleSplit,
  upsertExpense,
} from '../actions/expense-actions';
import { applySplitSettlement } from '../lib/utils';
import type { ExpenseData } from '../types';

export const EXPENSE_KEY = ['expenses'] as const;
const PEOPLE_KEY = ['expense-people'] as const;

type SettleVars = { expenseIds: string[]; person: string; settled: boolean };

/**
 * Mutation options for upserting an expense.
 *
 * `onMutate` optimistically writes the full row (incl. splits) into the cache,
 * so the row is correct on screen before the server responds. On the success
 * path we deliberately do NOT invalidate EXPENSE_KEY: a blanket refetch would
 * re-fetch and re-decrypt every expense on every quick-add keystroke, janking
 * the form between rows. `upsertExpense` derives no fields the client lacks, so
 * the optimistic cache already equals server truth; any drift self-heals on the
 * next natural getExpenses (page mount / refresh / other invalidating mutation).
 * PEOPLE_KEY is still refreshed — split `person` is stored plaintext, so that
 * query does no per-row decrypt and is cheap. On error we roll back.
 *
 * Extracted from the hook so the invalidation contract is unit-testable in the
 * node-env vitest setup (no jsdom/RTL in this repo).
 */
export function buildUpsertMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: (data: ExpenseData) => upsertExpense(data),
    onMutate: async (data: ExpenseData) => {
      await queryClient.cancelQueries({ queryKey: EXPENSE_KEY });
      const previous = queryClient.getQueryData<ExpenseData[]>(EXPENSE_KEY);
      queryClient.setQueryData<ExpenseData[]>(EXPENSE_KEY, (old) => {
        const list = old ?? [];
        const idx = list.findIndex((e) => e.id === data.id);
        if (idx !== -1) {
          const next = [...list];
          next[idx] = data;
          return next;
        }
        return [data, ...list];
      });
      return { previous };
    },
    onError: (
      _err: unknown,
      _data: ExpenseData,
      context: { previous?: ExpenseData[] } | undefined
    ) => {
      if (context?.previous) {
        queryClient.setQueryData(EXPENSE_KEY, context.previous);
      }
    },
    onSettled: () => {
      // No EXPENSE_KEY refetch on success — optimistic cache is the source of
      // truth. Only refresh the cheap, plaintext people-suggestions query.
      queryClient.invalidateQueries({ queryKey: PEOPLE_KEY });
    },
  };
}

export const useExpenses = () => {
  return useQuery({
    queryKey: EXPENSE_KEY,
    queryFn: () => getExpenses(),
  });
};

export const useUpsertExpense = () => {
  const queryClient = useQueryClient();
  return useMutation(buildUpsertMutationOptions(queryClient));
};

/**
 * Delete options. Optimistically drops the row (rollback on error) and, like
 * the upsert path, never refetches EXPENSE_KEY — deletion derives nothing the
 * client lacks. Only the cheap plaintext PEOPLE_KEY is refreshed, since a
 * removed expense can drop a person from the suggestions list.
 */
export function buildDeleteMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: (id: string) => deleteExpense(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: EXPENSE_KEY });
      const previous = queryClient.getQueryData<ExpenseData[]>(EXPENSE_KEY);
      queryClient.setQueryData<ExpenseData[]>(EXPENSE_KEY, (old) =>
        (old ?? []).filter((e) => e.id !== id)
      );
      return { previous };
    },
    onError: (
      _err: unknown,
      _id: string,
      context: { previous?: ExpenseData[] } | undefined
    ) => {
      if (context?.previous) {
        queryClient.setQueryData(EXPENSE_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PEOPLE_KEY });
    },
  };
}

/**
 * Shared optimistic settle options for both the per-row and whole-month cases.
 * Flips `settled` on the matching splits in-cache and never invalidates: the
 * cache equals server truth (no derived fields, person set unchanged), so a
 * full re-decrypt refetch is pure waste. Rolls back on error.
 */
function buildSettleMutationOptions(
  queryClient: QueryClient,
  mutationFn: (vars: SettleVars) => Promise<void>
) {
  return {
    mutationFn,
    onMutate: async ({ expenseIds, person, settled }: SettleVars) => {
      await queryClient.cancelQueries({ queryKey: EXPENSE_KEY });
      const previous = queryClient.getQueryData<ExpenseData[]>(EXPENSE_KEY);
      queryClient.setQueryData<ExpenseData[]>(EXPENSE_KEY, (old) =>
        applySplitSettlement(old ?? [], expenseIds, person, settled)
      );
      return { previous };
    },
    onError: (
      _err: unknown,
      _vars: SettleVars,
      context: { previous?: ExpenseData[] } | undefined
    ) => {
      if (context?.previous) {
        queryClient.setQueryData(EXPENSE_KEY, context.previous);
      }
    },
  };
}

export function buildSettleSplitMutationOptions(queryClient: QueryClient) {
  return buildSettleMutationOptions(
    queryClient,
    ({ expenseIds, person, settled }) =>
      settleSplit(expenseIds[0], person, settled)
  );
}

export function buildSettleMonthMutationOptions(queryClient: QueryClient) {
  return buildSettleMutationOptions(
    queryClient,
    ({ expenseIds, person, settled }) =>
      settleMonthSplits(expenseIds, person, settled)
  );
}

export const useDeleteExpense = () => {
  return useMutation(buildDeleteMutationOptions(useQueryClient()));
};

export const useSettleSplit = () => {
  return useMutation(buildSettleSplitMutationOptions(useQueryClient()));
};

export const useSettleMonthSplits = () => {
  return useMutation(buildSettleMonthMutationOptions(useQueryClient()));
};

export const useDistinctPeople = () => {
  return useQuery({
    queryKey: PEOPLE_KEY,
    queryFn: () => getDistinctPeople(),
  });
};
