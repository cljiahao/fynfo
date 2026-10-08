// @vitest-environment jsdom
import { DashboardOverview } from '@/app/dashboard/(overview)/dashboard-overview';
import DashboardOverviewPage from '@/app/dashboard/(overview)/page';
import { Providers } from '@/components/layout/providers';
import * as calculations from '@/features/assets/lib/calculations';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  getSnapshots: vi.fn(),
  getSalaryRecords: vi.fn(),
  getPlannerSettings: vi.fn(),
  upsertPlannerSettings: vi.fn(),
  getExpenses: vi.fn(),
  getProfile: vi.fn(),
  getTrades: vi.fn(),
  fetchStockPrices: vi.fn(),
  fetchExchangeRate: vi.fn(),
}));
vi.mock('@/features/assets/actions/snapshot-actions', () => api);
vi.mock('@/features/assets/actions/planner-actions', () => api);
vi.mock('@/features/salary/actions/salary-actions', () => api);
vi.mock('@/features/expenses/actions/expense-actions', () => api);
vi.mock('@/features/profile/actions/profile-actions', () => api);
vi.mock('@/features/equity/actions/equity-actions', () => api);
vi.mock('@/features/equity/actions/price-actions', () => api);
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  api.getSnapshots.mockResolvedValue([
    {
      id: '2026-01',
      entries: [
        { category: 'savings', account: 'Bank', amount: 10000 },
        { category: 'bonds', account: 'Bonds', amount: 5000 },
      ],
    },
  ]);
  api.getSalaryRecords.mockResolvedValue([
    { id: '2026-01', salary: 5000, bonus: 0 },
  ]);
  api.getPlannerSettings.mockResolvedValue(null);
  api.getExpenses.mockResolvedValue([]);
  api.getProfile.mockResolvedValue(null);
  api.getTrades.mockResolvedValue([]);
  api.fetchExchangeRate.mockResolvedValue(1.3);
  api.fetchStockPrices.mockResolvedValue({});
  api.upsertPlannerSettings.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function getAllocationInput(ticker: string, market: string) {
  const trigger = screen.getByRole('button', { name: market });
  if (trigger.getAttribute('aria-expanded') === 'false')
    fireEvent.click(trigger);
  return screen
    .getByText(ticker)
    .closest('tr')!
    .querySelector<HTMLInputElement>('input')!;
}

it('calculates summary totals only for the latest two months of a long history', async () => {
  const total = vi.spyOn(calculations, 'calculateTotal');
  api.getSnapshots.mockResolvedValue(
    Array.from({ length: 100 }, (_, index) => ({
      id: String(index).padStart(3, '0'),
      entries: [
        { category: 'savings', account: 'Bank', amount: (index + 1) * 100 },
      ],
    }))
  );
  render(<Providers>{await DashboardOverviewPage()}</Providers>);
  expect(await screen.findByText('Total Assets')).toBeTruthy();
  expect(screen.getAllByText('$10,000')).toHaveLength(2);
  expect(screen.getByText('+$100')).toBeTruthy();
  expect(total).toHaveBeenCalled();
  expect(total.mock.calls.every(([entries]) => entries[0].amount >= 9900)).toBe(
    true
  );
});

it('keeps assets pending without zero cards while the salary row is ready', async () => {
  let resolveSnapshots!: (value: []) => void;
  api.getSnapshots.mockReturnValue(
    new Promise<[]>((resolve) => {
      resolveSnapshots = resolve;
    })
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <DashboardOverview />
    </QueryClientProvider>
  );
  expect(await screen.findByText('Current Salary')).toBeTruthy();
  expect(screen.getByRole('status', { name: 'Loading assets' })).toBeTruthy();
  expect(screen.queryByText('Total Assets')).toBeNull();
  expect(screen.queryByText('Investment Breakdown')).toBeNull();
  expect(api.getTrades).toHaveBeenCalledOnce();
  resolveSnapshots([]);
  expect(await screen.findByText('Total Assets')).toBeTruthy();
  expect(screen.queryByRole('status', { name: 'Loading assets' })).toBeNull();
});

it('retries a failed snapshot read without displaying an empty asset summary', async () => {
  api.getSnapshots
    .mockRejectedValueOnce(new Error('private database detail'))
    .mockResolvedValue([]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <DashboardOverview />
    </QueryClientProvider>
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Total Assets')).toBeTruthy();
  expect(api.getSnapshots).toHaveBeenCalledTimes(2);
  expect(screen.queryByText('private database detail')).toBeNull();
});

it('keeps a failed salary summary unavailable while loaded assets remain visible', async () => {
  api.getSalaryRecords
    .mockRejectedValueOnce(new Error('private salary detail'))
    .mockResolvedValue([]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 300000 } },
  });
  render(
    <QueryClientProvider client={client}>
      <DashboardOverview />
    </QueryClientProvider>
  );
  const retry = await screen.findByRole('button', { name: 'Try again' });
  expect(screen.getByText('Total Assets')).toBeTruthy();
  expect(screen.queryByText('Current Salary')).toBeNull();
  expect(screen.queryByText('Investment Breakdown')).toBeNull();
  expect(screen.queryByText('private salary detail')).toBeNull();
  fireEvent.click(retry);
  expect(await screen.findByText('Current Salary')).toBeTruthy();
  expect(api.getSalaryRecords).toHaveBeenCalledTimes(2);
});

it('hydrates all four server datasets into the real overview without fetching them again on mount', async () => {
  const page = await DashboardOverviewPage();
  render(<Providers>{page}</Providers>);
  expect(await screen.findByText('Net (after CPF)')).toBeTruthy();
  expect(screen.getAllByText('$15,000')).toHaveLength(2);
  expect(
    screen.getByRole('link', { name: 'Add Snapshot' }).getAttribute('href')
  ).toBe('/dashboard/entry');
  expect(screen.getByText('Investment Breakdown')).toBeTruthy();
  for (const read of [
    api.getSnapshots,
    api.getSalaryRecords,
    api.getPlannerSettings,
    api.getExpenses,
  ])
    expect(read).toHaveBeenCalledOnce();
  fireEvent.change(screen.getAllByRole('spinbutton')[1], {
    target: { value: '1000' },
  });
  expect(screen.getByText('Emergency Fund (3mo)')).toBeTruthy();
  expect(screen.getByText(/need \$4,000\.00/)).toBeTruthy();
});

it('keeps planner inputs unavailable after an upstream error and restores calculated amounts on retry', async () => {
  api.getExpenses
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue([]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 300000 } },
  });
  render(
    <QueryClientProvider client={client}>
      <DashboardOverview />
    </QueryClientProvider>
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Net (after CPF)')).toBeTruthy();
  expect(screen.getByText('$4,000.00')).toBeTruthy();
  expect((screen.getAllByRole('spinbutton')[0] as HTMLInputElement).value).toBe(
    '5000'
  );
  expect(api.getExpenses).toHaveBeenCalledTimes(2);
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  );
});

it('shows zero-state salary/planner values when all prefetched datasets are empty', async () => {
  api.getSnapshots.mockResolvedValue([]);
  api.getSalaryRecords.mockResolvedValue([]);
  render(<Providers>{await DashboardOverviewPage()}</Providers>);
  expect(
    await screen.findByText('Enter salary to see allocation')
  ).toBeTruthy();
  expect(screen.queryByText('Investment Breakdown')).toBeNull();
  expect(screen.getByRole('link', { name: 'Add Snapshot' })).toBeTruthy();
});

it('connects calculated market budgets to real ticker allocation edits without persisting sensitive targets', async () => {
  api.getTrades.mockResolvedValue([
    {
      id: 'sg',
      date: '2026-01-01',
      broker: 'Broker',
      ticker: 'DBS',
      action: 'buy',
      shares: 100,
      price: 10,
      fees: 0,
    },
    {
      id: 'us',
      date: '2026-01-01',
      broker: 'Broker',
      ticker: 'AAPL',
      action: 'buy',
      shares: 10,
      price: 100,
      fees: 0,
    },
  ]);
  api.fetchStockPrices.mockResolvedValue({
    DBS: { price: 12, currency: 'SGD' },
    AAPL: { price: 110, currency: 'USD' },
  });
  localStorage.setItem('fynfo-allocations', JSON.stringify({ DBS: 90 }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 300000 } },
  });
  render(
    <QueryClientProvider client={client}>
      {await DashboardOverviewPage()}
    </QueryClientProvider>
  );
  await screen.findByRole('button', { name: 'SG Stocks' });
  const sgInput = getAllocationInput('DBS', 'SG Stocks');
  expect(sgInput.value).toBe('');
  fireEvent.change(sgInput, { target: { value: '100' } });
  expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
  const usInput = getAllocationInput('AAPL', 'US Stocks');
  fireEvent.change(usInput, { target: { value: '50' } });
  expect(screen.getByText('50%')).toBeTruthy();
  expect(localStorage.getItem('fynfo-allocations')).toBeNull();
  expect(api.fetchStockPrices).toHaveBeenCalledWith(['DBS', 'AAPL']);

  fireEvent.change(screen.getAllByRole('spinbutton')[0], {
    target: { value: '8000' },
  });
  api.getSnapshots.mockRejectedValueOnce(new Error('offline'));
  await client.invalidateQueries({ queryKey: ['snapshots'] });
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  );
  expect((screen.getAllByRole('spinbutton')[0] as HTMLInputElement).value).toBe(
    '8000'
  );
  expect(getAllocationInput('AAPL', 'US Stocks').value).toBe('50');
  expect(getAllocationInput('DBS', 'SG Stocks').value).toBe('100');

  api.getExpenses.mockRejectedValueOnce(new Error('offline'));
  await client.invalidateQueries({ queryKey: ['expenses'] });
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  );
  expect((screen.getAllByRole('spinbutton')[0] as HTMLInputElement).value).toBe(
    '8000'
  );
  expect(getAllocationInput('DBS', 'SG Stocks').value).toBe('100');
});
