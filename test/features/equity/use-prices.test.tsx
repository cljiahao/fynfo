// @vitest-environment jsdom
import { useStockPrices } from '@/features/equity/hooks/use-prices';
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
