// @vitest-environment jsdom
import {
  useExchangeRate,
  useStockPrices,
} from '@/features/equity/hooks/use-prices';
import { useQuery } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }));
vi.mock('@/features/equity/actions/price-actions', () => ({
  fetchStockPrices: vi.fn(),
  fetchExchangeRate: vi.fn(),
}));
it('does not reorder caller ticker arrays', () => {
  const tickers = ['Z', 'A'];
  renderHook(() => useStockPrices(tickers));
  expect(tickers).toEqual(['Z', 'A']);
});

it('polls stock prices but not the display exchange rate', () => {
  vi.mocked(useQuery).mockClear();
  renderHook(() => useStockPrices(['A']));
  renderHook(() => useExchangeRate('USD', 'SGD'));
  const [stock, fx] = vi
    .mocked(useQuery)
    .mock.calls.map(([options]) => options);
  expect(stock.refetchInterval).toBe(5 * 60 * 1000);
  expect(fx.refetchInterval).toBeUndefined();
});
