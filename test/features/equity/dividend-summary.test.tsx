// @vitest-environment jsdom
import { DividendSummary } from '@/features/equity/components/dividend-summary';
import type { DividendData } from '@/features/equity/types';
import {
  AmountVisibilityProvider,
  useAmountVisibility,
} from '@/features/privacy';
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
  getDividends: vi.fn(),
  getTrades: vi.fn(),
  fetchExchangeRate: vi.fn(),
}));
vi.mock('@/features/equity/actions/equity-actions', () => api);
vi.mock('@/features/equity/actions/dividend-actions', () => api);
vi.mock('@/features/equity/actions/price-actions', () => api);

const thisYear = new Date().getFullYear();
const lastYear = thisYear - 1;
const rows: DividendData[] = [
  {
    id: 'a',
    date: `${lastYear - 1}-03-01`,
    ticker: 'DBS',
    amount: 1000,
    currency: 'SGD',
  },
  {
    id: 'b',
    date: `${lastYear}-03-01`,
    ticker: 'DBS',
    amount: 3000,
    currency: 'SGD',
  },
];
const usdRow: DividendData = {
  id: 'c',
  date: `${lastYear}-04-01`,
  ticker: 'VOO',
  amount: 100,
  currency: 'USD',
};

function HideButton() {
  const { hideAmounts } = useAmountVisibility();
  return <button onClick={hideAmounts}>Hide</button>;
}

function mount(props: { monthlyExpenses?: number | null } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AmountVisibilityProvider>
        <HideButton />
        <DividendSummary {...props} />
      </AmountVisibilityProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  api.fetchExchangeRate.mockResolvedValue(1.3);
  api.getTrades.mockResolvedValue([]);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('shows the three SGD cards and the year hint', async () => {
  api.getDividends.mockResolvedValue(rows);
  mount();
  expect(await screen.findByText('Dividends earned')).toBeTruthy();
  expect(screen.getByText('Last 12 months')).toBeTruthy();
  expect(screen.getByText('Average per year')).toBeTruthy();
  expect(screen.getAllByText(/4,000/).length).toBeGreaterThan(0);
  expect(screen.getByText('2 full calendar years')).toBeTruthy();
});

it('masks figures and the chart when amounts are hidden', async () => {
  api.getDividends.mockResolvedValue(rows);
  mount();
  await screen.findByText('Dividends earned');
  fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
  expect(screen.queryByText(/4,000/)).toBeNull();
  expect(screen.getByText('Distribution chart hidden')).toBeTruthy();
});

it('shows the yearly chart by default and the monthly chart after switching', async () => {
  api.getDividends.mockResolvedValue(rows);
  mount();
  await screen.findByText('Dividends earned');
  fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
  const yearly = screen.getByRole('tab', { name: 'Yearly' });
  const monthly = screen.getByRole('tab', { name: 'Monthly' });
  expect(
    screen.getByRole('tablist', { name: 'Dividend chart period' })
  ).toBeTruthy();
  expect(yearly.getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText('Distribution chart hidden')).toBeTruthy();
  expect(screen.queryByText('Monthly distribution chart hidden')).toBeNull();
  fireEvent.mouseDown(monthly, { button: 0, ctrlKey: false });
  expect(
    await screen.findByText('Monthly distribution chart hidden')
  ).toBeTruthy();
  expect(screen.queryByText('Distribution chart hidden')).toBeNull();
});

it('shows Unavailable and a status note when USD rows lack a valid rate', async () => {
  api.getDividends.mockResolvedValue([usdRow]);
  api.fetchExchangeRate.mockRejectedValue(new Error('rate down'));
  mount();
  expect(await screen.findByRole('status')).toBeTruthy();
  await waitFor(() =>
    expect(screen.getAllByText('Unavailable')).toHaveLength(3)
  );
  expect(
    screen.getByText(/Exchange rate unavailable\. Converted dividend totals/)
  ).toBeTruthy();
  expect(screen.queryByText('Distribution chart hidden')).toBeNull();
});

it('notes the exchange-rate estimate when USD rows convert with a valid rate', async () => {
  api.getDividends.mockResolvedValue([usdRow]);
  mount();
  expect(
    await screen.findByText(/SGD totals use a current exchange-rate estimate/)
  ).toBeTruthy();
});

it('omits the exchange-rate estimate note for SGD-only rows', async () => {
  api.getDividends.mockResolvedValue(rows);
  mount();
  await screen.findByText('Dividends earned');
  expect(
    screen.queryByText(/SGD totals use a current exchange-rate estimate/)
  ).toBeNull();
});

it('renders nothing when there are no dividends', async () => {
  api.getDividends.mockResolvedValue([]);
  const { container } = mount();
  await waitFor(() => expect(api.getDividends).toHaveBeenCalled());
  await waitFor(() =>
    expect(
      screen.queryByRole('status', { name: 'Loading dividends' })
    ).toBeNull()
  );
  expect(screen.queryByText('Dividends earned')).toBeNull();
  expect(container.querySelector('section')).toBeNull();
});

it('offers retry when the read fails', async () => {
  api.getDividends
    .mockRejectedValueOnce(new Error('private detail'))
    .mockResolvedValueOnce(rows);
  mount();
  expect(
    await screen.findByRole('alert', { name: 'Couldn’t load dividends' })
  ).toBeTruthy();
  expect(screen.queryByText('private detail')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Dividends earned')).toBeTruthy();
});

it('shows skeletons while pending', () => {
  api.getDividends.mockReturnValue(new Promise(() => {}));
  mount();
  expect(
    screen.getByRole('status', { name: 'Loading dividends' })
  ).toBeTruthy();
  expect(screen.queryByText('Dividends earned')).toBeNull();
});

const recent = (month: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - month);
  return d.toISOString().slice(0, 10);
};
const tickers = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG'];
const manyRows: DividendData[] = tickers.map((ticker, i) => ({
  id: ticker,
  date: recent(1),
  ticker,
  amount: 1200 - i * 100,
  currency: 'SGD',
}));
const trade = {
  id: 't1',
  date: '2020-01-01',
  ticker: 'AAA',
  type: 'BUY',
  shares: 100,
  price: 10,
  fees: 0,
  market: 'SG',
  currency: 'SGD',
};

it('shows average per month, ticker shares, Other bucket and the estimate', async () => {
  api.getDividends.mockResolvedValue(manyRows);
  api.getTrades.mockResolvedValue([trade]);
  mount();
  expect(await screen.findByText('Average per month')).toBeTruthy();
  expect(await screen.findByText('Other (2)')).toBeTruthy();
  expect(screen.getByText('AAA')).toBeTruthy();
  expect(screen.getByText(/Estimate: assumes the last 12 months/)).toBeTruthy();
  expect(screen.getByText(/SGD .* · USD/)).toBeTruthy();
  expect(screen.getByText(/vs prior 12 months/)).toBeTruthy();
});

it('renders a dash for tickers without a yield on cost', async () => {
  api.getDividends.mockResolvedValue(manyRows);
  mount();
  await screen.findByText('Other (2)');
  expect(screen.getAllByText('Yield on cost —').length).toBeGreaterThan(0);
});

it('shows coverage only when monthly expenses are positive', async () => {
  api.getDividends.mockResolvedValue(manyRows);
  mount({ monthlyExpenses: 2000 });
  expect(await screen.findByText(/of planned monthly expenses/)).toBeTruthy();
  cleanup();
  mount({ monthlyExpenses: 0 });
  await screen.findByText('Average per month');
  expect(screen.queryByText(/of planned monthly expenses/)).toBeNull();
});
