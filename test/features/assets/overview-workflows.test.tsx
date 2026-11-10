// @vitest-environment jsdom
import { DashboardOverview } from '@/app/dashboard/(overview)/dashboard-overview';
import DashboardOverviewPage from '@/app/dashboard/(overview)/page';
import { Providers } from '@/components/layout/providers';
import * as calculations from '@/features/assets/lib/calculations';
import { OverviewPrefetch } from '@/features/overview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { salaryRow } from '../../helpers/salary-fixture';
const api = vi.hoisted(() => ({
  getSnapshots: vi.fn(),
  getSalaryRecords: vi.fn(),
  getPlannerSettings: vi.fn(),
  upsertPlannerSettings: vi.fn(),
  getExpenses: vi.fn(),
  getProfile: vi.fn(),
  getTrades: vi.fn(),
  getDividends: vi.fn(),
  fetchStockPrices: vi.fn(),
  fetchExchangeRate: vi.fn(),
  getHouseholdPlanInput: vi.fn(),
}));
vi.mock('@/features/assets/actions/snapshot-actions', () => api);
vi.mock('@/features/assets/actions/planner-actions', () => api);
vi.mock('@/features/household/actions/plan-actions', () => api);
vi.mock('@/features/salary/actions/salary-actions', () => api);
vi.mock('@/features/expenses/actions/expense-actions', () => api);
vi.mock('@/features/profile/actions/profile-actions', () => api);
vi.mock('@/features/equity/actions/equity-actions', () => api);
vi.mock('@/features/equity/actions/dividend-actions', () => api);
vi.mock('@/features/equity/actions/price-actions', () => api);
// No test here asserts chart output; rendering real recharts dominates runtime under coverage.
vi.mock('@/lib/recharts', () => {
  const Empty = () => null;
  return {
    CHART_AXIS_TICK_PROPS: {},
    CHART_TOOLTIP_PROPS: {},
    Cell: Empty,
    Bar: Empty,
    BarChart: Empty,
    LabelList: Empty,
    Legend: Empty,
    Line: Empty,
    LineChart: Empty,
    Pie: Empty,
    PieChart: Empty,
    ReferenceLine: Empty,
    ResponsiveContainer: Empty,
    Tooltip: Empty,
    XAxis: Empty,
    YAxis: Empty,
  };
});
// UI fixtures use the actual cohort action; boundary security is tested separately.
vi.mock('@/lib/action-guard', () => ({ requireActionContext: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  api.getSnapshots.mockResolvedValue([
    {
      id: '2026-01',
      entries: [
        { category: 'savings', account: 'Bank', amount: 10000 },
        { category: 'bonds', account: 'Bonds', amount: 5000 },
      ],
    },
  ]);
  api.getSalaryRecords.mockResolvedValue([salaryRow('2026-01', 5000, 0)]);
  api.getPlannerSettings.mockResolvedValue(null);
  api.getExpenses.mockResolvedValue([]);
  api.getProfile.mockResolvedValue(null);
  api.getTrades.mockResolvedValue([]);
  api.getDividends.mockResolvedValue([]);
  api.fetchExchangeRate.mockResolvedValue(1.3);
  api.fetchStockPrices.mockResolvedValue({});
  api.upsertPlannerSettings.mockResolvedValue(undefined);
  api.getHouseholdPlanInput.mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function getPrefetchedOverview() {
  const page = DashboardOverviewPage();
  expect(page.type).toBe(OverviewPrefetch);
  return OverviewPrefetch(page.props);
}
function getAllocationInput(ticker: string, market: string) {
  const trigger = screen.getByText(market).closest('button')!;
  if (trigger.getAttribute('aria-expanded') === 'false')
    fireEvent.click(trigger);
  return screen
    .getByText(ticker)
    .closest('tr')!
    .querySelector<HTMLInputElement>('input')!;
}

it('calculates the high-level asset total only for the latest snapshot', async () => {
  const total = vi.spyOn(calculations, 'calculateTotal');
  api.getSnapshots.mockResolvedValue(
    Array.from({ length: 100 }, (_, index) => ({
      id: String(index).padStart(3, '0'),
      entries: [
        { category: 'savings', account: 'Bank', amount: (index + 1) * 100 },
      ],
    }))
  );
  render(<Providers>{await getPrefetchedOverview()}</Providers>);
  expect(await screen.findByText('Total Assets')).toBeTruthy();
  expect(screen.getAllByText('$10,000')).toHaveLength(1);
  expect(screen.queryByText('Savings Change')).toBeNull();
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
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <DashboardOverview />
    </QueryClientProvider>
  );
  expect(await screen.findByText('Salary')).toBeTruthy();
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
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
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
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, staleTime: 300000 },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <DashboardOverview />
    </QueryClientProvider>
  );
  const retry = await screen.findByRole('button', { name: 'Try again' });
  expect(screen.getByText('Total Assets')).toBeTruthy();
  expect(screen.queryByText('Salary')).toBeNull();
  expect(screen.queryByText('Investment Breakdown')).toBeNull();
  expect(screen.queryByText('private salary detail')).toBeNull();
  fireEvent.click(retry);
  expect(await screen.findByText('Salary')).toBeTruthy();
  expect(api.getSalaryRecords).toHaveBeenCalledTimes(2);
});

it('hydrates all four server datasets into the real overview without fetching them again on mount', async () => {
  const page = await getPrefetchedOverview();
  render(<Providers>{page}</Providers>);
  expect(await screen.findByText('Salary')).toBeTruthy();
  expect(screen.getAllByText('$15,000')).toHaveLength(1);
  expect(
    screen.getByRole('link', { name: 'Add Snapshot' }).getAttribute('href')
  ).toBe('/dashboard/entry');
  expect(screen.queryByText('Investment Breakdown')).toBeNull();
  expect(await screen.findByText('Net (after CPF)')).toBeTruthy();
  const tabs = screen.getAllByRole('button').map((b) => b.textContent);
  expect(tabs.indexOf('Overview')).toBeLessThan(tabs.indexOf('Investments'));
  expect(screen.queryByText('Plan income')).toBeNull();
  for (const read of [
    api.getSnapshots,
    api.getSalaryRecords,
    api.getPlannerSettings,
    api.getExpenses,
  ])
    expect(read).toHaveBeenCalledOnce();
  fireEvent.change(screen.getAllByRole('spinbutton')[0], {
    target: { value: '1000' },
  });
  expect(screen.getByText('Custom')).toBeTruthy();
  expect(
    screen.getByRole('progressbar', { name: 'Emergency fund' })
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Investments' }));
  expect(await screen.findByText('Investment Breakdown')).toBeTruthy();
});

it('keeps planner inputs unavailable after an upstream error and restores calculated amounts on retry', async () => {
  api.getExpenses.mockRejectedValue(new Error('offline'));

  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, staleTime: 300000 },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <DashboardOverview />
    </QueryClientProvider>
  );
  const retryButton = await screen.findByRole('button', { name: 'Retry' });
  api.getExpenses.mockResolvedValue([]);
  fireEvent.click(retryButton);
  expect(await screen.findByText('Net (after CPF)')).toBeTruthy();
  expect(screen.getByText('$4,000.00')).toBeTruthy();
  expect(screen.getByTestId('planner-salary').textContent).toContain('$5,000');
  expect(api.getExpenses).toHaveBeenCalledTimes(3);
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  );
});

it('shows zero-state salary/planner values when all prefetched datasets are empty', async () => {
  api.getSnapshots.mockResolvedValue([]);
  api.getSalaryRecords.mockResolvedValue([]);
  render(<Providers>{await getPrefetchedOverview()}</Providers>);
  expect(
    await screen.findByRole('link', { name: 'Add your first snapshot' })
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Investments' }));
  expect(
    await screen.findByText('Enter salary to see allocation')
  ).toBeTruthy();
  expect(screen.queryByText('Investment Breakdown')).toBeNull();
  expect(screen.getByRole('link', { name: 'Add Snapshot' })).toBeTruthy();
});

it('reviews a selected month using existing records and hides failed review totals', async () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, staleTime: 300000 },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <DashboardOverview />
    </QueryClientProvider>
  );
  await screen.findByText('Salary');
  fireEvent.click(screen.getByRole('button', { name: 'Review month' }));
  fireEvent.change(screen.getByLabelText('Month'), {
    target: { value: '2026-01' },
  });
  expect(screen.getByText('Asset change from 2025-12')).toBeTruthy();
  expect(screen.getByText('Needs both snapshots')).toBeTruthy();
  expect(
    screen.queryByRole('link', { name: 'Add your first snapshot' })
  ).toBeNull();
  api.getExpenses.mockRejectedValue(new Error('private expense details'));
  await client.invalidateQueries({ queryKey: ['expenses'] });
  const retry = await screen.findByRole('button', {
    name: 'Retry monthly review',
  });
  expect(screen.queryByText('Recorded gross income')).toBeNull();
  api.getExpenses.mockResolvedValue([]);
  fireEvent.click(retry);
  expect(await screen.findByText('Recorded gross income')).toBeTruthy();
  expect(screen.queryByText('private expense details')).toBeNull();
});

const holdings = [
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
];

async function renderPlannerWithHoldings() {
  api.getTrades.mockResolvedValue(holdings);
  api.fetchStockPrices.mockResolvedValue({
    DBS: { price: 12, currency: 'SGD' },
    AAPL: { price: 110, currency: 'USD' },
  });
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, staleTime: 300000 },
    },
  });
  render(
    <QueryClientProvider client={client}>
      {await getPrefetchedOverview()}
    </QueryClientProvider>
  );
  fireEvent.click(screen.getByText('Investments'));
  await screen.findByText('SG Stocks');
  return client;
}

async function enterPlannerEdits() {
  const client = await renderPlannerWithHoldings();
  fireEvent.change(getAllocationInput('DBS', 'SG Stocks'), {
    target: { value: '100' },
  });
  fireEvent.change(getAllocationInput('AAPL', 'US Stocks'), {
    target: { value: '50' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
  await screen.findByText('Gross Salary');
  fireEvent.click(screen.getByRole('button', { name: 'Investments' }));
  await screen.findByText('SG Stocks');
  return client;
}

it('connects calculated market budgets to real ticker allocation edits without persisting sensitive targets', async () => {
  localStorage.setItem('fynfo-allocations', JSON.stringify({ DBS: 90 }));
  await renderPlannerWithHoldings();
  const sgInput = getAllocationInput('DBS', 'SG Stocks');
  expect(sgInput.value).toBe('');
  fireEvent.change(sgInput, { target: { value: '100' } });
  expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
  const usInput = getAllocationInput('AAPL', 'US Stocks');
  fireEvent.change(usInput, { target: { value: '50' } });
  expect(screen.getByText('50%')).toBeTruthy();
  expect(localStorage.getItem('fynfo-allocations')).toBeNull();
  expect(api.fetchStockPrices).toHaveBeenCalledWith(
    ['DBS', 'AAPL'],
    expect.anything()
  );
});

it('keeps planner allocation edits after a snapshot read is retried', async () => {
  const client = await enterPlannerEdits();
  api.getSnapshots.mockRejectedValueOnce(new Error('offline'));
  await client.invalidateQueries({ queryKey: ['snapshots'] });
  fireEvent.click(screen.getByText('Overview'));
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  );
  expect(screen.getByTestId('planner-salary').textContent).toContain('$5,000');
  fireEvent.click(screen.getByText('Investments'));
  expect(getAllocationInput('AAPL', 'US Stocks').value).toBe('50');
  expect(getAllocationInput('DBS', 'SG Stocks').value).toBe('100');
});

it('keeps planner allocation edits after an expense read is retried', async () => {
  const client = await enterPlannerEdits();
  api.getExpenses.mockRejectedValue(new Error('offline'));
  await client.invalidateQueries({ queryKey: ['expenses'] });
  fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
  const retryButton = await screen.findByRole('button', { name: 'Retry' });
  api.getExpenses.mockResolvedValue([]);
  fireEvent.click(retryButton);
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  );
  expect(screen.getByTestId('planner-salary').textContent).toContain('$5,000');
  fireEvent.click(screen.getByText('Investments'));
  expect(getAllocationInput('DBS', 'SG Stocks').value).toBe('100');
});
