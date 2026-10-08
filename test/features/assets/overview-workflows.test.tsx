// @vitest-environment jsdom
import { DashboardOverview } from '@/app/dashboard/(overview)/dashboard-overview';
import DashboardOverviewPage from '@/app/dashboard/(overview)/page';
import { Providers } from '@/components/layout/providers';
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
afterEach(cleanup);

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
  render(<Providers>{await DashboardOverviewPage()}</Providers>);
  fireEvent.click(await screen.findByRole('button', { name: 'SG Stocks' }));
  const sgInput = screen
    .getByText('DBS')
    .closest('tr')!
    .querySelector('input')!;
  expect(sgInput.value).toBe('');
  fireEvent.change(sgInput, { target: { value: '100' } });
  expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'US Stocks' }));
  const usInput = screen
    .getByText('AAPL')
    .closest('tr')!
    .querySelector('input')!;
  fireEvent.change(usInput, { target: { value: '50' } });
  expect(screen.getByText('50%')).toBeTruthy();
  expect(localStorage.getItem('fynfo-allocations')).toBeNull();
  expect(api.fetchStockPrices).toHaveBeenCalledWith(['DBS', 'AAPL']);
});
