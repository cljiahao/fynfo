// @vitest-environment jsdom
import {
  usePlannerSettings,
  useUpsertPlannerSettings,
} from '@/features/assets/hooks/use-planner-settings';
import {
  useDeleteSnapshot,
  useSnapshot,
  useSnapshots,
  useUpsertSnapshot,
} from '@/features/assets/hooks/use-snapshots';
import {
  useCreateDividend,
  useCreateDividends,
  useDeleteDividend,
  useDividends,
  useUpdateDividend,
} from '@/features/equity/hooks/use-dividends';
import {
  useCreateTrade,
  useDeleteTrade,
  useTrades,
  useUpdateTrade,
} from '@/features/equity/hooks/use-equity';
import {
  useAcceptInvite,
  useAddContribution,
  useCreateGoal,
  useCreateHousehold,
  useDeleteGoal,
  useGoals,
  useHousehold,
  useUnlockHousehold,
} from '@/features/household/hooks/use-household';
import {
  useProfile,
  useUpsertProfile,
} from '@/features/profile/hooks/use-profile';
import {
  useDeleteSalary,
  useSalaryRecord,
  useSalaryRecords,
  useUpsertSalary,
} from '@/features/salary/hooks/use-salary';
import {
  useTaxReliefs,
  useUpsertTaxReliefs,
} from '@/features/salary/hooks/use-tax-reliefs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getSnapshots: vi.fn(),
  getSnapshot: vi.fn(),
  upsertSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
  getPlannerSettings: vi.fn(),
  upsertPlannerSettings: vi.fn(),
  getSalaryRecords: vi.fn(),
  getSalaryRecord: vi.fn(),
  upsertSalaryRecord: vi.fn(),
  deleteSalaryRecord: vi.fn(),
  getTaxReliefs: vi.fn(),
  upsertTaxReliefs: vi.fn(),
  getTrades: vi.fn(),
  createTrade: vi.fn(),
  updateTrade: vi.fn(),
  deleteTrade: vi.fn(),
  getDividends: vi.fn(),
  createDividend: vi.fn(),
  createDividends: vi.fn(),
  updateDividend: vi.fn(),
  deleteDividend: vi.fn(),
  getProfile: vi.fn(),
  upsertProfile: vi.fn(),
  getHousehold: vi.fn(),
  createHousehold: vi.fn(),
  unlockHousehold: vi.fn(),
  acceptInvite: vi.fn(),
  getGoals: vi.fn(),
  createGoal: vi.fn(),
  addContribution: vi.fn(),
  deleteGoal: vi.fn(),
}));
vi.mock('@/features/assets/actions/snapshot-actions', () => api);
vi.mock('@/features/assets/actions/planner-actions', () => api);
vi.mock('@/features/salary/actions/salary-actions', () => api);
vi.mock('@/features/salary/actions/relief-actions', () => api);
vi.mock('@/features/equity/actions/equity-actions', () => api);
vi.mock('@/features/equity/actions/dividend-actions', () => api);
vi.mock('@/features/profile/actions/profile-actions', () => api);
vi.mock('@/features/household/actions/household-actions', () => api);
vi.mock('@/features/household/actions/goal-actions', () => api);

const snapshot = { id: '2026-01', entries: [] };
const salary = { id: '2026-01', salary: 100, bonus: 0 };
const planner = {
  emergencyMonths: 3,
  warChestMonths: 3,
  titheEnabled: false,
  tithePct: 0,
  allowanceEnabled: false,
  allowancePct: 0,
};
const trade = {
  date: '2026-01-01',
  broker: 'Synthetic',
  ticker: 'TEST',
  action: 'buy' as const,
  shares: 1,
  price: 100,
  fees: 0,
};
const dividend = {
  date: '2026-01-01',
  ticker: 'TEST',
  amount: 1,
  currency: 'SGD' as const,
};
type ReadState = { data: unknown; isSuccess: boolean; isError: boolean };
type Case = {
  name: string;
  readNames: (keyof typeof api)[];
  mutationName: keyof typeof api;
  useRead: () => ReadState[];
  useRun: () => () => Promise<unknown>;
  awaited?: boolean;
};
function useSnapshotReads() {
  return [useSnapshots(), useSnapshot('2026-01')];
}
function useSalaryReads() {
  return [useSalaryRecords(), useSalaryRecord('2026-01')];
}
function useHouseholdReads() {
  return [useHousehold(), useGoals(true)];
}
const cases: Case[] = [
  {
    name: 'snapshot save',
    readNames: ['getSnapshots', 'getSnapshot'],
    mutationName: 'upsertSnapshot',
    useRead: useSnapshotReads,
    useRun() {
      const mutation = useUpsertSnapshot();
      return () => mutation.mutateAsync({ data: snapshot });
    },
  },
  {
    name: 'snapshot delete',
    readNames: ['getSnapshots', 'getSnapshot'],
    mutationName: 'deleteSnapshot',
    useRead: useSnapshotReads,
    useRun() {
      const mutation = useDeleteSnapshot();
      return () => mutation.mutateAsync('2026-01');
    },
  },
  {
    name: 'salary save',
    readNames: ['getSalaryRecords', 'getSalaryRecord'],
    mutationName: 'upsertSalaryRecord',
    useRead: useSalaryReads,
    useRun() {
      const mutation = useUpsertSalary();
      return () => mutation.mutateAsync(salary);
    },
  },
  {
    name: 'salary delete',
    readNames: ['getSalaryRecords', 'getSalaryRecord'],
    mutationName: 'deleteSalaryRecord',
    useRead: useSalaryReads,
    useRun() {
      const mutation = useDeleteSalary();
      return () => mutation.mutateAsync('2026-01');
    },
  },
  {
    name: 'planner save',
    readNames: ['getPlannerSettings'],
    mutationName: 'upsertPlannerSettings',
    useRead() {
      return [usePlannerSettings()];
    },
    useRun() {
      const mutation = useUpsertPlannerSettings();
      return () => mutation.mutateAsync(planner);
    },
  },
  {
    name: 'trade create',
    readNames: ['getTrades'],
    mutationName: 'createTrade',
    useRead() {
      return [useTrades()];
    },
    useRun() {
      const mutation = useCreateTrade();
      return () => mutation.mutateAsync(trade);
    },
  },
  {
    name: 'trade update',
    readNames: ['getTrades'],
    mutationName: 'updateTrade',
    useRead() {
      return [useTrades()];
    },
    useRun() {
      const mutation = useUpdateTrade();
      return () => mutation.mutateAsync({ id: 'synthetic-trade', data: trade });
    },
  },
  {
    name: 'trade delete',
    readNames: ['getTrades'],
    mutationName: 'deleteTrade',
    useRead() {
      return [useTrades()];
    },
    useRun() {
      const mutation = useDeleteTrade();
      return () => mutation.mutateAsync('synthetic-trade');
    },
  },
  {
    name: 'dividend create',
    readNames: ['getDividends'],
    mutationName: 'createDividend',
    useRead() {
      return [useDividends()];
    },
    useRun() {
      const mutation = useCreateDividend();
      return () => mutation.mutateAsync(dividend);
    },
  },
  {
    name: 'dividend bulk create',
    readNames: ['getDividends'],
    mutationName: 'createDividends',
    useRead() {
      return [useDividends()];
    },
    useRun() {
      const mutation = useCreateDividends();
      return () => mutation.mutateAsync([dividend]);
    },
  },
  {
    name: 'dividend update',
    readNames: ['getDividends'],
    mutationName: 'updateDividend',
    useRead() {
      return [useDividends()];
    },
    useRun() {
      const mutation = useUpdateDividend();
      return () =>
        mutation.mutateAsync({ id: 'synthetic-dividend', data: dividend });
    },
  },
  {
    name: 'dividend delete',
    readNames: ['getDividends'],
    mutationName: 'deleteDividend',
    useRead() {
      return [useDividends()];
    },
    useRun() {
      const mutation = useDeleteDividend();
      return () => mutation.mutateAsync('synthetic-dividend');
    },
  },
  {
    name: 'profile save',
    readNames: ['getProfile'],
    mutationName: 'upsertProfile',
    useRead() {
      return [useProfile()];
    },
    useRun() {
      const mutation = useUpsertProfile();
      return () =>
        mutation.mutateAsync({
          birthYear: 1990,
          isNsman: false,
          residencyStatus: 'resident',
        });
    },
  },
  {
    name: 'tax relief save',
    readNames: ['getTaxReliefs'],
    mutationName: 'upsertTaxReliefs',
    useRead() {
      return [useTaxReliefs(2026)];
    },
    useRun() {
      const mutation = useUpsertTaxReliefs(2026);
      return () => mutation.mutateAsync([]);
    },
  },
  {
    name: 'household create',
    readNames: ['getHousehold', 'getGoals'],
    mutationName: 'createHousehold',
    useRead: useHouseholdReads,
    useRun() {
      const mutation = useCreateHousehold();
      return () => mutation.mutateAsync('Synthetic household');
    },
  },
  {
    name: 'household unlock',
    readNames: ['getHousehold', 'getGoals'],
    mutationName: 'unlockHousehold',
    useRead: useHouseholdReads,
    useRun() {
      const mutation = useUnlockHousehold();
      return () => mutation.mutateAsync();
    },
  },
  {
    name: 'household accept',
    readNames: ['getHousehold', 'getGoals'],
    mutationName: 'acceptInvite',
    useRead: useHouseholdReads,
    useRun() {
      const mutation = useAcceptInvite();
      return () => mutation.mutateAsync('synthetic-invite');
    },
  },
  {
    name: 'goal create',
    readNames: ['getGoals'],
    mutationName: 'createGoal',
    awaited: true,
    useRead() {
      return [useGoals(true)];
    },
    useRun() {
      const mutation = useCreateGoal();
      return () =>
        mutation.mutateAsync({ name: 'Synthetic goal', targetAmount: 100 });
    },
  },
  {
    name: 'goal contribute',
    readNames: ['getGoals'],
    mutationName: 'addContribution',
    awaited: true,
    useRead() {
      return [useGoals(true)];
    },
    useRun() {
      const mutation = useAddContribution();
      return () =>
        mutation.mutateAsync({
          goalId: 'synthetic-goal',
          amount: 1,
          date: '2026-01-01',
        });
    },
  },
  {
    name: 'goal delete',
    readNames: ['getGoals'],
    mutationName: 'deleteGoal',
    awaited: true,
    useRead() {
      return [useGoals(true)];
    },
    useRun() {
      const mutation = useDeleteGoal();
      return () => mutation.mutateAsync('synthetic-goal');
    },
  },
];
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const clients: QueryClient[] = [];
beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(api)) fn.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  for (const client of clients) client.clear();
  clients.length = 0;
});
function setup(testCase: Case) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 300000 },
      mutations: { retry: false },
    },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...renderHook(
      () => ({ queries: testCase.useRead(), run: testCase.useRun() }),
      { wrapper }
    ),
  };
}
describe('confirmed mutation query freshness', () => {
  it('keeps post-save refetch failure visible rather than accepting an older response', async () => {
    const old = deferred();
    api.getSnapshots
      .mockReturnValueOnce(old.promise)
      .mockRejectedValueOnce(new Error('synthetic read failure'));
    api.getSnapshot.mockResolvedValue(null);
    const { result } = setup(cases[0]);
    await waitFor(() => expect(api.getSnapshots).toHaveBeenCalledOnce());
    await act(async () => {
      await result.current.run();
    });
    await waitFor(() => expect(result.current.queries[0].isError).toBe(true));
    await act(async () => {
      old.resolve({ generation: 'pre-write' });
      await Promise.resolve();
    });
    expect(result.current.queries[0].isError).toBe(true);
    expect(result.current.queries[0].data).toBeUndefined();
  });

  it('does not repopulate a cleared cache when the confirmed write finishes after teardown', async () => {
    const read = deferred();
    const write = deferred();
    api.getSnapshots.mockReturnValueOnce(read.promise);
    api.getSnapshot.mockResolvedValue(null);
    api.upsertSnapshot.mockReturnValueOnce(write.promise);
    const { client, result, unmount } = setup(cases[0]);
    await waitFor(() => expect(api.getSnapshots).toHaveBeenCalledOnce());
    let mutation!: Promise<unknown>;
    act(() => {
      mutation = result.current.run();
      unmount();
      client.clear();
    });
    await act(async () => {
      write.resolve(undefined);
      await mutation;
      read.resolve({ generation: 'pre-lock' });
      await Promise.resolve();
    });
    expect(client.getQueryData(['snapshots'])).toBeUndefined();
    expect(client.getQueryData(['snapshots', '2026-01'])).toBeUndefined();
    expect(api.getSnapshots).toHaveBeenCalledOnce();
  });

  it('refreshes only the saved query family and retains an unrelated pending read', async () => {
    const old = deferred();
    api.getSnapshots
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ generation: 'post-write' });
    api.getSnapshot.mockResolvedValue(null);
    const { client, result } = setup(cases[0]);
    const unrelated = deferred();
    const otherRead = client.fetchQuery({
      queryKey: ['unrelated-fixture'],
      queryFn: () => unrelated.promise,
    });
    await waitFor(() => expect(api.getSnapshots).toHaveBeenCalledOnce());
    await act(async () => {
      await result.current.run();
      old.resolve({ generation: 'pre-write' });
    });
    unrelated.resolve({ generation: 'untouched' });
    await expect(otherRead).resolves.toEqual({ generation: 'untouched' });
    expect(client.getQueryData(['unrelated-fixture'])).toEqual({
      generation: 'untouched',
    });
  });

  it('discards a first refresh when a second confirmed save starts another refresh', async () => {
    const initial = deferred();
    const firstRefresh = deferred();
    const secondRefresh = deferred();
    api.getSnapshots
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(firstRefresh.promise)
      .mockReturnValueOnce(secondRefresh.promise);
    api.getSnapshot.mockResolvedValue(null);
    const { result } = setup(cases[0]);
    await waitFor(() => expect(api.getSnapshots).toHaveBeenCalledOnce());
    await act(async () => {
      await result.current.run();
    });
    await waitFor(() => expect(api.getSnapshots).toHaveBeenCalledTimes(2));
    await act(async () => {
      await result.current.run();
    });
    await waitFor(() => expect(api.getSnapshots).toHaveBeenCalledTimes(3));
    await act(async () => {
      initial.resolve({ generation: 'initial' });
      firstRefresh.resolve({ generation: 'first-refresh' });
      await Promise.resolve();
    });
    expect(result.current.queries[0].data).toBeUndefined();
    await act(async () => {
      secondRefresh.resolve({ generation: 'second-refresh' });
    });
    await waitFor(() =>
      expect(result.current.queries[0].data).toEqual({
        generation: 'second-refresh',
      })
    );
  });

  for (const testCase of cases) {
    it(`${testCase.name}: discards pending history/detail reads before publishing the post-write result`, async () => {
      const reads = testCase.readNames.map((name) => {
        const old = deferred();
        const fresh = deferred();
        api[name]
          .mockReturnValueOnce(old.promise)
          .mockReturnValueOnce(fresh.promise);
        return { name, old, fresh };
      });
      const { result } = setup(testCase);
      let settled = false;
      let mutation: Promise<unknown> | undefined;
      try {
        await waitFor(() => {
          for (const read of reads)
            expect(api[read.name]).toHaveBeenCalledOnce();
        });
        act(() => {
          mutation = result.current.run();
          void mutation.then(() => {
            settled = true;
          });
        });
        await waitFor(() => {
          for (const read of reads)
            expect(api[read.name]).toHaveBeenCalledTimes(2);
        });
        if (testCase.awaited) expect(settled).toBe(false);
        else await waitFor(() => expect(settled).toBe(true));
        await act(async () => {
          for (const read of reads)
            read.old.resolve({ generation: 'pre-write' });
          await Promise.resolve();
        });
        expect(result.current.queries.every((query) => !query.isSuccess)).toBe(
          true
        );
        expect(
          result.current.queries.every((query) => query.data === undefined)
        ).toBe(true);
        await act(async () => {
          for (const read of reads)
            read.fresh.resolve({ generation: 'post-write' });
          await mutation;
        });
        await waitFor(() =>
          expect(
            result.current.queries.every(
              (query) =>
                query.isSuccess &&
                JSON.stringify(query.data) === '{"generation":"post-write"}'
            )
          ).toBe(true)
        );
      } finally {
        for (const read of reads) {
          read.old.resolve({ generation: 'cleanup' });
          read.fresh.resolve({ generation: 'cleanup' });
        }
        await mutation?.catch(() => {});
      }
    });
    it(`${testCase.name}: a failed write leaves the valid pending read intact`, async () => {
      const reads = testCase.readNames.map((name) => {
        const pending = deferred();
        api[name].mockReturnValueOnce(pending.promise);
        return { name, pending };
      });
      api[testCase.mutationName].mockRejectedValueOnce(
        new Error('synthetic write failure')
      );
      const { client, result } = setup(testCase);
      const cancel = vi.spyOn(client, 'cancelQueries');
      await waitFor(() => {
        for (const read of reads) expect(api[read.name]).toHaveBeenCalledOnce();
      });
      await act(async () => {
        await expect(result.current.run()).rejects.toThrow(
          'synthetic write failure'
        );
        for (const read of reads)
          read.pending.resolve({ generation: 'valid-read' });
      });
      await waitFor(() =>
        expect(result.current.queries.every((query) => query.isSuccess)).toBe(
          true
        )
      );
      expect(cancel).not.toHaveBeenCalled();
      for (const read of reads) expect(api[read.name]).toHaveBeenCalledOnce();
    });
  }
});
