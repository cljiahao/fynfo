// @vitest-environment jsdom
import {
  useAcceptInvite,
  useAddContribution,
  useCreateGoal,
  useCreateHousehold,
  useDeleteGoal,
  useSaveGoal,
  useUnlockHousehold,
  useUpdateGoal,
  useUpdateGoalContribution,
  useUpdateGoalPayment,
} from '@/features/household/hooks/use-household';
import { PLANNER_COMMITMENT_KEY } from '@/features/household/hooks/use-planner-commitment';
import { useSetPlannerSplit } from '@/features/household/hooks/use-planner-split';
import {
  useDeleteCategoryBudget,
  useSetCategoryBudget,
} from '@/features/household/hooks/use-spending-budgets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@/features/household/actions/goal-actions', () => {
  const ok = vi.fn().mockResolvedValue(undefined);
  return {
    addContribution: ok,
    addGoalItem: ok,
    addItemPayment: ok,
    createGoal: ok,
    deleteGoal: ok,
    deleteGoalItem: ok,
    deleteItemPayment: ok,
    getGoals: ok,
    saveGoal: vi.fn().mockResolvedValue({ ok: true }),
    updateGoal: ok,
    updateGoalContribution: ok,
    updateGoalPayment: ok,
  };
});
vi.mock('@/features/household/actions/household-actions', () => {
  const ok = vi.fn().mockResolvedValue(undefined);
  return {
    acceptInvite: ok,
    createHousehold: ok,
    createInvite: ok,
    getHousehold: ok,
    unlockHousehold: ok,
  };
});
vi.mock('@/features/household/actions/spending-actions', () => {
  const ok = vi.fn().mockResolvedValue(undefined);
  return {
    addSpending: ok,
    createSpace: ok,
    deleteSpace: ok,
    deleteSpending: ok,
    getSpaces: ok,
  };
});
vi.mock('@/features/household/actions/planner-actions', () => {
  const ok = vi.fn().mockResolvedValue(undefined);
  return {
    getPlannerCommitment: ok,
    getPlannerSplit: ok,
    setPlannerSplit: ok,
  };
});
vi.mock('@/features/household/actions/budget-actions', () => {
  const ok = vi.fn().mockResolvedValue(undefined);
  return {
    deleteCategoryBudget: ok,
    getSpendingBudgets: ok,
    setCategoryBudget: ok,
  };
});

afterEach(cleanup);

type MutationHook = () => { mutateAsync: (input: never) => Promise<unknown> };

const hooks: Record<string, MutationHook> = {
  useCreateGoal,
  useAddContribution,
  useDeleteGoal,
  useUpdateGoal,
  useUpdateGoalPayment,
  useUpdateGoalContribution,
  useSaveGoal,
  useCreateHousehold,
  useUnlockHousehold,
  useAcceptInvite,
  useSetPlannerSplit,
  useSetCategoryBudget,
  useDeleteCategoryBudget,
} as unknown as Record<string, MutationHook>;

it.each(Object.entries(hooks))(
  '%s invalidates the planner commitment',
  async (_name, useHook) => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(useHook, { wrapper });
    await result.current.mutateAsync({} as never);
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: PLANNER_COMMITMENT_KEY,
      })
    );
  }
);
