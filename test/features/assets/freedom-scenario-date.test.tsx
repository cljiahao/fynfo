// @vitest-environment jsdom
import { FreedomScenarioDate } from '@/features/assets/components/freedom-scenario-date';
import { useFreedomAssumptions } from '@/features/assets/hooks/use-freedom-inputs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getPlannerSettings: vi.fn(),
  upsertPlannerSettings: vi.fn(),
  snapshots: [] as unknown[],
}));
vi.mock('@/features/assets/actions/planner-actions', () => ({
  getPlannerSettings: api.getPlannerSettings,
  upsertPlannerSettings: api.upsertPlannerSettings,
}));
vi.mock('@/features/assets/hooks/use-snapshots', () => ({
  useSnapshots: () => ({ data: api.snapshots }),
}));

const SETTINGS = {
  emergencyMonths: 6,
  warChestMonths: 6,
  titheEnabled: false,
  tithePct: 10,
  allowanceEnabled: false,
  allowancePct: 5,
  expenseBufferPct: 0,
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  api.upsertPlannerSettings.mockResolvedValue(undefined);
  api.snapshots = [
    {
      id: '2026-10',
      entries: [{ category: 'stocks', account: 'a', amount: 100_000 }],
    },
  ];
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('FreedomScenarioDate', () => {
  it('labels its basis and shows the assumptions beside the date', async () => {
    api.getPlannerSettings.mockResolvedValue({
      ...SETTINGS,
      freedomRealReturnPct: 4,
      freedomWithdrawalRatePct: 3.5,
    });
    render(
      <FreedomScenarioDate
        expenses={3000}
        investmentAmt={1000}
        netAfterCpf={8000}
        savingsAmt={0}
      />,
      { wrapper }
    );
    const line = await screen.findByTestId('scenario-freedom-date');
    expect(line).toHaveTextContent('Projected freedom date (scenario basis):');
    expect(line).toHaveTextContent('(at 4% real return, 3.5% withdrawal rate)');
  });

  it('renders nothing until assumptions are saved', async () => {
    api.getPlannerSettings.mockResolvedValue(SETTINGS);
    render(
      <FreedomScenarioDate
        expenses={3000}
        investmentAmt={1000}
        netAfterCpf={8000}
        savingsAmt={0}
      />,
      { wrapper }
    );
    await waitFor(() => expect(api.getPlannerSettings).toHaveBeenCalled());
    expect(screen.queryByTestId('scenario-freedom-date')).toBeNull();
  });
});

describe('useFreedomAssumptions session override', () => {
  const next = { realReturnPct: 4, withdrawalRatePct: 3.5, targetYear: null };

  it('keeps saved values session-only while the columns are absent', async () => {
    api.getPlannerSettings.mockResolvedValue(SETTINGS);
    const { result } = renderHook(() => useFreedomAssumptions(), { wrapper });
    await waitFor(() => expect(api.getPlannerSettings).toHaveBeenCalled());
    expect(result.current.persisted).toBe(true);

    await act(() => result.current.save(next));
    await waitFor(() => expect(result.current.persisted).toBe(false));
    expect(result.current.assumptions).toEqual(next);
  });

  it('lets server values win once the refetch returns them', async () => {
    api.getPlannerSettings.mockResolvedValue(SETTINGS);
    const { result } = renderHook(() => useFreedomAssumptions(), { wrapper });
    await waitFor(() => expect(api.getPlannerSettings).toHaveBeenCalled());

    api.getPlannerSettings.mockResolvedValue({
      ...SETTINGS,
      freedomRealReturnPct: 5,
      freedomWithdrawalRatePct: 4,
    });
    await act(() => result.current.save(next));
    await waitFor(() =>
      expect(result.current.assumptions.realReturnPct).toBe(5)
    );
    expect(result.current.persisted).toBe(true);
    expect(result.current.assumptions.withdrawalRatePct).toBe(4);
  });
});
