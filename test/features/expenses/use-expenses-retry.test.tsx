// @vitest-environment jsdom
import { useExpenses } from '@/features/expenses/hooks/use-expenses';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ calls: 0, reason: '' }));

vi.mock('@/features/expenses/actions/expense-actions', () => ({
  getExpenses: async () => {
    state.calls += 1;
    throw new Error(state.reason);
  },
}));

async function runFailingRead(message: string) {
  state.reason = message;
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useExpenses(), { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  return result.current.failureCount;
}

describe('useExpenses retry policy', () => {
  beforeEach(() => {
    state.calls = 0;
  });

  it.each(['Request timed out', 'Something transient'])(
    'attempts a failing read exactly twice (%s)',
    async (message) => {
      const failures = await runFailingRead(message);
      expect(state.calls).toBe(2);
      expect(failures).toBe(2);
    }
  );
});
