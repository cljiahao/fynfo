'use server';

import { requireUserId } from '@/lib/auth-guard';
import { getYahooSymbol } from '../lib/ticker-map';

export interface StockPrice {
  ticker: string;
  symbol: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
}

export async function fetchStockPrices(
  tickers: string[]
): Promise<Record<string, StockPrice>> {
  await requireUserId();

  const unique = [...new Set(tickers.map((t) => t.toUpperCase()))];
  const symbols = unique.map((t) => getYahooSymbol(t));
  const symbolToTicker = Object.fromEntries(
    unique.map((t, i) => [symbols[i], t])
  );

  const results: Record<string, StockPrice> = {};

  const allResults = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 300 },
          }
        );

        if (!res.ok) return null;

        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return null;

        const price = meta.regularMarketPrice ?? 0;
        const prevClose =
          meta.previousClose ?? meta.chartPreviousClose ?? price;
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
        const ticker = symbolToTicker[symbol] ?? symbol;

        return {
          ticker,
          symbol,
          price,
          currency: meta.currency ?? 'USD',
          change,
          changePercent,
        } satisfies StockPrice;
      } catch {
        return null;
      }
    })
  );

  for (const result of allResults) {
    if (result) results[result.ticker] = result;
  }

  return results;
}

export async function fetchExchangeRate(
  from: string,
  to: string
): Promise<number | null> {
  await requireUserId();

  try {
    const symbol = `${from}${to}=X`;
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof rate === 'number' && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}
