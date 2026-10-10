// @vitest-environment jsdom
import { Providers } from '@/components/layout/providers';
import { VaultGate } from '@/components/layout/vault-gate';
import { usePlannerSettings, useSnapshots } from '@/features/assets';
import {
  AuthIdentityWatcher,
  VaultLockProvider,
  useVaultLock,
} from '@/features/auth';
import { useTrades, type EquityTradeData } from '@/features/equity';
import { useUpdateTrade } from '@/features/equity/hooks/use-equity';
import type { ExpenseData } from '@/features/expenses';
import { useExpenses } from '@/features/expenses';
import {
  useDeleteExpense,
  useSettleSplit,
  useUpsertExpense,
} from '@/features/expenses/hooks/use-expenses';
import { OverviewReadProvider } from '@/features/overview';
import { useSalaryRecords } from '@/features/salary';
import { refreshQueriesAfterMutation } from '@/lib/query-refresh';
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode, useLayoutEffect } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getOverviewReads: vi.fn(),
  getSnapshots: vi.fn(),
  getSalaryRecords: vi.fn(),
  getPlannerSettings: vi.fn(),
  getExpenses: vi.fn(),
  getTrades: vi.fn(),
  updateTrade: vi.fn(),
  upsertExpense: vi.fn(),
  deleteExpense: vi.fn(),
  settleSplit: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  callbacks: new Set<
    (event: string, session: { user: { id: string } } | null) => void
  >(),
}));
vi.mock('@/features/overview/actions/overview-actions', () => api);
vi.mock('@/features/assets/actions/snapshot-actions', () => api);
vi.mock('@/features/assets/actions/planner-actions', () => api);
vi.mock('@/features/salary/actions/salary-actions', () => api);
vi.mock('@/features/expenses/actions/expense-actions', () => api);
vi.mock('@/features/equity/actions/equity-actions', () => api);
vi.mock('@/integrations/clients/supabase', () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'synthetic-a' } } }),
      onAuthStateChange: (
        callback: (
          event: string,
          session: { user: { id: string } } | null
        ) => void
      ) => {
        auth.callbacks.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => auth.callbacks.delete(callback),
            },
          },
        };
      },
    },
  }),
}));
let client: QueryClient;
const planner = {
  emergencyMonths: 3,
  warChestMonths: 3,
  titheEnabled: false,
  tithePct: 0,
  allowanceEnabled: false,
  allowancePct: 0,
};
function Readers() {
  const snapshots = useSnapshots();
  const salary = useSalaryRecords();
  const settings = usePlannerSettings();
  const expenses = useExpenses();
  const trades = useTrades();
  return (
    <>
      <output aria-label="snapshots">
        {snapshots.isSuccess ? 'assets ready' : 'assets pending'}
      </output>
      <button onClick={() => void salary.refetch()}>Retry salary</button>
      <output aria-label="salary">
        {salary.isSuccess
          ? 'salary ready'
          : salary.isError
            ? 'salary failed'
            : 'salary pending'}
      </output>
      <output aria-label="planner">
        {settings.isSuccess ? 'planner ready' : 'planner pending'}
      </output>
      <output aria-label="expenses">
        {expenses.isSuccess ? 'expenses ready' : 'expenses pending'}
      </output>
      <button onClick={() => void trades.refetch()}>Retry trades</button>
      <output aria-label="trades">
        {trades.isSuccess
          ? 'trades ready'
          : trades.isError
            ? 'trades failed'
            : 'trades pending'}
      </output>
    </>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  api.getSnapshots.mockResolvedValue([]);
  api.getSalaryRecords.mockResolvedValue([]);
  api.getExpenses.mockResolvedValue([]);
  api.getTrades.mockResolvedValue([]);
  api.getPlannerSettings.mockResolvedValue(planner);
  api.getOverviewReads.mockResolvedValue({
    snapshots: Promise.resolve({ ok: true, data: [] }),
    salary: Promise.resolve({ ok: true, data: [] }),
    planner: Promise.resolve({ ok: true, data: planner }),
    expenses: Promise.resolve({ ok: true, data: [] }),
    trades: Promise.resolve({ ok: true, data: [] }),
  });
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    },
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  auth.callbacks.clear();
  vi.unstubAllGlobals();
});
function mount(strict = false) {
  const tree = (
    <QueryClientProvider client={client}>
      <OverviewReadProvider>
        <Readers />
      </OverviewReadProvider>
    </QueryClientProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

it('uses one five-source pending cohort for actual overview hooks', async () => {
  mount();
  await screen.findByText('assets ready');
  await screen.findByText('salary ready');
  await screen.findByText('planner ready');
  await screen.findByText('expenses ready');
  expect(api.getOverviewReads).toHaveBeenCalledExactlyOnceWith([
    'snapshots',
    'salary',
    'planner',
    'expenses',
    'trades',
  ]);
  for (const read of [
    api.getSnapshots,
    api.getSalaryRecords,
    api.getPlannerSettings,
    api.getExpenses,
    api.getTrades,
  ])
    expect(read).not.toHaveBeenCalled();
});
it('preserves warm successful owner caches without forcing sources', async () => {
  client.setQueryData(['snapshots'], []);
  client.setQueryData(['salary'], []);
  client.setQueryData(['planner-settings'], planner);
  client.setQueryData(['expenses'], []);
  client.setQueryData(['equity-trades'], []);
  mount();
  await screen.findByText('expenses ready');
  expect(api.getOverviewReads).not.toHaveBeenCalled();
});
it('preserves a missing planner result as successful null data', async () => {
  api.getOverviewReads.mockResolvedValue({
    planner: Promise.resolve({ ok: true, data: null }),
  });
  function PlannerReader() {
    const settings = usePlannerSettings();
    return (
      <output>
        {settings.isSuccess && settings.data === null
          ? 'planner defaults available'
          : 'planner pending'}
      </output>
    );
  }
  render(
    <QueryClientProvider client={client}>
      <OverviewReadProvider>
        <PlannerReader />
      </OverviewReadProvider>
    </QueryClientProvider>
  );
  await screen.findByText('planner defaults available');
  expect(client.getQueryData(['planner-settings'])).toBeNull();
  expect(api.getOverviewReads).toHaveBeenCalledExactlyOnceWith(['planner']);
  expect(api.getPlannerSettings).not.toHaveBeenCalled();
});
function withTrades(
  trades: Promise<
    { ok: true; data: EquityTradeData[] } | { ok: false; code: 'UNAVAILABLE' }
  >
) {
  return {
    snapshots: Promise.resolve({ ok: true, data: [] }),
    salary: Promise.resolve({ ok: true, data: [] }),
    planner: Promise.resolve({ ok: true, data: planner }),
    expenses: Promise.resolve({ ok: true, data: [] }),
    trades,
  };
}
it('keeps core actual-hook data ready while the same-cohort trades remain slow', async () => {
  const slow = deferred<{ ok: true; data: EquityTradeData[] }>();
  api.getOverviewReads.mockResolvedValue(withTrades(slow.promise));
  mount();
  await screen.findByText('assets ready');
  await screen.findByText('salary ready');
  await screen.findByText('expenses ready');
  expect(screen.getByLabelText('trades')).toHaveTextContent('trades pending');
  expect(api.getOverviewReads).toHaveBeenCalledExactlyOnceWith([
    'snapshots',
    'salary',
    'planner',
    'expenses',
    'trades',
  ]);
  expect(api.getTrades).not.toHaveBeenCalled();
  await act(async () => slow.resolve({ ok: true, data: [] }));
  await screen.findByText('trades ready');
});
it('retries only a failed trade source and preserves the other ready datasets', async () => {
  api.getOverviewReads
    .mockResolvedValueOnce(
      withTrades(Promise.resolve({ ok: false, code: 'UNAVAILABLE' }))
    )
    .mockResolvedValue({ trades: Promise.resolve({ ok: true, data: [] }) });
  mount();
  await screen.findByText('trades failed');
  expect(screen.getByLabelText('snapshots')).toHaveTextContent('assets ready');
  fireEvent.click(screen.getByRole('button', { name: 'Retry trades' }));
  await screen.findByText('trades ready');
  expect(api.getOverviewReads).toHaveBeenLastCalledWith(['trades']);
  expect(api.getOverviewReads).toHaveBeenCalledTimes(2);
  expect(api.getTrades).not.toHaveBeenCalled();
});
it('does not reread a warm trade history when other overview sources are cold', async () => {
  client.setQueryData(['equity-trades'], []);
  mount();
  await screen.findByText('assets ready');
  await screen.findByText('trades ready');
  expect(api.getOverviewReads).toHaveBeenCalledExactlyOnceWith([
    'snapshots',
    'salary',
    'planner',
    'expenses',
  ]);
  expect(api.getTrades).not.toHaveBeenCalled();
});
it('keeps the original action path outside overview', async () => {
  render(
    <QueryClientProvider client={client}>
      <Readers />
    </QueryClientProvider>
  );
  await screen.findByText('assets ready');
  await screen.findByText('expenses ready');
  expect(api.getOverviewReads).not.toHaveBeenCalled();
  for (const read of [
    api.getSnapshots,
    api.getSalaryRecords,
    api.getPlannerSettings,
    api.getExpenses,
    api.getTrades,
  ])
    expect(read).toHaveBeenCalledOnce();
});
it('survives actual StrictMode cleanup and setup without a dead transport', async () => {
  mount(true);
  await waitFor(() =>
    expect(screen.getByLabelText('snapshots')).toHaveTextContent('assets ready')
  );
  await screen.findByText('salary ready');
  expect(api.getOverviewReads).toHaveBeenCalledOnce();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const syntheticExpense: ExpenseData = {
  id: 'synthetic-expense',
  date: '2026-01-02',
  type: 'food_drink',
  item: 'Synthetic meal',
  info: '',
  amount: 42,
  splitType: 'self',
  splits: [],
};
it('keeps a genuinely pending source alive after StrictMode setup with retry disabled', async () => {
  const slow = deferred<{ ok: true; data: [] }>();
  api.getOverviewReads.mockImplementation(async () => ({
    snapshots: slow.promise,
    salary: Promise.resolve({ ok: true, data: [] }),
    planner: Promise.resolve({ ok: true, data: planner }),
    expenses: Promise.resolve({ ok: true, data: [] }),
    trades: Promise.resolve({ ok: true, data: [] }),
  }));
  mount(true);
  await screen.findByText('salary ready');
  expect(screen.getByLabelText('snapshots')).toHaveTextContent(
    'assets pending'
  );
  expect(api.getOverviewReads).toHaveBeenCalledOnce();
  await act(async () => slow.resolve({ ok: true, data: [] }));
  await screen.findByText('assets ready');
  expect(api.getOverviewReads).toHaveBeenCalledOnce();
});
it('rejects a late response after owner cache clear without recreating the removed query', async () => {
  const slow = deferred<{ ok: true; data: [] }>();
  api.getOverviewReads.mockResolvedValue({ snapshots: slow.promise });
  const view = mount();
  await waitFor(() => expect(api.getOverviewReads).toHaveBeenCalledOnce());
  act(() => client.clear());
  await act(async () => slow.resolve({ ok: true, data: [] }));
  expect(client.getQueryData(['snapshots'])).toBeUndefined();
  view.unmount();
});
it('uses a fresh failed-only subset retry rather than replaying ready source outcomes', async () => {
  api.getOverviewReads
    .mockResolvedValueOnce({
      snapshots: Promise.resolve({ ok: true, data: [] }),
      salary: Promise.resolve({ ok: false, code: 'UNAVAILABLE' }),
      planner: Promise.resolve({ ok: true, data: planner }),
      expenses: Promise.resolve({ ok: true, data: [] }),
      trades: Promise.resolve({ ok: true, data: [] }),
    })
    .mockResolvedValue({
      salary: Promise.resolve({
        ok: true,
        data: [{ id: '2026-01', salary: 5, bonus: 0 }],
      }),
    });
  mount();
  await screen.findByText('assets ready');
  await waitFor(() =>
    expect(client.getQueryState(['salary'])?.status).toBe('error')
  );
  await screen.findByText('salary failed');
  fireEvent.click(screen.getByRole('button', { name: 'Retry salary' }));
  await screen.findByText('salary ready');
  expect(api.getOverviewReads.mock.calls).toEqual([
    [['snapshots', 'salary', 'planner', 'expenses', 'trades']],
    [['salary']],
  ]);
  expect(client.getQueryData(['salary'])).toEqual([
    { id: '2026-01', salary: 5, bonus: 0 },
  ]);
});
it('cancels an old salary outcome before a post-write subset refresh', async () => {
  const old = deferred<{ ok: true; data: [] }>();
  api.getOverviewReads
    .mockResolvedValueOnce({
      snapshots: Promise.resolve({ ok: true, data: [] }),
      salary: old.promise,
      planner: Promise.resolve({ ok: true, data: planner }),
      expenses: Promise.resolve({ ok: true, data: [] }),
      trades: Promise.resolve({ ok: true, data: [] }),
    })
    .mockResolvedValue({
      salary: Promise.resolve({
        ok: true,
        data: [{ id: '2026-02', salary: 9, bonus: 0 }],
      }),
    });
  mount();
  await screen.findByText('assets ready');
  await act(async () => refreshQueriesAfterMutation(client, ['salary']));
  await act(async () => old.resolve({ ok: true, data: [] }));
  expect(client.getQueryData(['salary'])).toEqual([
    { id: '2026-02', salary: 9, bonus: 0 },
  ]);
  expect(api.getOverviewReads.mock.calls).toEqual([
    [['snapshots', 'salary', 'planner', 'expenses', 'trades']],
    [['salary']],
  ]);
});
function ExpenseEditor() {
  const query = useExpenses();
  const mutation = useUpsertExpense();
  return (
    <>
      <button onClick={() => mutation.mutate(syntheticExpense)}>
        Save synthetic expense
      </button>
      <output>{query.data?.[0]?.amount ?? 'No expense'}</output>
    </>
  );
}
it('keeps the actual optimistic expense patch when a pre-write bundle read finishes late', async () => {
  const old = deferred<{ ok: true; data: ExpenseData[] }>();
  api.getOverviewReads.mockResolvedValue({ expenses: old.promise });
  api.upsertExpense.mockResolvedValue(undefined);
  render(
    <QueryClientProvider client={client}>
      <OverviewReadProvider>
        <ExpenseEditor />
      </OverviewReadProvider>
    </QueryClientProvider>
  );
  await waitFor(() =>
    expect(api.getOverviewReads).toHaveBeenCalledExactlyOnceWith(['expenses'])
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Save synthetic expense' })
  );
  await screen.findByText('42');
  await act(async () =>
    old.resolve({ ok: true, data: [{ ...syntheticExpense, amount: 1 }] })
  );
  expect(client.getQueryData(['expenses'])).toEqual([syntheticExpense]);
  expect(api.getOverviewReads).toHaveBeenCalledOnce();
  expect(api.upsertExpense).toHaveBeenCalledExactlyOnceWith(syntheticExpense);
});
function LifetimeControls() {
  const owner = useVaultLock();
  const ownerClient = useQueryClient();
  useLayoutEffect(() => {
    client = ownerClient;
    ownerClient.setDefaultOptions({
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    });
  }, [ownerClient]);
  return (
    <>
      <button
        onClick={() => {
          owner.lock();
          ownerClient.clear();
        }}
      >
        Lock owner
      </button>
      <button onClick={owner.unlock}>Unlock owner</button>
    </>
  );
}
it.each(['SIGNED_OUT', 'SIGNED_IN'])(
  'honors actual095 providers on%s and ignores late owner responses',
  async (event) => {
    const old = deferred<{ ok: true; data: [] }>();
    api.getOverviewReads.mockResolvedValue({
      snapshots: old.promise,
      salary: Promise.resolve({ ok: true, data: [] }),
      planner: Promise.resolve({ ok: true, data: planner }),
      expenses: Promise.resolve({ ok: true, data: [] }),
      trades: old.promise,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {}))
    );
    render(
      <Providers>
        <VaultLockProvider initiallyUnlocked userId="synthetic-a">
          <LifetimeControls />
          <AuthIdentityWatcher userId="synthetic-a" />
          <VaultGate>
            <OverviewReadProvider>
              <Readers />
            </OverviewReadProvider>
          </VaultGate>
        </VaultLockProvider>
      </Providers>
    );
    await screen.findByText('salary ready');
    act(() => {
      for (const callback of auth.callbacks)
        callback(
          event,
          event === 'SIGNED_OUT' ? null : { user: { id: 'synthetic-b' } }
        );
    });
    await act(async () => old.resolve({ ok: true, data: [] }));
    expect(client.getQueryData(['snapshots'])).toBeUndefined();
    expect(client.getQueryData(['equity-trades'])).toBeUndefined();
    expect(screen.queryByText('assets ready')).not.toBeInTheDocument();
    expect(screen.queryByText('trades ready')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock owner' }));
    expect(screen.queryByText('salary ready')).not.toBeInTheDocument();
    expect(api.getOverviewReads).toHaveBeenCalledOnce();
  }
);
it('unmounts actual locked financial children and starts fresh readers after unlock', async () => {
  const old = deferred<{ ok: true; data: [] }>();
  api.getOverviewReads
    .mockResolvedValueOnce({
      snapshots: old.promise,
      salary: Promise.resolve({ ok: true, data: [] }),
      planner: Promise.resolve({ ok: true, data: planner }),
      expenses: Promise.resolve({ ok: true, data: [] }),
      trades: old.promise,
    })
    .mockResolvedValue({
      snapshots: Promise.resolve({ ok: true, data: [] }),
      salary: Promise.resolve({ ok: true, data: [] }),
      planner: Promise.resolve({ ok: true, data: planner }),
      expenses: Promise.resolve({ ok: true, data: [] }),
      trades: Promise.resolve({ ok: true, data: [] }),
    });
  render(
    <Providers>
      <VaultLockProvider initiallyUnlocked userId="synthetic-a">
        <LifetimeControls />
        <VaultGate>
          <OverviewReadProvider>
            <Readers />
          </OverviewReadProvider>
        </VaultGate>
      </VaultLockProvider>
    </Providers>
  );
  await screen.findByText('salary ready');
  fireEvent.click(screen.getByRole('button', { name: 'Lock owner' }));
  await act(async () => old.resolve({ ok: true, data: [] }));
  expect(client.getQueryData(['snapshots'])).toBeUndefined();
  expect(client.getQueryData(['equity-trades'])).toBeUndefined();
  expect(screen.queryByText('assets ready')).not.toBeInTheDocument();
  expect(screen.queryByText('trades ready')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Unlock owner' }));
  await screen.findByText('assets ready');
  await screen.findByText('trades ready');
  expect(api.getOverviewReads).toHaveBeenCalledTimes(2);
});
function SnapshotReader({ label }: { label: string }) {
  const query = useSnapshots();
  return (
    <output aria-label={label}>
      {query.isSuccess ? 'ready' : query.isError ? 'failed' : 'pending'}
    </output>
  );
}
const syntheticTrade: EquityTradeData = {
  id: 'synthetic-trade',
  date: '2026-10-01',
  broker: 'Synthetic broker',
  ticker: 'SYN',
  action: 'buy',
  shares: 1,
  price: 19,
  fees: 0,
};
function TradeReader() {
  const query = useTrades();
  const update = useUpdateTrade();
  return (
    <>
      <output aria-label="trade price">
        {query.isSuccess ? (query.data[0]?.price ?? 'empty') : 'pending'}
      </output>
      <button
        onClick={() =>
          update.mutate({ id: 'synthetic-trade', data: syntheticTrade })
        }
      >
        Update synthetic trade
      </button>
    </>
  );
}
it('cancels pre-write trades and starts a fresh trade-only cohort through the actual mutation hook', async () => {
  const old = deferred<{ ok: true; data: EquityTradeData[] }>();
  api.getOverviewReads
    .mockResolvedValueOnce({ trades: old.promise })
    .mockResolvedValue({
      trades: Promise.resolve({ ok: true, data: [syntheticTrade] }),
    });
  api.updateTrade.mockResolvedValue(undefined);
  render(
    <QueryClientProvider client={client}>
      <OverviewReadProvider>
        <TradeReader />
      </OverviewReadProvider>
    </QueryClientProvider>
  );
  await waitFor(() => expect(api.getOverviewReads).toHaveBeenCalledOnce());
  fireEvent.click(
    screen.getByRole('button', { name: 'Update synthetic trade' })
  );
  await waitFor(() =>
    expect(screen.getByLabelText('trade price')).toHaveTextContent('19')
  );
  await act(async () =>
    old.resolve({ ok: true, data: [{ ...syntheticTrade, price: 1 }] })
  );
  expect(client.getQueryData(['equity-trades'])).toEqual([syntheticTrade]);
  expect(api.getOverviewReads.mock.calls).toEqual([[['trades']], [['trades']]]);
  expect(api.updateTrade).toHaveBeenCalledOnce();
  expect(api.getTrades).not.toHaveBeenCalled();
});
it('aborts a sole pending trade observer and uses a fresh cohort after remount', async () => {
  const old = deferred<{ ok: true; data: EquityTradeData[] }>();
  api.getOverviewReads
    .mockResolvedValueOnce({ trades: old.promise })
    .mockResolvedValue({
      trades: Promise.resolve({ ok: true, data: [syntheticTrade] }),
    });
  const tree = (show: boolean) => (
    <QueryClientProvider client={client}>
      {show && (
        <OverviewReadProvider>
          <TradeReader />
        </OverviewReadProvider>
      )}
    </QueryClientProvider>
  );
  const view = render(tree(true));
  await waitFor(() => expect(api.getOverviewReads).toHaveBeenCalledOnce());
  view.rerender(tree(false));
  await act(async () =>
    old.resolve({ ok: true, data: [{ ...syntheticTrade, price: 1 }] })
  );
  expect(client.getQueryData(['equity-trades'])).toBeUndefined();
  view.rerender(tree(true));
  await waitFor(() =>
    expect(screen.getByLabelText('trade price')).toHaveTextContent('19')
  );
  expect(api.getOverviewReads.mock.calls).toEqual([[['trades']], [['trades']]]);
});
it('does not strand a surviving nonoverview observer when its pending cohort provider unmounts', async () => {
  const old = deferred<{ ok: true; data: [] }>();
  api.getOverviewReads.mockResolvedValue({ snapshots: old.promise });
  const tree = (overview: boolean) => (
    <QueryClientProvider client={client}>
      {overview && (
        <OverviewReadProvider>
          <SnapshotReader label="overview snapshot" />
        </OverviewReadProvider>
      )}
      <SnapshotReader label="outside snapshot" />
    </QueryClientProvider>
  );
  const view = render(tree(true));
  await waitFor(() => expect(api.getOverviewReads).toHaveBeenCalledOnce());
  view.rerender(tree(false));
  expect(screen.getByLabelText('outside snapshot')).toHaveTextContent(
    'pending'
  );
  await act(async () => old.resolve({ ok: true, data: [] }));
  await waitFor(() =>
    expect(screen.getByLabelText('outside snapshot')).toHaveTextContent('ready')
  );
  expect(api.getSnapshots).not.toHaveBeenCalled();
  expect(api.getOverviewReads).toHaveBeenCalledOnce();
});
it('aborts a sole unmounted query and starts a fresh cohort on remount without cache clear', async () => {
  const old = deferred<{ ok: true; data: [] }>();
  api.getOverviewReads
    .mockResolvedValueOnce({ snapshots: old.promise })
    .mockResolvedValue({ snapshots: Promise.resolve({ ok: true, data: [] }) });
  const tree = (show: boolean) => (
    <QueryClientProvider client={client}>
      {show && (
        <OverviewReadProvider>
          <SnapshotReader label="snapshot" />
        </OverviewReadProvider>
      )}
    </QueryClientProvider>
  );
  const view = render(tree(true));
  await waitFor(() => expect(api.getOverviewReads).toHaveBeenCalledOnce());
  view.rerender(tree(false));
  await act(async () => old.resolve({ ok: true, data: [] }));
  expect(client.getQueryData(['snapshots'])).toBeUndefined();
  view.rerender(tree(true));
  await waitFor(() =>
    expect(screen.getByLabelText('snapshot')).toHaveTextContent('ready')
  );
  expect(api.getOverviewReads).toHaveBeenCalledTimes(2);
});
function ExpenseMutation({ kind }: { kind: 'upsert' | 'delete' | 'settle' }) {
  useExpenses();
  const upsert = useUpsertExpense();
  const remove = useDeleteExpense();
  const settle = useSettleSplit();
  return (
    <button
      onClick={() =>
        kind === 'upsert'
          ? upsert.mutate(syntheticExpense)
          : kind === 'delete'
            ? remove.mutate(syntheticExpense.id)
            : settle.mutate({
                expenseIds: [syntheticExpense.id],
                person: 'Synthetic partner',
                settled: true,
              })
      }
    >
      Mutate expense
    </button>
  );
}
it.each(['delete', 'settle'] as const)(
  'keeps the actual optimistic %s when an old pending expense read completes',
  async (kind) => {
    const row: ExpenseData = {
      ...syntheticExpense,
      splitType: 'shared',
      splits: [{ person: 'Synthetic partner', amount: 5, settled: false }],
    };
    client.setQueryData(['expenses'], [row]);
    await client.invalidateQueries({ queryKey: ['expenses'] });
    const old = deferred<{ ok: true; data: ExpenseData[] }>();
    api.getOverviewReads.mockResolvedValue({ expenses: old.promise });
    api.deleteExpense.mockResolvedValue(undefined);
    api.settleSplit.mockResolvedValue(undefined);
    render(
      <QueryClientProvider client={client}>
        <OverviewReadProvider>
          <ExpenseMutation kind={kind} />
        </OverviewReadProvider>
      </QueryClientProvider>
    );
    await waitFor(() =>
      expect(api.getOverviewReads).toHaveBeenCalledExactlyOnceWith(['expenses'])
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mutate expense' }));
    const expected =
      kind === 'delete'
        ? []
        : [{ ...row, splits: [{ ...row.splits[0], settled: true }] }];
    await waitFor(() =>
      expect(client.getQueryData(['expenses'])).toEqual(expected)
    );
    await act(async () => old.resolve({ ok: true, data: [row] }));
    expect(client.getQueryData(['expenses'])).toEqual(expected);
    expect(api.getOverviewReads).toHaveBeenCalledOnce();
  }
);
it.each(['upsert', 'delete', 'settle'] as const)(
  'preserves actual %s failure rollback after an older bundle response',
  async (kind) => {
    const previous: ExpenseData = {
      ...syntheticExpense,
      amount: 19,
      splitType: 'shared',
      splits: [{ person: 'Synthetic partner', amount: 5, settled: false }],
    };
    client.setQueryData(['expenses'], [previous]);
    await client.invalidateQueries({ queryKey: ['expenses'] });
    const old = deferred<{ ok: true; data: ExpenseData[] }>();
    const mutation = deferred<void>();
    api.getOverviewReads.mockResolvedValue({ expenses: old.promise });
    api.upsertExpense.mockReturnValue(mutation.promise);
    api.deleteExpense.mockReturnValue(mutation.promise);
    api.settleSplit.mockReturnValue(mutation.promise);
    render(
      <QueryClientProvider client={client}>
        <OverviewReadProvider>
          <ExpenseMutation kind={kind} />
        </OverviewReadProvider>
      </QueryClientProvider>
    );
    await waitFor(() => expect(api.getOverviewReads).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Mutate expense' }));
    const optimistic =
      kind === 'upsert'
        ? [syntheticExpense]
        : kind === 'delete'
          ? []
          : [
              {
                ...previous,
                splits: [{ ...previous.splits[0], settled: true }],
              },
            ];
    await waitFor(() =>
      expect(client.getQueryData(['expenses'])).toEqual(optimistic)
    );
    await act(async () => mutation.reject(new Error('Synthetic write failed')));
    await waitFor(() =>
      expect(client.getQueryData(['expenses'])).toEqual([previous])
    );
    await act(async () =>
      old.resolve({ ok: true, data: [{ ...previous, amount: 1 }] })
    );
    expect(client.getQueryData(['expenses'])).toEqual([previous]);
    expect(api.getOverviewReads).toHaveBeenCalledOnce();
  }
);
