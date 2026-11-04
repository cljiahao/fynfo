import type { EquityTradeData } from '../types';
import { resolveMarket } from './ticker-map';

export interface Holding {
  ticker: string;
  market: 'SG' | 'US';
  shares: number;
  totalBuyCost: number;
  totalBuyShares: number;
  avgBuyPrice: number;
  costBasis: number;
}

/** Ticker -> market lookup so price fetches can derive non-legacy SG symbols. */
export function holdingMarkets(
  holdings: Holding[]
): Record<string, 'SG' | 'US'> {
  return Object.fromEntries(holdings.map((h) => [h.ticker, h.market]));
}

export function computeHoldings(trades: EquityTradeData[]): Holding[] {
  const map = new Map<
    string,
    {
      shares: number;
      totalBuyCost: number;
      totalBuyShares: number;
      market: 'SG' | 'US';
    }
  >();

  for (const t of trades) {
    const ticker = t.ticker.toUpperCase();
    const existing = map.get(ticker) ?? {
      shares: 0,
      totalBuyCost: 0,
      totalBuyShares: 0,
      market: resolveMarket({ ticker, market: t.market }),
    };
    if (t.market) existing.market = t.market;

    if (t.action === 'buy') {
      existing.shares += t.shares;
      existing.totalBuyCost += t.shares * t.price + t.fees;
      existing.totalBuyShares += t.shares;
    } else {
      existing.shares -= t.shares;
    }

    map.set(ticker, existing);
  }

  return Array.from(map.entries())
    .filter(([, v]) => v.shares > 0)
    .map(([ticker, v]) => ({
      ticker,
      market: v.market,
      shares: v.shares,
      totalBuyCost: v.totalBuyCost,
      totalBuyShares: v.totalBuyShares,
      avgBuyPrice: v.totalBuyShares > 0 ? v.totalBuyCost / v.totalBuyShares : 0,
      costBasis: v.shares > 0 ? v.totalBuyCost / v.shares : 0,
    }));
}
