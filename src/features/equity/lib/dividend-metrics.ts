import type { DividendCurrency, DividendData } from '../types';
import type { Holding } from './holdings';

/** Convert a native-currency amount to SGD using a single USD→SGD rate. */
export function toSGD(
  amount: number,
  currency: DividendCurrency,
  usdSgdRate: number
): number {
  return currency === 'USD' ? amount * usdSgdRate : amount;
}

/** Total distributions received, in SGD. */
export function totalSGD(
  dividends: DividendData[],
  usdSgdRate: number
): number {
  return dividends.reduce(
    (sum, d) => sum + toSGD(d.amount, d.currency, usdSgdRate),
    0
  );
}

/** SGD distributions grouped by calendar year, ascending by year. */
export function incomeByYear(
  dividends: DividendData[],
  usdSgdRate: number
): Array<{ year: string; total: number }> {
  const map = new Map<string, number>();
  for (const d of dividends) {
    const year = d.date.slice(0, 4);
    map.set(
      year,
      (map.get(year) ?? 0) + toSGD(d.amount, d.currency, usdSgdRate)
    );
  }
  return Array.from(map.entries())
    .map(([year, total]) => ({ year, total }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

/**
 * Trailing-12-month SGD distributions for one ticker, relative to `asOf`
 * (inclusive window of (asOf − 1 year, asOf]).
 */
export function ttmDistributionsSGD(
  dividends: DividendData[],
  ticker: string,
  usdSgdRate: number,
  asOf: string
): number {
  const tk = ticker.toUpperCase();
  const end = new Date(asOf).getTime();
  const start = new Date(asOf);
  start.setFullYear(start.getFullYear() - 1);
  const startMs = start.getTime();

  let total = 0;
  for (const d of dividends) {
    if (d.ticker.toUpperCase() !== tk) continue;
    const t = new Date(d.date).getTime();
    if (t > startMs && t <= end) {
      total += toSGD(d.amount, d.currency, usdSgdRate);
    }
  }
  return total;
}

/**
 * Yield-on-cost = trailing-12-month SGD distributions ÷ cost of shares still
 * held (`costBasis` per-share × current `shares`). Returns a fraction (0.05 = 5%).
 */
export function yieldOnCost(ttmSGD: number, holding: Holding): number {
  const cost = holding.costBasis * holding.shares;
  return cost > 0 ? ttmSGD / cost : 0;
}
