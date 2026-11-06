'use client';

import { refreshQueriesAfterMutation } from '@/lib/query-refresh';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  addContribution,
  addGoalItem,
  addItemPayment,
  createGoal,
  deleteGoal,
  deleteGoalItem,
  deleteItemPayment,
  getGoals,
  saveGoal,
  updateGoal,
  updateGoalContribution,
  updateGoalPayment,
} from '../actions/goal-actions';
import {
  acceptInvite,
  createHousehold,
  createInvite,
  getHousehold,
  unlockHousehold,
} from '../actions/household-actions';
import {
  addSpending,
  createSpace,
  deleteSpace,
  deleteSpending,
  getSpaces,
} from '../actions/spending-actions';
import { refreshPlannerCommitment } from './use-planner-commitment';

export const HOUSEHOLD_KEY = ['household'] as const;
export const GOALS_KEY = ['household-goals'] as const;
export const SPACES_KEY = ['household-spaces'] as const;

export function useHousehold() {
  return useQuery({ queryKey: HOUSEHOLD_KEY, queryFn: getHousehold });
}

/**
 * Goals for the unlocked household. `getGoals` throws when the household is
 * locked (no K_h in session); we disable retries so that surfaces immediately as
 * an error the overview turns into the unlock prompt, rather than spinning.
 */
export function useGoals(enabled: boolean) {
  return useQuery({
    queryKey: GOALS_KEY,
    queryFn: getGoals,
    enabled,
    retry: false,
  });
}

function refreshGoalsAndCommitment(qc: QueryClient): Promise<void> {
  return Promise.all([
    refreshQueriesAfterMutation(qc, GOALS_KEY),
    refreshPlannerCommitment(qc),
  ]).then(() => undefined);
}

export function useCreateHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createHousehold({ name }),
    onSuccess: () => {
      void refreshQueriesAfterMutation(qc, HOUSEHOLD_KEY);
      void refreshQueriesAfterMutation(qc, GOALS_KEY);
      void refreshQueriesAfterMutation(qc, SPACES_KEY);
      void refreshPlannerCommitment(qc);
    },
  });
}

export function useUnlockHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: unlockHousehold,
    onSuccess: () => {
      void refreshQueriesAfterMutation(qc, HOUSEHOLD_KEY);
      void refreshQueriesAfterMutation(qc, GOALS_KEY);
      void refreshQueriesAfterMutation(qc, SPACES_KEY);
      void refreshPlannerCommitment(qc);
    },
  });
}

export function useCreateInvite() {
  return useMutation({ mutationFn: createInvite });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (secret: string) => acceptInvite({ secret }),
    onSuccess: () => {
      void refreshQueriesAfterMutation(qc, HOUSEHOLD_KEY);
      void refreshQueriesAfterMutation(qc, GOALS_KEY);
      void refreshQueriesAfterMutation(qc, SPACES_KEY);
      void refreshPlannerCommitment(qc);
    },
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createGoal,
    onSuccess: () => refreshGoalsAndCommitment(qc),
  });
}

export function useAddContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addContribution,
    onSuccess: () => refreshGoalsAndCommitment(qc),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => refreshGoalsAndCommitment(qc),
  });
}

function useGoalsMutation<T>(mutationFn: (input: T) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => refreshGoalsAndCommitment(qc),
  });
}

export function useUpdateGoal() {
  return useGoalsMutation(updateGoal);
}

export function useUpdateGoalPayment() {
  return useGoalsMutation(updateGoalPayment);
}

export function useUpdateGoalContribution() {
  return useGoalsMutation(updateGoalContribution);
}

/** The editor reads the result itself, so a SERVER failure must not refresh. */
export function useSaveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveGoal,
    onSuccess: (result) => {
      if (result.ok) return refreshGoalsAndCommitment(qc);
    },
  });
}

export function useAddGoalItem() {
  return useGoalsMutation(addGoalItem);
}

export function useDeleteGoalItem() {
  return useGoalsMutation(deleteGoalItem);
}

export function useAddItemPayment() {
  return useGoalsMutation(addItemPayment);
}

export function useDeleteItemPayment() {
  return useGoalsMutation(deleteItemPayment);
}

/** Shared spending spaces; like goals, a locked household surfaces as an error. */
export function useSpaces(enabled: boolean) {
  return useQuery({
    queryKey: SPACES_KEY,
    queryFn: getSpaces,
    enabled,
    retry: false,
  });
}

function useSpacesMutation<T>(mutationFn: (input: T) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => refreshQueriesAfterMutation(qc, SPACES_KEY),
  });
}

export function useCreateSpace() {
  return useSpacesMutation(createSpace);
}

export function useDeleteSpace() {
  return useSpacesMutation(deleteSpace);
}

export function useAddSpending() {
  return useSpacesMutation(addSpending);
}

export function useDeleteSpending() {
  return useSpacesMutation(deleteSpending);
}
