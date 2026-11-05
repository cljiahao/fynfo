import type { DividendData } from '../types';
import { toSGD, totalSGD, trailing12MonthSGD } from './dividend-metrics';
import type { Holding } from './holdings';

export interface TrailingTwelveMonthChange {
  current: number;
  prior: number;
  /** Fraction (0.1 = +10%); null when the prior window paid nothing. */
  changePct: number | null;
}

export interface MonthlyIncome {
  /** YYYY-MM */
  month: string;
  total: number;
}

export interface TickerShare {
  ticker: string;
  ttm: number;
  /** Fraction of the trailing-12-month total. */
  share: number;
  /** Fraction (0.05 = 5%); null when the ticker is no longer held. */
  yieldOnCost: number | null;
}

export interface OtherShare {
  ttm: number;
  share: number;
  tickerCount: number;
}

export interface TickerBreakdown {
  total: number;
  tickers: TickerShare[];
  other: OtherShare | null;
}

export interface CurrencySplit {
  sgd: number;
  /** USD payments converted at the supplied rate. */
  usdInSgd: number;
  /** USD payments in their native currency, for the caption. */
  usdNative: number;
}

/** Same day one year earlier; 29 Feb falls back to 28 Feb like `trailing12MonthSGD`. */
function oneYearBefore(asOf: string): string {
  const year = String(Number(asOf.slice(0, 4)) - 1).padStart(4, '0');
  const monthDay = asOf.slice(5);
  return `${year}-${monthDay === '02-29' ? '02-28' : monthDay}`;
}

function ttmByTicker(
  dividends: DividendData[],
  usdSgdRate: number,
  asOf: string
): Map<string, number> {
  const start = oneYearBefore(asOf);
  const map = new Map<string, number>();
  for (const d of dividends) {
    if (d.date <= start || d.date > asOf) continue;
    const ticker = d.ticker.toUpperCase();
    map.set(
      ticker,
      (map.get(ticker) ?? 0) + toSGD(d.amount, d.currency, usdSgdRate)
    );
  }
  return map;
}

/** Last 12 months against the 12 before, windows (asOf-1y, asOf] and (asOf-2y, asOf-1y]. */
export function trailingTwelveMonthChange(
  dividends: DividendData[],
  usdSgdRate: number,
  asOf: string
): TrailingTwelveMonthChange {
  const current = trailing12MonthSGD(dividends, usdSgdRate, asOf);
  const prior = trailing12MonthSGD(dividends, usdSgdRate, oneYearBefore(asOf));
  return {
    current,
    prior,
    changePct: prior > 0 ? (current - prior) / prior : null,
  };
}

/** Trailing-12-month total spread evenly, comparable with monthly expenses. */
export function averageMonthlyTTM(ttm: number): number {
  return ttm / 12;
}

/**
 * SGD income per calendar month for the `count` months ending at `asOf`'s
 * month, zero-filled so the chart keeps a stable x-axis. Payments after
 * `asOf` are ignored, matching the trailing-12-month figure.
 */
export function incomeForRecentMonths(
  dividends: DividendData[],
  usdSgdRate: number,
  asOf: string,
  count = 12
): MonthlyIncome[] {
  const byMonth = new Map<string, number>();
  for (const d of dividends) {
    if (d.date > asOf) continue;
    const month = d.date.slice(0, 7);
    byMonth.set(
      month,
      (byMonth.get(month) ?? 0) + toSGD(d.amount, d.currency, usdSgdRate)
    );
  }
  const endIndex = Number(asOf.slice(0, 4)) * 12 + Number(asOf.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) => {
    const index = endIndex - count + 1 + i;
    const year = String(Math.floor(index / 12)).padStart(4, '0');
    const month = `${year}-${String((index % 12) + 1).padStart(2, '0')}`;
    return { month, total: byMonth.get(month) ?? 0 };
  });
}

/**
 * Trailing-12-month income by ticker, largest first, capped at `limit` with
 * the rest folded into `other`. Yield on cost uses the cost of shares still
 * held; US cost basis is converted at `usdSgdRate` so it matches the SGD
 * distributions. Sold tickers carry no yield.
 */
export function topTickerShares(
  dividends: DividendData[],
  holdings: Holding[],
  usdSgdRate: number,
  asOf: string,
  limit = 5
): TickerBreakdown {
  const perTicker = ttmByTicker(dividends, usdSgdRate, asOf);
  const total = Array.from(perTicker.values()).reduce((a, b) => a + b, 0);
  if (!(total > 0)) return { total: 0, tickers: [], other: null };

  const held = new Map(holdings.map((h) => [h.ticker.toUpperCase(), h]));
  const ranked = Array.from(perTicker.entries())
    .filter(([, ttm]) => ttm > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const tickers = ranked.slice(0, limit).map(([ticker, ttm]) => {
    const holding = held.get(ticker);
    let yieldOnCost: number | null = null;
    if (holding !== undefined && holding.shares > 0) {
      const perShare =
        holding.market === 'US'
          ? holding.costBasis * usdSgdRate
          : holding.costBasis;
      const cost = perShare * holding.shares;
      yieldOnCost = Number.isFinite(cost) && cost > 0 ? ttm / cost : null;
    }
    return { ticker, ttm, share: ttm / total, yieldOnCost };
  });

  const rest = ranked.slice(limit);
  const otherTtm = rest.reduce((sum, [, ttm]) => sum + ttm, 0);
  const other =
    rest.length > 0
      ? { ttm: otherTtm, share: otherTtm / total, tickerCount: rest.length }
      : null;

  return { total, tickers, other };
}

/** Last 12 months of income from tickers still held; assumes the same payments repeat. */
export function forwardEstimate(
  dividends: DividendData[],
  holdings: Holding[],
  usdSgdRate: number,
  asOf: string
): number {
  const heldTickers = new Set(
    holdings.filter((h) => h.shares > 0).map((h) => h.ticker.toUpperCase())
  );
  let sum = 0;
  for (const [ticker, ttm] of ttmByTicker(dividends, usdSgdRate, asOf)) {
    if (heldTickers.has(ticker)) sum += ttm;
  }
  return sum;
}

/** Fraction of monthly expenses covered; null unless expenses is a positive finite number. */
export function expenseCoverage(
  avgMonthly: number,
  monthlyExpenses: number | null | undefined
): number | null {
  if (
    monthlyExpenses === null ||
    monthlyExpenses === undefined ||
    !Number.isFinite(monthlyExpenses) ||
    monthlyExpenses <= 0
  ) {
    return null;
  }
  return avgMonthly / monthlyExpenses;
}

/** SGD versus USD split of dividends received up to `asOf`, for the one-line caption. */
export function currencySplit(
  dividends: DividendData[],
  usdSgdRate: number,
  asOf: string
): CurrencySplit {
  const past = dividends.filter((d) => d.date <= asOf);
  const usd = past.filter((d) => d.currency === 'USD');
  return {
    sgd: totalSGD(
      past.filter((d) => d.currency === 'SGD'),
      usdSgdRate
    ),
    usdInSgd: totalSGD(usd, usdSgdRate),
    usdNative: usd.reduce((sum, d) => sum + d.amount, 0),
  };
}
