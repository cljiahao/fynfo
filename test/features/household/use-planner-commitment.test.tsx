// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const getPlannerCommitment = vi.fn();
vi.mock('@/features/household/actions/planner-actions', () => ({
  getPlannerCommitment: (input: unknown) => getPlannerCommitment(input),
}));

import { usePlannerCommitment } from '@/features/household/hooks/use-planner-commitment';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('usePlannerCommitment', () => {
  it('passes the horizon to the action and returns its data', async () => {
    getPlannerCommitment.mockResolvedValue({ state: 'none' });
    const { result } = renderHook(() => usePlannerCommitment(36), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getPlannerCommitment).toHaveBeenCalledWith({ horizonMonths: 36 });
    expect(result.current.data).toEqual({ state: 'none' });
  });

  it('surfaces a failure without retrying', async () => {
    getPlannerCommitment.mockReset();
    getPlannerCommitment.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => usePlannerCommitment(24), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getPlannerCommitment).toHaveBeenCalledTimes(1);
  });
});
