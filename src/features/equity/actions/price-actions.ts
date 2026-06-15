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

/**
 * Historical distributions (per-unit amount + ex-date) for a ticker, from the
 * Yahoo chart `events=div` feed. Public market data — same trust level and
 * defensive shape as the quote fetch. Returns [] on any failure.
 */
export async function fetchDividends(
  ticker: string
): Promise<Array<{ exDate: string; dpu: number }>> {
  await requireUserId();

  try {
    const symbol = getYahooSymbol(ticker);
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5y&events=div`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 86400 },
      }
    );
    if (!res.ok) return [];

    const data = await res.json();
    const dividends = data?.chart?.result?.[0]?.events?.dividends;
    if (!dividends || typeof dividends !== 'object') return [];

    return Object.values(dividends as Record<string, unknown>)
      .map((d) => {
        const entry = d as { amount?: number; date?: number };
        if (
          typeof entry.amount !== 'number' ||
          typeof entry.date !== 'number'
        ) {
          return null;
        }
        return {
          exDate: new Date(entry.date * 1000).toISOString().slice(0, 10),
          dpu: entry.amount,
        };
      })
      .filter((p): p is { exDate: string; dpu: number } => p !== null)
      .sort((a, b) => a.exDate.localeCompare(b.exDate));
  } catch {
    return [];
  }
}
