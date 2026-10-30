// @vitest-environment jsdom
import {
  useDeleteGoalItem,
  useDeleteItemPayment,
  useDeleteSpending,
} from '@/features/household/hooks/use-household';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  deleteGoalItem: vi.fn().mockResolvedValue(undefined),
  deleteItemPayment: vi.fn().mockResolvedValue(undefined),
  deleteSpending: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/household/actions/goal-actions', () => ({
  addContribution: vi.fn(),
  addGoalItem: vi.fn(),
  addItemPayment: vi.fn(),
  createGoal: vi.fn(),
  deleteGoal: vi.fn(),
  deleteGoalItem: actions.deleteGoalItem,
  deleteItemPayment: actions.deleteItemPayment,
  getGoals: vi.fn(),
  updateGoal: vi.fn(),
}));
vi.mock('@/features/household/actions/household-actions', () => ({
  acceptInvite: vi.fn(),
  createHousehold: vi.fn(),
  createInvite: vi.fn(),
  getHousehold: vi.fn(),
}));
vi.mock('@/features/household/actions/spending-actions', () => ({
  addSpending: vi.fn(),
  createSpace: vi.fn(),
  deleteSpace: vi.fn(),
  deleteSpending: actions.deleteSpending,
  getSpaces: vi.fn(),
}));

const CASES = [
  ['entry', useDeleteSpending, ['household', 'spaces']],
  ['item', useDeleteGoalItem, ['household', 'goals']],
  ['payment', useDeleteItemPayment, ['household', 'goals']],
] as const;

describe('delete mutations resolve only after the refetch', () => {
  it.each(CASES)('%s', async (_name, useHook) => {
    const client = new QueryClient();
    let finishRefetch: () => void = () => undefined;
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishRefetch = resolve;
        })
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useHook(), { wrapper });

    let settled = false;
    const done = result.current
      .mutateAsync('id' as never)
      .then(() => (settled = true));
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalled());
    expect(settled).toBe(false);
    finishRefetch();
    await done;
    expect(settled).toBe(true);
  });
});
