import type { EquityTradeData } from '../types';

/** A historical distribution-per-unit point from the market-data feed. */
export interface DividendPoint {
  // ISO date
  exDate: string;
  // distribution per unit/share
  dpu: number;
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

function recordedDay(value: string): string | null {
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(value)))
    return null;
  const parsed = new Date(`${day}T00:00:00.000Z`);
  return parsed.toISOString().slice(0, 10) === day ? day : null;
}

/** Trades on the supplied ex-date do not change the estimated entitlement. */
export function sharesHeldBeforeExDate(
  trades: EquityTradeData[],
  ticker: string,
  exDate: string
): number | null {
  const target = recordedDay(exDate);
  if (target === null) return null;
  const normalized = ticker.trim().toUpperCase();
  let shares = 0;
  for (const trade of trades) {
    if (trade.ticker.trim().toUpperCase() !== normalized) continue;
    const day = recordedDay(trade.date);
    if (day === null || !Number.isFinite(trade.shares) || trade.shares <= 0)
      return null;
    if (day >= target) continue;
    shares += trade.action === 'buy' ? trade.shares : -trade.shares;
    if (!Number.isFinite(shares)) return null;
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
