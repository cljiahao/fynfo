// @vitest-environment jsdom
import { TradeTable } from '@/features/equity/components/trade-table';
import type { EquityTradeData } from '@/features/equity/types';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@/features/equity/hooks/use-equity', () => ({
  useDeleteTrade: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
afterEach(cleanup);

const trade: EquityTradeData = {
  id: 'synthetic-trade',
  date: '2026-01-01',
  broker: 'Synthetic broker',
  ticker: 'AAPL',
  action: 'buy',
  shares: 2,
  price: 100,
  fees: 3,
};

function cells(ticker: string) {
  const row = screen.getByText(ticker).closest('tr');
  if (!row) throw new Error('Expected a trade row');
  return within(row).getAllByRole('cell');
}

it('shows recorded US and mapped SG values in their existing currency convention without FX', () => {
  render(
    <TradeTable
      trades={[
        trade,
        { ...trade, id: 'sg', ticker: 'DBS', price: 20, fees: 1 },
      ]}
    />
  );
  const us = cells('AAPL');
  expect(us[5].textContent).toBe('US$100.00');
  expect(us[6].textContent).toBe('US$3.00');
  expect(us[7].textContent).toBe('US$200.00');
  const sg = cells('DBS');
  expect(sg[5].textContent).toBe('$20.00');
  expect(sg[6].textContent).toBe('$1.00');
  expect(sg[7].textContent).toBe('$40.00');
});

it('labels gross value and preserves buy/sell multiplication separately from fees', () => {
  render(
    <TradeTable
      trades={[
        { ...trade, ticker: 'DBS' },
        { ...trade, id: 'sell', ticker: 'OCBC', action: 'sell' },
      ]}
    />
  );
  expect(
    screen.getByRole('columnheader', { name: 'Gross value' })
  ).toBeTruthy();
  expect(cells('DBS')[7].textContent).toBe('$200.00');
  expect(cells('OCBC')[7].textContent).toBe('$200.00');
  expect(cells('OCBC')[6].textContent).toBe('$3.00');
});

it('retains the actual zero-fee dash convention', () => {
  render(<TradeTable trades={[{ ...trade, ticker: 'DBS', fees: 0 }]} />);
  expect(cells('DBS')[6].textContent).toBe('-');
  expect(cells('DBS')[7].textContent).toBe('$200.00');
});

it('shows unavailable when finite recorded operands overflow the derived gross value', () => {
  render(
    <TradeTable
      trades={[{ ...trade, ticker: 'DBS', shares: 1e308, price: 2 }]}
    />
  );
  expect(cells('DBS')[7].textContent).toBe('Unavailable');
  expect(screen.queryByText(/Infinity|∞/)).toBeNull();
});

it('visibly qualifies unknown and raw SG symbol inference rather than claiming historical currency', () => {
  render(
    <TradeTable
      trades={[
        { ...trade, ticker: 'D05.SI' },
        { ...trade, id: 'unknown', ticker: 'UNKNOWN' },
      ]}
    />
  );
  expect(
    screen.getByText(
      'Currency inferred from ticker mapping (SGD/USD); check your trade statement. No FX conversion.'
    )
  ).toBeTruthy();
  expect(cells('D05.SI')[5].textContent).toBe('US$100.00');
  expect(cells('UNKNOWN')[5].textContent).toBe('US$100.00');
});
