// @vitest-environment jsdom
import { DistributionsSection } from '@/features/equity/components/distributions-section';
import type { DividendData, EquityTradeData } from '@/features/equity/types';
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
  createDividend: vi.fn(),
  createDividends: vi.fn(),
  updateDividend: vi.fn(),
  deleteDividend: vi.fn(),
  fetchExchangeRate: vi.fn(),
  fetchDividends: vi.fn(),
  fetchStockPrices: vi.fn(),
}));
vi.mock('@/features/equity/actions/dividend-actions', () => api);
vi.mock('@/features/equity/actions/price-actions', () => api);
const trade: EquityTradeData = {
  id: 'synthetic-trade',
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
  id: 'synthetic-dividend',
  date: '2026-02-01',
  ticker: 'DBS',
  amount: 20,
  currency: 'SGD',
};
function mount(initial?: DividendData[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (initial) client.setQueryData(['equity-dividends'], initial);
  render(
    <QueryClientProvider client={client}>
      <DistributionsSection trades={[trade]} />
    </QueryClientProvider>
  );
  return client;
}
beforeEach(() => {
  vi.resetAllMocks();
  api.fetchExchangeRate.mockResolvedValue(1.3);
  api.fetchDividends.mockResolvedValue([]);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: vi.fn(),
    configurable: true,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('does not invent empty history or zero yield while distributions are pending', async () => {
  let resolve!: (rows: DividendData[]) => void;
  api.getDividends.mockReturnValue(
    new Promise<DividendData[]>((done) => {
      resolve = done;
    })
  );
  mount();
  expect(screen.queryByText('No distributions recorded yet')).toBeNull();
  expect(screen.queryByText('Yield on cost')).toBeNull();
  expect(
    screen.getByRole('status', { name: 'Loading distributions' })
  ).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'Scan' }) as HTMLButtonElement).disabled
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(
    screen.getByRole('heading', { name: 'Add Distribution' })
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  resolve([dividend]);
  expect(
    await screen.findByText(/Dividends received.*20.00 total/)
  ).toBeTruthy();
  expect(screen.getByText('Yield on cost')).toBeTruthy();
});

it('offers retry on failed history without exposing private detail or zero values', async () => {
  api.getDividends
    .mockRejectedValueOnce(new Error('private database detail'))
    .mockResolvedValueOnce([dividend]);
  mount();
  expect(
    await screen.findByRole('alert', { name: 'Couldn’t load distributions' })
  ).toBeTruthy();
  expect(screen.queryByText('No distributions recorded yet')).toBeNull();
  expect(screen.queryByText('Yield on cost')).toBeNull();
  expect(screen.queryByText('private database detail')).toBeNull();
  expect(
    (screen.getByRole('button', { name: 'Scan' }) as HTMLButtonElement).disabled
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(
    await screen.findByText(/Dividends received.*20.00 total/)
  ).toBeTruthy();
});

it('keeps genuine successful empty history and zero yield available', async () => {
  api.getDividends.mockResolvedValue([]);
  mount();
  expect(await screen.findByText('No distributions recorded yet')).toBeTruthy();
  expect(screen.getByText('Yield on cost')).toBeTruthy();
  expect(screen.getByText('No yield-on-cost yet')).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'Scan' }) as HTMLButtonElement).disabled
  ).toBe(false);
});

it('withholds cached figures on background failure and closes an unverified scan', async () => {
  api.getDividends
    .mockResolvedValueOnce([dividend])
    .mockRejectedValueOnce(new Error('synthetic read failure'))
    .mockResolvedValueOnce([dividend]);
  const client = mount([dividend]);
  await waitFor(() => expect(api.getDividends).toHaveBeenCalledOnce());
  expect(
    await screen.findByText(/Dividends received.*20.00 total/)
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
  expect(await screen.findByRole('dialog')).toBeTruthy();
  await client.refetchQueries({ queryKey: ['equity-dividends'] });
  expect(
    await screen.findByRole('alert', { name: 'Couldn’t load distributions' })
  ).toBeTruthy();
  expect(screen.queryByText(/Dividends received.*20.00 total/)).toBeNull();
  expect(screen.queryByText('Yield on cost')).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText(/Dividends received.*20.00 total/);
  expect(screen.queryByRole('dialog')).toBeNull();
});
