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
 * SGD distributions for the `count` calendar years ending at `endYear`,
 * ascending, with 0 for years without payments so the chart keeps a stable
 * x-axis.
 */
export function incomeForRecentYears(
  dividends: DividendData[],
  usdSgdRate: number,
  endYear: number,
  count = 5
): Array<{ year: string; total: number }> {
  const byYear = new Map(
    incomeByYear(dividends, usdSgdRate).map((row) => [row.year, row.total])
  );
  return Array.from({ length: count }, (_, i) => {
    const year = String(endYear - count + 1 + i);
    return { year, total: byYear.get(year) ?? 0 };
  });
}

/** Window start for (asOf - 1 year, asOf]; 29 Feb falls back to 28 Feb. */
function oneYearBefore(asOf: string): string {
  const year = String(Number(asOf.slice(0, 4)) - 1).padStart(4, '0');
  const monthDay = asOf.slice(5);
  return `${year}-${monthDay === '02-29' ? '02-28' : monthDay}`;
}

/** Trailing-12-month SGD distributions across all tickers, window (asOf - 1 year, asOf]. */
export function trailing12MonthSGD(
  dividends: DividendData[],
  usdSgdRate: number,
  asOf: string
): number {
  const start = oneYearBefore(asOf);
  return totalSGD(
    dividends.filter((d) => d.date > start && d.date <= asOf),
    usdSgdRate
  );
}

export interface DividendSummaryMetrics {
  totalToDate: number;
  trailing12m: number;
  averagePerYear: number | null;
  fullYears: number;
}

/**
 * Overview figures. The average counts completed calendar years only, from
 * the year of the first dividend (treated as a full year) to the year before
 * `asOf`; years without payments count as zero.
 */
export function dividendSummary(
  dividends: DividendData[],
  usdSgdRate: number,
  asOf: string
): DividendSummaryMetrics {
  const past = dividends.filter((d) => d.date <= asOf);
  const totalToDate = totalSGD(past, usdSgdRate);
  const trailing12m = trailing12MonthSGD(dividends, usdSgdRate, asOf);
  const currentYear = Number(asOf.slice(0, 4));
  const firstYear = Math.min(...past.map((d) => Number(d.date.slice(0, 4))));
  const fullYears =
    past.length === 0 ? 0 : Math.max(currentYear - firstYear, 0);
  if (fullYears === 0) {
    return { totalToDate, trailing12m, averagePerYear: null, fullYears };
  }
  const completed = past.filter(
    (d) => Number(d.date.slice(0, 4)) < currentYear
  );
  return {
    totalToDate,
    trailing12m,
    averagePerYear: totalSGD(completed, usdSgdRate) / fullYears,
    fullYears,
  };
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
