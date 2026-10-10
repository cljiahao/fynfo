// @vitest-environment jsdom
import { DividendScanDialog } from '@/features/equity/components/dividend-scan-dialog';
import type { EquityTradeData } from '@/features/equity/types';
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
  fetchDividends: vi.fn(),
  createDividends: vi.fn(),
}));
vi.mock('@/features/equity/actions/price-actions', () => ({
  fetchDividends: api.fetchDividends,
}));
vi.mock('@/features/equity/actions/dividend-actions', () => ({
  createDividends: api.createDividends,
}));
const trade: EquityTradeData = {
  id: 'synthetic-trade',
  date: '2026-01-01',
  broker: 'Synthetic broker',
  ticker: 'DBS',
  action: 'buy',
  shares: 100,
  price: 10,
  fees: 0,
};
function mount(trades = [trade]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <DividendScanDialog
        open
        onOpenChange={vi.fn()}
        trades={trades}
        existing={[]}
      />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: vi.fn(),
    configurable: true,
  });
});
afterEach(cleanup);
it('exposes retry after failed scan instead of a false empty-result claim', async () => {
  api.fetchDividends
    .mockRejectedValueOnce(new Error('private provider detail'))
    .mockResolvedValueOnce([{ exDate: '2026-02-01', dpu: 0.2 }]);
  mount();
  expect(
    await screen.findByRole('alert', { name: 'Couldn’t scan distributions' })
  ).toBeTruthy();
  expect(screen.queryByText('No new distributions found')).toBeNull();
  expect(screen.queryByText('private provider detail')).toBeNull();
  expect(screen.queryByRole('button', { name: /Add \d+ selected/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(
    await screen.findByLabelText('Amount for DBS 2026-02-01')
  ).toBeTruthy();
  expect(api.fetchDividends).toHaveBeenCalledTimes(2);
});
it('never publishes partial candidates when one ticker feed fails', async () => {
  api.fetchDividends.mockImplementation(async (ticker: string) => {
    if (ticker === 'DBS') return [{ exDate: '2026-02-01', dpu: 0.2 }];
    throw new Error('synthetic provider failure');
  });
  mount([trade, { ...trade, id: 'synthetic-us', ticker: 'AAPL' }]);
  await waitFor(() => expect(api.fetchDividends).toHaveBeenCalledTimes(2));
  expect(
    await screen.findByRole('alert', { name: 'Couldn’t scan distributions' })
  ).toBeTruthy();
  expect(screen.queryByLabelText('Amount for DBS 2026-02-01')).toBeNull();
  expect(api.createDividends).not.toHaveBeenCalled();
});
it('qualifies genuine empty scan results to returned market data, not payment completeness', async () => {
  api.fetchDividends.mockResolvedValue([]);
  mount();
  expect(await screen.findByText('No new distributions found')).toBeTruthy();
  expect(
    screen.getByText(
      'No eligible new estimates in the returned market data. Compare against your received payments; source coverage may be incomplete.'
    )
  ).toBeTruthy();
  expect(screen.queryByText(/everything is already recorded/)).toBeNull();
  expect(api.createDividends).not.toHaveBeenCalled();
});
