'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchExchangeRate,
  fetchStockPrices,
  type StockPrice,
} from '../actions/price-actions';

export function useStockPrices(
  tickers: string[],
  markets?: Record<string, 'SG' | 'US'>
) {
  return useQuery<Record<string, StockPrice>>({
    queryKey: [
      'stock-prices',
      [...tickers]
        .sort()
        .map((t) => `${markets?.[t] ?? ''}:${t}`)
        .join(','),
    ],
    queryFn: () => fetchStockPrices(tickers, markets),
    enabled: tickers.length > 0,
    staleTime: 5 * 60 * 1000,
    // TanStack's refetchIntervalInBackground defaults to false, so polling
    // pauses while the tab is backgrounded.
    refetchInterval: 5 * 60 * 1000,
  });
}

// A display rate moves little within a session, so staleTime alone is enough.
export function useExchangeRate(from: string, to: string) {
  return useQuery<number | null>({
    queryKey: ['exchange-rate', from, to],
    queryFn: () => fetchExchangeRate(from, to),
    staleTime: 5 * 60 * 1000,
  });
}
