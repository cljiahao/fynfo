'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchExchangeRate,
  fetchStockPrices,
  type StockPrice,
} from '../actions/price-actions';

export function useStockPrices(tickers: string[]) {
  return useQuery<Record<string, StockPrice>>({
    queryKey: ['stock-prices', tickers.sort().join(',')],
    queryFn: () => fetchStockPrices(tickers),
    enabled: tickers.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useExchangeRate(from: string, to: string) {
  return useQuery<number | null>({
    queryKey: ['exchange-rate', from, to],
    queryFn: () => fetchExchangeRate(from, to),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
