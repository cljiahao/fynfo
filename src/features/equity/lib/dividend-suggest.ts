import type { EquityTradeData } from '../types';

/** A historical distribution-per-unit point from the market-data feed. */
export interface DividendPoint {
  exDate: string; // ISO date
  dpu: number; // distribution per unit/share
}

/**
 * Net shares held for `ticker` as of `date` (inclusive): Σ buy − Σ sell across
 * all trades dated on or before `date`. Clamped at 0 (never negative).
 */
export function sharesHeldAsOf(
  trades: EquityTradeData[],
  ticker: string,
  date: string
): number {
  const target = new Date(date).getTime();
  const tk = ticker.toUpperCase();
  let shares = 0;
  for (const t of trades) {
    if (t.ticker.toUpperCase() !== tk) continue;
    if (new Date(t.date).getTime() > target) continue;
    shares += t.action === 'buy' ? t.shares : -t.shares;
  }
  return Math.max(shares, 0);
}

/** Suggested received amount = DPU × shares held. */
export function suggestAmount(dpu: number, sharesHeld: number): number {
  return dpu * sharesHeld;
}

/** The DPU of the ex-date nearest `date`, or null when there are no points. */
export function nearestDpu(
  points: DividendPoint[],
  date: string
): number | null {
  if (points.length === 0) return null;
  const target = new Date(date).getTime();
  let bestDpu = points[0].dpu;
  let bestDiff = Infinity;
  for (const p of points) {
    const diff = Math.abs(new Date(p.exDate).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestDpu = p.dpu;
    }
  }
  return bestDpu;
}
