import type { DividendCurrency, DividendData, EquityTradeData } from '../types';
import { type DividendPoint, sharesHeldBeforeExDate } from './dividend-suggest';
import { getMarket } from './ticker-map';

export interface DividendCandidate {
  ticker: string;
  // Feed ex-date, not a confirmed payment date.
  date: string;
  dpu: number;
  shares: number;
  amount: number;
  currency: DividendCurrency;
}

export function dividendScanTickers(trades: EquityTradeData[]): string[] {
  return [...new Set(trades.map((trade) => trade.ticker.trim().toUpperCase()))];
}

/** Historical gross estimates; current ownership does not establish past entitlement. */
export function buildDividendCandidates(
  trades: EquityTradeData[],
  pointsByTicker: Record<string, DividendPoint[]>,
  existing: DividendData[]
): DividendCandidate[] {
  const key = (ticker: string, date: string) =>
    `${ticker.toUpperCase()}|${date.slice(0, 10)}`;
  const seen = new Set(existing.map((d) => key(d.ticker, d.date)));

  const out: DividendCandidate[] = [];
  for (const ticker of dividendScanTickers(trades)) {
    const points = pointsByTicker[ticker] ?? [];
    const currency: DividendCurrency =
      getMarket(ticker) === 'US' ? 'USD' : 'SGD';

    for (const point of points) {
      const shares = sharesHeldBeforeExDate(trades, ticker, point.exDate);
      if (shares === null || shares <= 0) continue;
      if (!Number.isFinite(point.dpu) || point.dpu <= 0) continue;
      const amount = Math.round(point.dpu * shares * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const candidateKey = key(ticker, point.exDate);
      if (seen.has(candidateKey)) continue;
      seen.add(candidateKey);
      out.push({
        ticker,
        date: point.exDate.slice(0, 10),
        dpu: point.dpu,
        shares,
        amount,
        currency,
      });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
