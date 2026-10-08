'use server';

import { requireUserId } from '@/lib/auth-guard';
import { z } from 'zod';
import {
  MAX_PRICE_CONCURRENCY,
  MAX_PRICE_TICKERS,
  PRICE_FETCH_TIMEOUT_MS,
} from '../constants';
import { getYahooSymbol } from '../lib/ticker-map';

export interface StockPrice {
  ticker: string;
  symbol: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
}

const tickerSchema = z
  .string()
  .max(64)
  .transform((value) => value.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9.\-:]{1,16}$/))
  .refine((value) => value !== '.' && value !== '..');
const tickersSchema = z.array(tickerSchema).max(MAX_PRICE_TICKERS);
const currencySchema = z
  .string()
  .regex(/^[A-Za-z]{3}$/)
  .transform((value) => value.toUpperCase());
const quoteMetaSchema = z.object({
  regularMarketPrice: z.number().nonnegative().finite().nullish(),
  previousClose: z.number().nonnegative().finite().nullish(),
  chartPreviousClose: z.number().nonnegative().finite().nullish(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullish(),
});
const quoteResponseSchema = z.object({
  chart: z.object({
    result: z.array(z.object({ meta: quoteMetaSchema })).min(1),
  }),
});
const dividendResponseSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          events: z
            .object({ dividends: z.record(z.string(), z.unknown()).optional() })
            .optional(),
        })
      )
      .min(1),
  }),
});
const dividendPointSchema = z.object({
  amount: z.number().positive().finite(),
  // Keep ex-dates within four-digit ISO years before conversion.
  date: z.number().int().min(0).max(253_402_300_799).finite(),
});

async function readQuote(ticker: string): Promise<StockPrice | null> {
  const symbol = getYahooSymbol(ticker);
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(PRICE_FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) return null;

    const data: unknown = await res.json();
    const parsed = quoteResponseSchema.safeParse(data);
    if (!parsed.success) return null;
    const meta = parsed.data.chart.result[0].meta;
    const price = meta.regularMarketPrice ?? 0;
    const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
    if (!Number.isFinite(change) || !Number.isFinite(changePercent))
      return null;

    return {
      ticker,
      symbol,
      price,
      currency: meta.currency ?? 'USD',
      change,
      changePercent,
    };
  } catch {
    return null;
  }
}

export async function fetchStockPrices(
  tickers: string[]
): Promise<Record<string, StockPrice>> {
  await requireUserId();
  const parsed = tickersSchema.safeParse(tickers);
  if (!parsed.success) return {};
  const unique = [...new Set(parsed.data)];
  const quotes: Array<StockPrice | null> = Array(unique.length).fill(null);
  let cursor = 0;

  const worker = async () => {
    while (cursor < unique.length) {
      const index = cursor++;
      quotes[index] = await readQuote(unique[index]);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(MAX_PRICE_CONCURRENCY, unique.length) },
      worker
    )
  );

  const results: Record<string, StockPrice> = {};
  for (const quote of quotes) {
    if (quote) results[quote.ticker] = quote;
  }
  return results;
}

export async function fetchExchangeRate(
  from: string,
  to: string
): Promise<number | null> {
  await requireUserId();
  const parsed = z
    .object({ from: currencySchema, to: currencySchema })
    .safeParse({
      from,
      to,
    });
  if (!parsed.success) return null;

  try {
    const symbol = `${parsed.data.from}${parsed.data.to}=X`;
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(PRICE_FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const quote = quoteResponseSchema.safeParse(data);
    if (!quote.success) return null;
    const rate = quote.data.chart.result[0].meta.regularMarketPrice;
    return typeof rate === 'number' && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

/** Historical per-unit distributions, sorted by ex-date. Empty on failure. */
export async function fetchDividends(
  ticker: string
): Promise<Array<{ exDate: string; dpu: number }>> {
  await requireUserId();
  const parsedTicker = tickerSchema.safeParse(ticker);
  if (!parsedTicker.success) return [];

  try {
    const symbol = getYahooSymbol(parsedTicker.data);
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5y&events=div`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(PRICE_FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) return [];

    const data: unknown = await res.json();
    const parsed = dividendResponseSchema.safeParse(data);
    if (!parsed.success) return [];
    const dividends = parsed.data.chart.result[0].events?.dividends;
    if (!dividends) return [];

    const points: Array<{ exDate: string; dpu: number }> = [];
    for (const entry of Object.values(dividends)) {
      const point = dividendPointSchema.safeParse(entry);
      if (!point.success) continue;
      points.push({
        exDate: new Date(point.data.date * 1000).toISOString().slice(0, 10),
        dpu: point.data.amount,
      });
    }
    return points.sort((a, b) => a.exDate.localeCompare(b.exDate));
  } catch {
    return [];
  }
}
