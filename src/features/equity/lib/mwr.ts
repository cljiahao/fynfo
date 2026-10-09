import type { EquityTradeData } from '../types';
import { type Holding } from './holdings';
import { getMarket } from './ticker-map';

// Cash flow: negative = money out (buy), positive = money in (sell / current value)
export interface CashFlow {
  date: Date;
  amount: number;
}

// Compute annualised MWR (IRR) via Newton's method
// NPV = Σ CF_i / (1 + r)^(years_i) = 0, solve for r
export function computeIRR(cashFlows: CashFlow[]): number {
  if (cashFlows.length < 2) return 0;

  const t0 = cashFlows[0].date.getTime();
  const years = cashFlows.map(
    (cf) => (cf.date.getTime() - t0) / (365.25 * 24 * 60 * 60 * 1000)
  );

  // initial guess 10%
  let r = 0.1;
  for (let iter = 0; iter < 200; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      const disc = Math.pow(1 + r, years[i]);
      npv += cashFlows[i].amount / disc;
      dnpv -= (years[i] * cashFlows[i].amount) / (disc * (1 + r));
    }
    if (Math.abs(dnpv) < 1e-12) break;
    const step = npv / dnpv;
    r -= step;
    // Clamp to prevent divergence
    if (r <= -1) r = -0.99;
    if (Math.abs(step) < 1e-10) break;
  }

  return r * 100;
}

export function buildCashFlows(
  trades: EquityTradeData[],
  holdings: Holding[],
  prices: Record<string, { price: number }>,
  marketFilter?: 'SG' | 'US',
  now: Date = new Date()
): CashFlow[] {
  const flows: CashFlow[] = [];

  for (const t of trades) {
    const market = getMarket(t.ticker.toUpperCase());
    if (marketFilter && market !== marketFilter) continue;

    const gross = t.shares * t.price;
    flows.push({
      date: new Date(t.date),
      amount: t.action === 'buy' ? -(gross + t.fees) : gross - t.fees,
    });
  }

  // Add current portfolio value as final positive cash flow (today)
  for (const h of holdings) {
    if (marketFilter && h.market !== marketFilter) continue;
    const p = prices[h.ticker]?.price ?? 0;
    if (p > 0) {
      flows.push({ date: now, amount: h.shares * p });
    }
  }

  flows.sort((a, b) => a.date.getTime() - b.date.getTime());
  return flows;
}

/** Reject solver guesses when timing, signed flows or the solved NPV cannot establish a return. */
export function verifiedIRR(cashFlows: CashFlow[]): number | null {
  if (
    cashFlows.length < 2 ||
    !cashFlows.some((flow) => flow.amount < 0) ||
    !cashFlows.some((flow) => flow.amount > 0)
  )
    return null;
  let first = Infinity;
  let last = -Infinity;
  for (const flow of cashFlows) {
    const time = flow.date.getTime();
    if (!Number.isFinite(time)) return null;
    first = Math.min(first, time);
    last = Math.max(last, time);
  }
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first)
    return null;
  const result = computeIRR(cashFlows);
  const rate = result / 100;
  if (!Number.isFinite(result) || rate <= -1) return null;
  let residual = 0;
  let scale = 0;
  for (const flow of cashFlows) {
    const years =
      (flow.date.getTime() - first) / (365.25 * 24 * 60 * 60 * 1000);
    const discounted = flow.amount / Math.pow(1 + rate, years);
    if (!Number.isFinite(discounted)) return null;
    residual += discounted;
    scale += Math.abs(discounted);
  }
  return Number.isFinite(scale) &&
    scale > 0 &&
    Number.isFinite(residual) &&
    Math.abs(residual) <= scale * 0.00000001
    ? result
    : null;
}
