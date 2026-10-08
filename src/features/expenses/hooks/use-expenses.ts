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

interface RowPatch {
  id: string;
  before?: ExpenseData;
  after?: ExpenseData;
  index: number;
  previousPatch?: RowPatch;
  failed?: boolean;
}
interface RollbackContext {
  query: object | null;
  patches: RowPatch[];
}
const rowVersions = new WeakMap<object, Map<string, RowPatch>>();

async function applyOptimistic(
  queryClient: QueryClient,
  ids: string[],
  transform: (rows: ExpenseData[]) => ExpenseData[]
): Promise<RollbackContext> {
  const cache = queryClient.getQueryCache();
  if (!cache.find({ queryKey: EXPENSE_KEY, exact: true }))
    queryClient.setQueryData(EXPENSE_KEY, []);
  const originalQuery = cache.find({ queryKey: EXPENSE_KEY, exact: true });
  await queryClient.cancelQueries({ queryKey: EXPENSE_KEY });
  if (
    originalQuery &&
    cache.find({ queryKey: EXPENSE_KEY, exact: true }) !== originalQuery
  )
    return { query: null, patches: [] };
  const before = queryClient.getQueryData<ExpenseData[]>(EXPENSE_KEY) ?? [];
  queryClient.setQueryData<ExpenseData[]>(EXPENSE_KEY, transform(before));
  const query = cache.find({ queryKey: EXPENSE_KEY, exact: true });
  if (!query) return { query: null, patches: [] };
  const after = queryClient.getQueryData<ExpenseData[]>(EXPENSE_KEY) ?? [];
  const versions = rowVersions.get(query) ?? new Map<string, RowPatch>();
  rowVersions.set(query, versions);
  return {
    query,
    patches: ids.map((id) => {
      const patch: RowPatch = {
        id,
        before: before.find((row) => row.id === id),
        after: after.find((row) => row.id === id),
        index: before.findIndex((row) => row.id === id),
        previousPatch: versions.get(id),
      };
      versions.set(id, patch);
      return patch;
    }),
  };
}

function rollbackOptimistic(
  queryClient: QueryClient,
  context: RollbackContext | undefined
) {
  if (
    !context?.query ||
    queryClient.getQueryCache().find({ queryKey: EXPENSE_KEY, exact: true }) !==
      context.query
  )
    return;
  const versions = rowVersions.get(context.query);
  queryClient.setQueryData<ExpenseData[]>(EXPENSE_KEY, (rows) => {
    if (!rows) return rows;
    let next = [...rows];
    for (const patch of context.patches) {
      patch.failed = true;
      if (
        versions?.get(patch.id) !== patch ||
        JSON.stringify(next.find((row) => row.id === patch.id)) !==
          JSON.stringify(patch.after)
      )
        continue;
      next = next.filter((row) => row.id !== patch.id);
      let restore = patch;
      while (restore.previousPatch?.failed) restore = restore.previousPatch;
      if (restore.before)
        next.splice(Math.max(0, restore.index), 0, restore.before);
      if (restore.previousPatch) versions.set(patch.id, restore.previousPatch);
      else versions.delete(patch.id);
    }
    return next;
  });
}

function commitOptimistic(context: RollbackContext | undefined) {
  for (const patch of context?.patches ?? []) patch.previousPatch = undefined;
}

/**
 * Avoid a full expense refetch/decrypt after quick-add: optimistic rows contain
 * the server's complete values. Refresh only people suggestions; failures roll
 * back mutation-owned rows without overwriting later edits or recreating a
 * cache removed by vault lock.
 */
export function buildUpsertMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: (data: ExpenseData) => upsertExpense(data),
    onSuccess: (
      _result: void,
      _data: ExpenseData,
      context: RollbackContext | undefined
    ) => commitOptimistic(context),
    onMutate: (data: ExpenseData) =>
      applyOptimistic(queryClient, [data.id], (list) => {
        const idx = list.findIndex((row) => row.id === data.id);
        if (idx === -1) return [data, ...list];
        const next = [...list];
        next[idx] = data;
        return next;
      }),
    onError: (
      _err: unknown,
      _data: ExpenseData,
      context: RollbackContext | undefined
    ) => rollbackOptimistic(queryClient, context),
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
    onSuccess: (
      _result: void,
      _id: string,
      context: RollbackContext | undefined
    ) => commitOptimistic(context),
    onMutate: (id: string) =>
      applyOptimistic(queryClient, [id], (rows) =>
        rows.filter((row) => row.id !== id)
      ),
    onError: (
      _err: unknown,
      _id: string,
      context: RollbackContext | undefined
    ) => rollbackOptimistic(queryClient, context),
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
    onSuccess: (
      _result: void,
      _vars: SettleVars,
      context: RollbackContext | undefined
    ) => commitOptimistic(context),
    onMutate: ({ expenseIds, person, settled }: SettleVars) =>
      applyOptimistic(queryClient, expenseIds, (rows) =>
        applySplitSettlement(rows, expenseIds, person, settled)
      ),
    onError: (
      _err: unknown,
      _vars: SettleVars,
      context: RollbackContext | undefined
    ) => rollbackOptimistic(queryClient, context),
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
