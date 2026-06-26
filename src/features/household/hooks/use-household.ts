'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addContribution,
  createGoal,
  deleteGoal,
  getGoals,
} from '../actions/goal-actions';
import {
  acceptInvite,
  createHousehold,
  createInvite,
  getHousehold,
  unlockHousehold,
} from '../actions/household-actions';

export const HOUSEHOLD_KEY = ['household'] as const;
export const GOALS_KEY = ['household-goals'] as const;

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

export function useCreateHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createHousehold({ name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HOUSEHOLD_KEY });
      qc.invalidateQueries({ queryKey: GOALS_KEY });
    },
  });
}

export function useUnlockHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: unlockHousehold,
    onSuccess: () => qc.invalidateQueries({ queryKey: GOALS_KEY }),
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
      qc.invalidateQueries({ queryKey: HOUSEHOLD_KEY });
      qc.invalidateQueries({ queryKey: GOALS_KEY });
    },
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createGoal,
    onSuccess: () => qc.invalidateQueries({ queryKey: GOALS_KEY }),
  });
}

export function useAddContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addContribution,
    onSuccess: () => qc.invalidateQueries({ queryKey: GOALS_KEY }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => qc.invalidateQueries({ queryKey: GOALS_KEY }),
  });
}
