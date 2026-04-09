'use server';

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
  const unique = [...new Set(tickers.map((t) => t.toUpperCase()))];
  const symbols = unique.map((t) => getYahooSymbol(t));
  const symbolToTicker = Object.fromEntries(
    unique.map((t, i) => [symbols[i], t])
  );

  const results: Record<string, StockPrice> = {};

  // Fetch in batches of 10 to avoid overloading
  for (let i = 0; i < symbols.length; i += 10) {
    const batch = symbols.slice(i, i + 10);
    const promises = batch.map(async (symbol) => {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0',
            },
            next: { revalidate: 300 }, // cache for 5 minutes
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
    });

    const batchResults = await Promise.all(promises);
    for (const result of batchResults) {
      if (result) {
        results[result.ticker] = result;
      }
    }
  }

  return results;
}

export async function fetchExchangeRate(
  from: string,
  to: string
): Promise<number> {
  try {
    const symbol = `${from}${to}=X`;
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 0;
  } catch {
    return 0;
  }
}
