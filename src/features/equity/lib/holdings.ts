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
      costRemaining: number;
      totalBuyCost: number;
      totalBuyShares: number;
      market: 'SG' | 'US';
    }
  >();

  // Average cost depends on trade order, and callers pass rows in arbitrary
  // order; the index tiebreak keeps same-day trades in their input order.
  const ordered = trades
    .map((trade, index) => ({ trade, index }))
    .sort(
      (a, b) => a.trade.date.localeCompare(b.trade.date) || a.index - b.index
    )
    .map(({ trade }) => trade);

  for (const t of ordered) {
    const ticker = t.ticker.toUpperCase();
    const existing = map.get(ticker) ?? {
      shares: 0,
      costRemaining: 0,
      totalBuyCost: 0,
      totalBuyShares: 0,
      market: resolveMarket({ ticker, market: t.market }),
    };
    if (t.market) existing.market = t.market;

    if (t.action === 'buy') {
      const cost = t.shares * t.price + t.fees;
      existing.shares += t.shares;
      existing.costRemaining += cost;
      existing.totalBuyCost += cost;
      existing.totalBuyShares += t.shares;
    } else {
      // A sale removes its proportional share of cost; sell fees are realised
      // P&L and never change the cost of the shares still held.
      const sold = Math.min(t.shares, existing.shares);
      existing.costRemaining -=
        existing.shares > 0
          ? existing.costRemaining * (sold / existing.shares)
          : 0;
      existing.shares -= t.shares;
      if (existing.shares <= 0) {
        existing.shares = 0;
        existing.costRemaining = 0;
      }
    }

    map.set(ticker, existing);
  }

  return Array.from(map.entries())
    .filter(([, v]) => v.shares > 0)
    .map(([ticker, v]) => {
      const averageCost = v.costRemaining / v.shares;
      return {
        ticker,
        market: v.market,
        shares: v.shares,
        totalBuyCost: v.totalBuyCost,
        totalBuyShares: v.totalBuyShares,
        avgBuyPrice: averageCost,
        costBasis: averageCost,
      };
    });
}
