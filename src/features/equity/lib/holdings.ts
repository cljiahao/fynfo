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

const EPSILON = 1e-9;

export function computeHoldings(trades: EquityTradeData[]): Holding[] {
  const map = new Map<
    string,
    {
      shares: number;
      runningShares: number;
      costRemaining: number;
      totalBuyCost: number;
      totalBuyShares: number;
      market: 'SG' | 'US';
    }
  >();

  // Average cost depends on trade order, and callers pass rows in arbitrary
  // order. Same-time buys go first so a sell never runs ahead of the lot it
  // closes; input order is the final tiebreak.
  const time = (date: string) => Date.parse(date) || 0;
  const ordered = trades
    .map((trade, index) => ({ trade, index }))
    .sort(
      (a, b) =>
        time(a.trade.date) - time(b.trade.date) ||
        Number(a.trade.action === 'sell') - Number(b.trade.action === 'sell') ||
        a.index - b.index
    )
    .map(({ trade }) => trade);

  for (const t of ordered) {
    const ticker = t.ticker.toUpperCase();
    const existing = map.get(ticker) ?? {
      shares: 0,
      runningShares: 0,
      costRemaining: 0,
      totalBuyCost: 0,
      totalBuyShares: 0,
      market: resolveMarket({ ticker, market: t.market }),
    };
    if (t.market) existing.market = t.market;

    if (t.action === 'buy') {
      const cost = t.shares * t.price + t.fees;
      existing.shares += t.shares;
      existing.runningShares += t.shares;
      existing.costRemaining += cost;
      existing.totalBuyCost += cost;
      existing.totalBuyShares += t.shares;
    } else {
      // A sale removes its proportional share of cost; sell fees are realised
      // P&L and never change the cost of the shares still held.
      existing.shares -= t.shares;
      if (existing.runningShares > EPSILON) {
        const sold = Math.min(t.shares, existing.runningShares);
        existing.costRemaining -=
          existing.costRemaining * (sold / existing.runningShares);
      }
      existing.runningShares -= t.shares;
      // Float residue from fractional lots must not leave a phantom holding.
      if (existing.runningShares < EPSILON) {
        existing.runningShares = 0;
        existing.costRemaining = 0;
      }
    }

    map.set(ticker, existing);
  }

  return Array.from(map.entries())
    .filter(([, v]) => v.shares > EPSILON)
    .map(([ticker, v]) => {
      // The cost walk clamps at zero shares while `shares` is the plain sum,
      // so cost is spread over the walk's own count.
      const averageCost =
        v.runningShares > EPSILON ? v.costRemaining / v.runningShares : 0;
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
