// @vitest-environment jsdom
import { DistributionsSection } from '@/features/equity/components/distributions-section';
import { DividendFormDialog } from '@/features/equity/components/dividend-form';
import { DividendScanDialog } from '@/features/equity/components/dividend-scan-dialog';
import { DividendTable } from '@/features/equity/components/dividend-table';
import { HoldingsTable } from '@/features/equity/components/holdings-table';
import { PortfolioSummary } from '@/features/equity/components/portfolio-summary';
import { TradeFormDialog } from '@/features/equity/components/trade-form';
import { TradeTable } from '@/features/equity/components/trade-table';
import { YieldOnCostTable } from '@/features/equity/components/yield-on-cost-table';
import { useTrades } from '@/features/equity/hooks/use-equity';
import type { DividendData, EquityTradeData } from '@/features/equity/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  createTrade: vi.fn(),
  updateTrade: vi.fn(),
  deleteTrade: vi.fn(),
  getTrades: vi.fn(),
  createDividend: vi.fn(),
  createDividends: vi.fn(),
  updateDividend: vi.fn(),
  deleteDividend: vi.fn(),
  getDividends: vi.fn(),
  fetchDividends: vi.fn(),
  fetchStockPrices: vi.fn(),
  fetchExchangeRate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/features/equity/actions/equity-actions', () => api);
vi.mock('@/features/equity/actions/dividend-actions', () => api);
vi.mock('@/features/equity/actions/price-actions', () => api);
vi.mock('sonner', () => ({
  toast: { success: api.success, error: api.error },
}));
const trade: EquityTradeData = {
  id: 't1',
  date: '2026-01-01',
  broker: 'DBS Vickers',
  ticker: 'DBS',
  action: 'buy',
  shares: 100,
  price: 10,
  fees: 0,
  isCdp: true,
  isPO: false,
};
const dividend: DividendData = {
  id: 'd1',
  date: '2026-02-01',
  ticker: 'DBS',
  amount: 20,
  currency: 'SGD',
};
function mount(child: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    ...render(
      <QueryClientProvider client={client}>{child}</QueryClientProvider>
    ),
    client,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 800, 260)
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [
            {
              target,
              contentRect: new DOMRect(0, 0, 800, 260),
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver
        );
      }
      unobserve() {}
      disconnect() {}
    }
  );
  api.fetchStockPrices.mockResolvedValue({
    DBS: { price: 12, currency: 'SGD' },
    AAPL: { price: 5, currency: 'USD' },
  });
  api.fetchExchangeRate.mockResolvedValue(1.3);
  api.fetchDividends.mockResolvedValue([{ exDate: '2026-02-01', dpu: 0.2 }]);
  api.getDividends.mockResolvedValue([dividend]);
  api.getTrades.mockResolvedValue([trade]);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: vi.fn(),
    configurable: true,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('loads real query history and reports server failures', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const first = renderHook(() => useTrades(), { wrapper });
  await waitFor(() => expect(first.result.current.data).toEqual([trade]));
  first.unmount();
  client.clear();
  api.getTrades.mockRejectedValueOnce(new Error('offline'));
  const second = renderHook(() => useTrades(), { wrapper });
  await waitFor(() => expect(second.result.current.isError).toBe(true));
});
describe('real equity dialogs', () => {
  it('reports a cleared trade date without sending a mutation', async () => {
    const view = mount(
      <TradeFormDialog open onOpenChange={vi.fn()} editTrade={trade} />
    );
    fireEvent.change(view.baseElement.querySelector('input[type=date]')!, {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update Trade' }));
    await waitFor(() =>
      expect(api.error).toHaveBeenCalledWith(
        'Please fill in all required fields'
      )
    );
    expect(api.updateTrade).not.toHaveBeenCalled();
  });

  it('calculates new-trade broker fees and respects manual overrides', async () => {
    mount(<TradeFormDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. AAPL, DBS'), {
      target: { value: 'DBS' },
    });
    fireEvent.change(screen.getByPlaceholderText('0'), {
      target: { value: '100' },
    });
    const numeric = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(numeric[0], { target: { value: '10' } });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'DBS Vickers' }));
    expect(
      screen.getByRole('checkbox', { name: 'CDP' }).getAttribute('data-state')
    ).toBe('checked');
    await waitFor(() =>
      expect(Number((numeric[1] as HTMLInputElement).value)).toBeGreaterThan(0)
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'CDP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Buy' }));
    fireEvent.change(numeric[1], { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Trade' }));
    await waitFor(() =>
      expect(api.createTrade).toHaveBeenCalledWith(
        expect.objectContaining({
          broker: 'DBS Vickers',
          fees: 7,
          isCdp: false,
        })
      )
    );
  });
  it('keeps save pending until the external action settles', async () => {
    let resolve!: () => void;
    api.updateTrade.mockReturnValue(
      new Promise<void>((r) => {
        resolve = r;
      })
    );
    mount(<TradeFormDialog open onOpenChange={vi.fn()} editTrade={trade} />);
    fireEvent.click(screen.getByRole('button', { name: 'Update Trade' }));
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Update Trade',
          }) as HTMLButtonElement
        ).disabled
      ).toBe(true)
    );
    resolve();
    await waitFor(() =>
      expect(api.success).toHaveBeenCalledWith('Trade updated')
    );
  });

  it('updates saved custom broker trades and surfaces action failures', async () => {
    const close = vi.fn();
    mount(
      <TradeFormDialog
        open
        onOpenChange={close}
        editTrade={{ ...trade, broker: 'Custom broker' }}
      />
    );
    expect(screen.getByRole('combobox').textContent).toContain('Custom broker');
    fireEvent.change(screen.getByPlaceholderText('e.g. AAPL, DBS'), {
      target: { value: ' aapl ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sell' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update Trade' }));
    await waitFor(() =>
      expect(api.updateTrade).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ ticker: 'AAPL', action: 'sell', fees: 0 })
      )
    );
    expect(close).toHaveBeenCalledWith(false);
    api.updateTrade.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Update Trade' }));
    await waitFor(() =>
      expect(api.error).toHaveBeenCalledWith('Failed to save trade')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(close).toHaveBeenCalledWith(false);
  });
  it('rejects empty input and creates brokerless public offering from numeric entries', async () => {
    mount(<TradeFormDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Trade' }));
    await waitFor(() =>
      expect(api.error).toHaveBeenCalledWith(
        'Please fill in all required fields'
      )
    );
    expect(api.createTrade).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('e.g. AAPL, DBS'), {
      target: { value: 'DBS' },
    });
    fireEvent.change(screen.getByPlaceholderText('0'), {
      target: { value: '10' },
    });
    const nums = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(nums[0], { target: { value: '2' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'P/O' }));
    await waitFor(() =>
      expect((nums[1] as HTMLInputElement).value).toBe('0.36')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Trade' }));
    await waitFor(() =>
      expect(api.createTrade).toHaveBeenCalledWith(
        expect.objectContaining({
          ticker: 'DBS',
          shares: 10,
          price: 2,
          isPO: true,
          fees: 0.36,
        })
      )
    );
  });
  it('suggests distributions from actual shares, creates and edits them', async () => {
    const close = vi.fn();
    const view = mount(
      <DividendFormDialog open onOpenChange={close} trades={[trade]} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    expect(api.error).toHaveBeenCalledWith('Enter ticker and date first');
    fireEvent.change(screen.getByLabelText('Ticker'), {
      target: { value: 'DBS' },
    });
    fireEvent.change(screen.getByLabelText('Payment date'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Amount received') as HTMLInputElement).value
      ).toBe('20')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add distribution' }));
    await waitFor(() =>
      expect(api.createDividend).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 20, currency: 'SGD' })
      )
    );
    view.rerender(
      <QueryClientProvider client={view.client}>
        <DividendFormDialog
          open
          onOpenChange={close}
          trades={[trade]}
          editDividend={dividend}
        />
      </QueryClientProvider>
    );
    api.updateDividend.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(api.error).toHaveBeenCalledWith('Failed to save distribution')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(api.success).toHaveBeenCalledWith('Distribution updated')
    );
  });
  it.each(['empty', 'no-shares', 'network'])(
    'explains unavailable suggestion: %s',
    async (reason) => {
      api.fetchDividends.mockImplementation(async () => {
        if (reason === 'network') throw new Error('offline');
        return reason === 'empty' ? [] : [{ exDate: '2026-02-01', dpu: 0.2 }];
      });
      mount(<DividendFormDialog open onOpenChange={vi.fn()} trades={[]} />);
      fireEvent.change(screen.getByLabelText('Ticker'), {
        target: { value: 'DBS' },
      });
      fireEvent.change(screen.getByLabelText('Payment date'), {
        target: { value: '2026-02-01' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Suggest' }));
      await waitFor(() =>
        expect(api.error).toHaveBeenCalledWith(
          reason === 'empty'
            ? 'No dividend data found for this ticker'
            : reason === 'network'
              ? 'Could not fetch dividend data'
              : 'No shares held on that date'
        )
      );
    }
  );
  it('scans holdings, adjusts estimates and imports only selected positive amounts', async () => {
    const close = vi.fn();
    mount(
      <DividendScanDialog
        open
        onOpenChange={close}
        trades={[trade]}
        existing={[]}
      />
    );
    const amount = await screen.findByLabelText('Amount for DBS 2026-02-01');
    expect((amount as HTMLInputElement).value).toBe('20');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(
      (
        screen.getByRole('button', {
          name: 'Add 0 selected',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(amount, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 selected' }));
    expect(api.error).toHaveBeenCalledWith('Select at least one distribution');
    fireEvent.change(amount, { target: { value: '25' } });
    api.createDividends.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 selected' }));
    await waitFor(() =>
      expect(api.error).toHaveBeenCalledWith('Failed to import distributions')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 selected' }));
    await waitFor(() =>
      expect(api.createDividends).toHaveBeenLastCalledWith([
        { ticker: 'DBS', date: '2026-02-01', amount: 25, currency: 'SGD' },
      ])
    );
    expect(close).toHaveBeenCalledWith(false);
  });
  it('excludes recorded distributions and reports scan failures', async () => {
    const view = mount(
      <DividendScanDialog
        open
        onOpenChange={vi.fn()}
        trades={[trade]}
        existing={[dividend]}
      />
    );
    await screen.findByText('No new distributions found');
    view.unmount();
    api.fetchDividends.mockRejectedValueOnce(new Error('offline'));
    mount(
      <DividendScanDialog
        open
        onOpenChange={vi.fn()}
        trades={[trade]}
        existing={[]}
      />
    );
    await waitFor(() =>
      expect(api.error).toHaveBeenCalledWith('Could not scan for distributions')
    );
  });
});
describe('real equity tables and calculations', () => {
  it.each(['trade', 'distribution'])(
    'reports failed %s deletion while keeping confirmation visible',
    async (kind) => {
      if (kind === 'trade') {
        api.deleteTrade.mockRejectedValueOnce(new Error('offline'));
        mount(<TradeTable trades={[trade]} />);
      } else {
        api.deleteDividend.mockRejectedValueOnce(new Error('offline'));
        mount(<DividendTable dividends={[dividend]} />);
      }
      fireEvent.click(
        screen.getByRole('button', {
          name: kind === 'trade' ? 'Delete trade' : 'Delete distribution',
        })
      );
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Delete',
        })
      );
      await waitFor(() =>
        expect(api.error).toHaveBeenCalledWith(
          kind === 'trade'
            ? 'Failed to delete trade'
            : 'Failed to delete distribution'
        )
      );
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(api.success).not.toHaveBeenCalled();
    }
  );

  it('does not report scan errors after the dialog unmounts', async () => {
    let reject!: (error: Error) => void;
    api.fetchDividends.mockReturnValue(
      new Promise((_resolve, fail) => {
        reject = fail;
      })
    );
    const view = mount(
      <DividendScanDialog
        open
        onOpenChange={vi.fn()}
        trades={[trade]}
        existing={[]}
      />
    );
    expect(screen.getByText('Scanning your holdings…')).toBeTruthy();
    view.unmount();
    reject(new Error('late failure'));
    await waitFor(() => expect(api.fetchDividends).toHaveBeenCalledWith('DBS'));
    expect(api.error).not.toHaveBeenCalled();
  });
  it('shows unavailable holdings quotes and negative portfolio returns', async () => {
    api.fetchStockPrices.mockResolvedValue({});
    const view = mount(<HoldingsTable trades={[trade]} />);
    await waitFor(() => expect(api.fetchStockPrices).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /SG Stocks/ }));
    expect(screen.getAllByText('-')).toHaveLength(2);
    view.unmount();
    api.fetchStockPrices.mockResolvedValue({
      DBS: { price: 5, currency: 'SGD' },
      AAPL: { price: 5, currency: 'USD' },
    });
    mount(
      <PortfolioSummary
        trades={[trade, { ...trade, id: 'us', ticker: 'AAPL' }]}
      />
    );
    expect(await screen.findByText('-$500.00')).toBeTruthy();
    expect(await screen.findByText('-US$500.00')).toBeTruthy();
    expect(screen.queryByText('-$1,000.00')).toBeNull();
  });

  it('composes real distributions and opens add, edit and scan workflows', async () => {
    mount(<DistributionsSection trades={[trade]} />);
    await screen.findByText(/Dividends received.*20.00 total/);
    await screen.findByText('2026');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(
      screen.getByRole('heading', { name: 'Add Distribution' })
    ).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit distribution' }));
    expect(
      (screen.getByLabelText('Amount received') as HTMLInputElement).value
    ).toBe('20');
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
    await screen.findByText('No new distributions found');
  });
  it('disables distribution scanning with no trade history', async () => {
    api.getDividends.mockResolvedValue([]);
    mount(<DistributionsSection trades={[]} />);
    expect(
      (
        screen.getByRole('button', {
          name: 'Scan',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    await screen.findByText('No distributions recorded yet');
  });
  it('paginates trade history, edits and confirms deletion', async () => {
    const edit = vi.fn();
    const rows = Array.from({ length: 11 }, (_, i) => ({
      ...trade,
      id: String(i),
      ticker: 'T' + i,
      action: i === 0 ? ('sell' as const) : ('buy' as const),
      fees: i === 0 ? 2 : 0,
    }));
    mount(<TradeTable trades={rows} onEdit={edit} />);
    expect(screen.queryByText('T10')).toBeNull();
    expect(screen.getByText('SELL')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit trade' })[0]);
    expect(edit).toHaveBeenCalledWith(rows[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('T10')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete trade' })[0]);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      })
    );
    await waitFor(() => expect(api.deleteTrade).toHaveBeenCalledWith('0'));
    expect(api.success).toHaveBeenCalledWith('Trade deleted');
  });
  it('renders distribution currencies, edits and deletes', async () => {
    const edit = vi.fn();
    mount(
      <DividendTable
        dividends={[
          dividend,
          { ...dividend, id: 'usd', ticker: 'AAPL', currency: 'USD' },
        ]}
        onEdit={edit}
      />
    );
    expect(screen.getByText('US$20.00')).toBeTruthy();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Edit distribution' })[0]
    );
    expect(edit).toHaveBeenCalledWith(dividend);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Delete distribution' })[0]
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      })
    );
    await waitFor(() => expect(api.deleteDividend).toHaveBeenCalledWith('d1'));
  });
  it('explains both empty histories', () => {
    mount(
      <>
        <TradeTable trades={[]} />
        <DividendTable dividends={[]} />
      </>
    );
    expect(screen.getByText('No trades recorded yet')).toBeTruthy();
    expect(screen.getByText('No distributions recorded yet')).toBeTruthy();
  });
  it('sorts trailing income and yield while omitting nondistributing holdings', () => {
    mount(
      <YieldOnCostTable
        trades={[
          trade,
          { ...trade, id: 'a', ticker: 'AAPL', price: 5 },
          { ...trade, id: 'b', ticker: 'OCBC' },
        ]}
        dividends={[
          dividend,
          { ...dividend, id: 'a', ticker: 'AAPL', amount: 10, currency: 'USD' },
        ]}
        usdSgdRate={2}
        asOf="2026-03-01"
      />
    );
    const tickers = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((r) => within(r).getAllByRole('cell')[0].textContent);
    expect(tickers()).toEqual(['DBS', 'AAPL']);
    fireEvent.click(screen.getByText('Ticker'));
    expect(tickers()).toEqual(['AAPL', 'DBS']);
    fireEvent.click(screen.getByText('Ticker'));
    expect(tickers()).toEqual(['DBS', 'AAPL']);
    fireEvent.click(screen.getByText('Income (12m)'));
    expect(screen.queryByText('OCBC')).toBeNull();
    fireEvent.click(screen.getByText('Yield on Cost'));
    expect(tickers()[0]).toBe('DBS');
  });
  it('explains empty yield', () => {
    mount(
      <YieldOnCostTable
        trades={[]}
        dividends={[dividend]}
        usdSgdRate={1}
        asOf="2026-03-01"
      />
    );
    expect(screen.getByText('No yield-on-cost yet')).toBeTruthy();
  });
  it('renders quote gains/losses and converts US display values', async () => {
    mount(
      <HoldingsTable trades={[trade, { ...trade, id: 'a', ticker: 'AAPL' }]} />
    );
    await screen.findAllByText('$1,200.00');
    fireEvent.click(screen.getByRole('button', { name: /SG Stocks/ }));
    expect(screen.getByText('▲ +20.00%')).toBeTruthy();
    expect(screen.getByText('▼ -50.00%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    await screen.findByText('$650.00');
    fireEvent.click(screen.getByRole('button', { name: 'SGD' }));
    expect(screen.getByText('US$500.00')).toBeTruthy();
  });
  it('renders portfolio value and exposes quote loading/errors', async () => {
    const view = mount(<PortfolioSummary trades={[trade]} />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    await screen.findAllByText('$1,200.00');
    expect(screen.getAllByText('+$200.00').length).toBeGreaterThan(0);
    view.unmount();
    api.fetchStockPrices.mockRejectedValue(new Error('offline'));
    mount(<PortfolioSummary trades={[{ ...trade, ticker: 'ERROR' }]} />);
    await screen.findByText(/Prices unavailable for some holdings/);
  });
});

it('keeps a partial market unavailable instead of reporting a loss or zero', async () => {
  api.fetchStockPrices.mockResolvedValue({
    DBS: { price: 12, currency: 'SGD' },
  });
  mount(<PortfolioSummary trades={[trade, { ...trade, ticker: 'OCBC' }]} />);
  await screen.findByText(/Prices unavailable for some holdings/);
  expect(screen.queryByText('$1,200.00')).toBeNull();
  expect(screen.queryByText('-$800.00')).toBeNull();
  expect(screen.getAllByText('—').length).toBeGreaterThan(1);
});

it('shows genuine zero quotes as zero and an actual loss', async () => {
  api.fetchStockPrices.mockResolvedValue({
    DBS: { price: 0, currency: 'SGD' },
  });
  mount(<PortfolioSummary trades={[trade]} />);
  await screen.findByText('-$1,000.00');
  expect(screen.queryByText(/Prices unavailable/)).toBeNull();
});

it('does not convert USD holdings at zero when FX is missing', async () => {
  api.fetchExchangeRate.mockResolvedValue(null);
  mount(<HoldingsTable trades={[{ ...trade, ticker: 'AAPL' }]} />);
  await screen.findByText('US$500.00');
  fireEvent.click(screen.getByRole('button', { name: 'USD' }));
  await screen.findByText('Prices or exchange rate unavailable');
  expect(screen.queryByText('$0.00')).toBeNull();
});

it('keeps actual distribution rows when the conversion estimate is unavailable', async () => {
  api.fetchExchangeRate.mockResolvedValue(null);
  api.getDividends.mockResolvedValue([
    { ...dividend, ticker: 'AAPL', currency: 'USD' },
  ]);
  mount(<DistributionsSection trades={[{ ...trade, ticker: 'AAPL' }]} />);
  await screen.findByText(/Exchange rate unavailable. Converted totals/);
  expect(await screen.findByText('US$20.00')).toBeTruthy();
  expect(screen.queryByText(/20.00 total/)).toBeNull();
});

it('uses the same currency for US yield income and cost', () => {
  mount(
    <YieldOnCostTable
      trades={[{ ...trade, ticker: 'AAPL' }]}
      dividends={[{ ...dividend, ticker: 'AAPL', currency: 'USD' }]}
      usdSgdRate={2}
      asOf="2026-03-01"
    />
  );
  expect(screen.getByText('$40.00')).toBeTruthy();
  expect(screen.getByText('2.00%')).toBeTruthy();
  expect(screen.queryByText('4.00%')).toBeNull();
});

it('withholds an overflowing holding percentage instead of displaying infinity', async () => {
  api.fetchStockPrices.mockResolvedValue({
    DBS: { price: 1, currency: 'SGD' },
  });
  mount(<HoldingsTable trades={[{ ...trade, price: 1e-310 }]} />);
  await screen.findByText('$100.00');
  fireEvent.click(screen.getByRole('button', { name: /SG Stocks/ }));
  expect(screen.queryByText(/Infinity/)).toBeNull();
});
