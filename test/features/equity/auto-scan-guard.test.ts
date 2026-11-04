import type { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const autoScanDividends = vi.fn();

vi.mock('@/features/equity/actions/dividend-actions', () => ({
  autoScanDividends,
}));
vi.mock('@/features/equity/hooks/use-dividends', () => ({
  DIVIDENDS_KEY: ['dividends'],
}));
vi.mock('@/lib/query-refresh', () => ({
  refreshQueriesAfterMutation: vi.fn(),
}));
vi.mock('@/lib/utils/local-store', () => ({
  loadLocal: (_key: string, fallback: unknown) => fallback,
  saveLocal: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const queryClient = {} as QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runDividendAutoScan concurrency guard', () => {
  it('runs the scan once for overlapping calls by the same user', async () => {
    let release: (v: { added: number }) => void = () => {};
    autoScanDividends.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    const { runDividendAutoScan } =
      await import('@/features/equity/lib/auto-scan');

    const first = runDividendAutoScan('user-1', queryClient);
    const second = runDividendAutoScan('user-1', queryClient);
    await second;
    release({ added: 0 });
    await first;

    expect(autoScanDividends).toHaveBeenCalledTimes(1);

    autoScanDividends.mockResolvedValue({ added: 0 });
    await runDividendAutoScan('user-1', queryClient);
    expect(autoScanDividends).toHaveBeenCalledTimes(2);
  });
});
