// @vitest-environment jsdom
import { InvestmentBreakdown } from '@/features/assets/components/investment-breakdown';
import { MarketAllocationTable } from '@/features/assets/components/market-allocation-table';
import { SalaryPlanner } from '@/features/assets/components/salary-planner';
import type { Holding } from '@/features/equity/lib/holdings';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const external = vi.hoisted(() => ({
  getTrades: vi.fn(),
  fetchStockPrices: vi.fn(),
  fetchExchangeRate: vi.fn(),
  getSalaryRecords: vi.fn(),
  getPlannerSettings: vi.fn(),
  upsertPlannerSettings: vi.fn(),
  getExpenses: vi.fn(),
}));
vi.mock('@/features/equity/actions/equity-actions', () => external);
vi.mock('@/features/equity/actions/price-actions', () => external);
vi.mock('@/features/salary/actions/salary-actions', () => external);
vi.mock('@/features/assets/actions/planner-actions', () => external);
vi.mock('@/features/expenses/actions/expense-actions', () => external);
function mount(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  external.getTrades.mockResolvedValue([]);
  external.fetchStockPrices.mockResolvedValue({});
  external.fetchExchangeRate.mockResolvedValue(1.3);
  external.getSalaryRecords.mockResolvedValue([]);
  external.getPlannerSettings.mockResolvedValue(null);
  external.getExpenses.mockResolvedValue([]);
  external.upsertPlannerSettings.mockResolvedValue(undefined);
});
afterEach(cleanup);
const holding = (ticker: string, shares: number): Holding => ({
  ticker,
  shares,
  market: 'SG',
  totalBuyCost: shares * 10,
  totalBuyShares: shares,
  avgBuyPrice: 10,
  costBasis: shares * 10,
});

it('calculates SG board lots, sorts every numeric column, and routes allocation edits to the right ticker', () => {
  const update = vi.fn();
  mount(
    <MarketAllocationTable
      title="SG portfolio"
      holdings={[holding('ZZZ', 10), holding('AAA', 100)]}
      prices={{
        ZZZ: { price: 20, currency: 'SGD' },
        AAA: { price: 10, currency: 'SGD' },
      }}
      pricesLoading={false}
      allocations={{ ZZZ: 20, AAA: 80 }}
      onAllocationChange={update}
      currency="SGD"
      target={10000}
      usdToSgd={1.3}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'SG portfolio' }));
  const row = screen.getByText('AAA').closest('tr')!;
  expect(within(row).getByText('$8,000.00')).toBeTruthy();
  expect(within(row).getByText('700')).toBeTruthy();
  fireEvent.change(within(row).getByRole('spinbutton'), {
    target: { value: '70' },
  });
  expect(update).toHaveBeenCalledWith('AAA', 70);
  for (const name of ['Current', 'Alloc %', 'Target', 'Lacking', 'Shares']) {
    fireEvent.click(screen.getByRole('columnheader', { name }));
    expect(screen.getAllByRole('row')[1].textContent).toContain('AAA');
    fireEvent.click(screen.getByRole('columnheader', { name }));
    expect(screen.getAllByRole('row')[1].textContent).toContain('ZZZ');
  }
  fireEvent.click(screen.getByRole('columnheader', { name: 'Ticker' }));
  expect(screen.getAllByRole('row')[1].textContent).toContain('AAA');
  fireEvent.click(screen.getByRole('columnheader', { name: 'Ticker' }));
  expect(screen.getAllByRole('row')[1].textContent).toContain('ZZZ');
});

it('converts US target to dollars and suppresses buys when quotes or FX are unavailable', () => {
  const props = {
    title: 'US portfolio',
    holdings: [{ ...holding('AAPL', 1), market: 'US' as const }],
    prices: { AAPL: { price: 100, currency: 'USD' } },
    pricesLoading: true,
    allocations: { AAPL: 100 },
    onAllocationChange: vi.fn(),
    currency: 'USD' as const,
    target: 1300,
    usdToSgd: 1.3,
  };
  const { rerender } = mount(<MarketAllocationTable {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'US portfolio' }));
  expect(
    within(screen.getByText('AAPL').closest('tr')!).getByText('9')
  ).toBeTruthy();
  rerender(
    <MarketAllocationTable
      {...props}
      usdToSgd={0}
      prices={undefined}
      allocations={{}}
    />
  );
  expect(screen.queryByText('9')).toBeNull();
  expect(screen.queryByText('100%')).toBeNull();
});

it('recalculates monthly ratios and complementary cash splits through the container', async () => {
  const budgets = vi.fn();
  mount(
    <InvestmentBreakdown
      investmentAmount={1000}
      emergencyFundGoal={3000}
      warChestGoal={2000}
      snapshot={{
        id: '2026-01',
        entries: [
          { category: 'savings', account: 'Bank', amount: 10000 },
          { category: 'bonds', account: 'Bond', amount: 3000 },
        ],
      }}
      onBudgetsChange={budgets}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: /Monthly Investment/ }));
  const sg = screen.getByText('SG Market').closest('tr')!;
  expect(within(sg).getByText('$500.00')).toBeTruthy();
  fireEvent.change(within(sg).getByRole('spinbutton'), {
    target: { value: '40' },
  });
  expect(screen.getByText('Must sum to 100%')).toBeTruthy();
  expect(within(sg).getByText('$400.00')).toBeTruthy();
  expect(JSON.parse(localStorage.getItem('fynfo-investment-ratios')!)).toEqual({
    rsp: 30,
    us: 20,
    sg: 40,
  });
  fireEvent.click(screen.getByRole('button', { name: /Deployable Cash/ }));
  const inputs = screen.getAllByRole('spinbutton');
  fireEvent.change(inputs[3], { target: { value: '70' } });
  expect((inputs[4] as HTMLInputElement).value).toBe('30');
  fireEvent.change(inputs[4], { target: { value: '25' } });
  expect((inputs[3] as HTMLInputElement).value).toBe('75');
  await waitFor(() =>
    expect(budgets).toHaveBeenLastCalledWith({
      sg: {
        deployableCash: 6000,
        quarterRemaining: 1200,
        quarterSpent: 0,
        quarterly: 1200,
        target: 6000,
      },
      us: {
        deployableCash: 2000,
        quarterRemaining: 600,
        quarterSpent: 0,
        quarterly: 600,
        target: 2000,
      },
    })
  );
});

it('hides an investment breakdown for a zero monthly budget', () => {
  mount(
    <InvestmentBreakdown
      investmentAmount={0}
      emergencyFundGoal={0}
      warChestGoal={0}
    />
  );
  expect(screen.queryByText('Investment Breakdown')).toBeNull();
});

it('uses salary and expenses to calculate goals and saves changed optional deductions after debounce', async () => {
  external.getSalaryRecords.mockResolvedValue([
    { id: '2026-01', salary: 5000, bonus: 0 },
  ]);
  const changed = vi.fn();
  mount(
    <SalaryPlanner
      onPlannerValuesChange={changed}
      snapshot={{
        id: '2026-01',
        entries: [
          { category: 'savings', account: 'Bank', amount: 10000 },
          { category: 'bonds', account: 'Bond', amount: 10000 },
        ],
      }}
    />
  );
  await screen.findByText('Net (after CPF)');
  fireEvent.change(screen.getAllByRole('spinbutton')[1], {
    target: { value: '1000' },
  });
  expect(screen.getByText('Emergency Fund (3mo)')).toBeTruthy();
  expect(
    screen.getByText('All goals fulfilled — surplus goes to investment')
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Tithe' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Allowance' }));
  fireEvent.click(screen.getByRole('button', { name: 'Adjust reserves' }));
  fireEvent.change(screen.getAllByRole('spinbutton')[5], {
    target: { value: '7' },
  });
  fireEvent.change(screen.getAllByRole('spinbutton')[2], {
    target: { value: '4' },
  });
  fireEvent.change(screen.getAllByRole('spinbutton')[3], {
    target: { value: '8' },
  });
  expect(screen.getByText('Allowance (7%)')).toBeTruthy();
  await waitFor(
    () =>
      expect(external.upsertPlannerSettings).toHaveBeenCalledWith({
        emergencyMonths: 4,
        warChestMonths: 8,
        titheEnabled: false,
        tithePct: 10,
        allowanceEnabled: true,
        allowancePct: 7,
      }),
    { timeout: 2000 }
  );
  expect(changed).toHaveBeenLastCalledWith(
    expect.objectContaining({
      emergencyFundGoal: 4000,
      warChestGoal: 8000,
      expenses: 1000,
    })
  );
  fireEvent.change(screen.getAllByRole('spinbutton')[0], {
    target: { value: '' },
  });
  expect(screen.getByText('Enter salary to see allocation')).toBeTruthy();
});

it('clears investment budgets when USD conversion is unavailable while keeping basic inputs', async () => {
  external.getTrades.mockResolvedValue([
    {
      date: '2026-01-01',
      ticker: 'AAPL',
      broker: '',
      action: 'buy',
      shares: 1,
      price: 100,
      fees: 0,
    },
  ]);
  external.fetchStockPrices.mockResolvedValue({
    AAPL: { price: 110, currency: 'USD' },
  });
  external.fetchExchangeRate.mockResolvedValue(null);
  const changed = vi.fn();
  mount(
    <InvestmentBreakdown
      investmentAmount={1000}
      emergencyFundGoal={0}
      warChestGoal={0}
      onBudgetsChange={changed}
    />
  );
  await screen.findByText(/Investment targets unavailable/);
  await waitFor(() =>
    expect(external.fetchStockPrices).toHaveBeenCalledWith(['AAPL'])
  );
  expect(changed).toHaveBeenLastCalledWith(null);
  expect(
    screen.getByRole('button', { name: /Monthly Investment/ })
  ).toBeTruthy();
  expect(screen.queryByText('SG Market Deployment')).toBeNull();
});

it('does not propose shares from incomplete or overflowing allocation data', () => {
  mount(
    <MarketAllocationTable
      title="Incomplete market"
      holdings={[holding('DBS', 100)]}
      prices={{ DBS: { price: Number.MAX_VALUE, currency: 'SGD' } }}
      pricesLoading={false}
      allocations={{ DBS: 100 }}
      onAllocationChange={vi.fn()}
      currency="SGD"
      target={10000}
      usdToSgd={1.3}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Incomplete market' }));
  expect(screen.getByText('Quotes unavailable')).toBeTruthy();
  expect(screen.queryByText(/Infinity/)).toBeNull();
  expect(
    screen.getByRole('spinbutton', { name: 'Allocation for DBS' })
  ).toBeTruthy();
});
