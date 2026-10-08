import type { DividendCurrency, DividendData, EquityTradeData } from '../types';
import { type DividendPoint, sharesHeldAsOf } from './dividend-suggest';
import type { Holding } from './holdings';
import { getMarket } from './ticker-map';

export interface DividendCandidate {
  ticker: string;
  // ex-date (ISO)
  date: string;
  dpu: number;
  shares: number;
  // estimated = dpu * shares
  amount: number;
  currency: DividendCurrency;
}

/**
 * Reconstructs candidate distributions for held positions: for each holding and
 * each Yahoo ex-date, estimates the amount as DPU × shares-held-on-that-date.
 * Skips ex-dates where no shares were held, dedupes against already-recorded
 * dividends (and within the scan) by ticker+date, sorts newest first.
 */
export function buildDividendCandidates(
  trades: EquityTradeData[],
  holdings: Holding[],
  pointsByTicker: Record<string, DividendPoint[]>,
  existing: DividendData[]
): DividendCandidate[] {
  const key = (ticker: string, date: string) =>
    `${ticker.toUpperCase()}|${date.slice(0, 10)}`;
  const seen = new Set(existing.map((d) => key(d.ticker, d.date)));

  const out: DividendCandidate[] = [];
  for (const h of holdings) {
    const points =
      pointsByTicker[h.ticker] ?? pointsByTicker[h.ticker.toUpperCase()] ?? [];
    const currency: DividendCurrency =
      getMarket(h.ticker) === 'US' ? 'USD' : 'SGD';

    for (const p of points) {
      const shares = sharesHeldAsOf(trades, h.ticker, p.exDate);
      if (shares <= 0) continue;
      const k = key(h.ticker, p.exDate);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        ticker: h.ticker,
        date: p.exDate.slice(0, 10),
        dpu: p.dpu,
        shares,
        amount: Math.round(p.dpu * shares * 100) / 100,
        currency,
      });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
