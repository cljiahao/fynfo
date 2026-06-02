import type { StockPrice } from '@/features/equity/actions/price-actions';
import type { Holding } from '@/features/equity/lib/holdings';
import type { EquityTradeData } from '@/features/equity/types';
import type { AssetCategory, SnapshotData } from '../types';

export interface MarketBudget {
  target: number;
  quarterly: number;
  quarterSpent: number;
  quarterRemaining: number;
  deployableCash: number;
}

export interface MarketBudgets {
  sg: MarketBudget;
  us: MarketBudget;
}

export interface Ratios {
  rsp: number;
  us: number;
  sg: number;
}

export interface CashAlloc {
  sg: number;
  us: number;
}

/** Floor to the nearest 100 (whole-lot budgeting). */
export function floorH(v: number): number {
  return Math.floor(v / 100) * 100;
}

/** Sum the amounts of a single asset category in a snapshot. */
export function sumCat(
  entries: SnapshotData['entries'],
  cat: AssetCategory
): number {
  return entries
    .filter((e) => e.category === cat)
    .reduce((s, e) => s + e.amount, 0);
}

/** Current calendar quarter bounds + days remaining. `now` injectable for tests. */
export function getCurrentQuarter(now: Date = new Date()) {
  const q = Math.ceil((now.getMonth() + 1) / 3);
  const year = now.getFullYear();
  const sm = (q - 1) * 3;
  const end = new Date(year, sm + 3, 0, 23, 59, 59);
  const daysLeft = Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / 86_400_000)
  );
  return {
    label: `Q${q} ${year}`,
    start: new Date(year, sm, 1),
    end,
    daysLeft,
  };
}

// Available % color: high = red (not investing), low = green (well deployed).
export function deployPctColor(pct: number): string {
  if (pct <= 20) return 'text-emerald-600';
  if (pct <= 50) return 'text-amber-500';
  return 'text-red-500';
}

/** Market-value of held equity per market, at the given prices. */
export function computeMarketEquity(
  holdings: Holding[],
  prices: Record<string, StockPrice> | undefined
): { sgEquity: number; usEquity: number; totalEquity: number } {
  const valueIn = (market: 'SG' | 'US') =>
    holdings
      .filter((h) => h.market === market)
      .reduce((s, h) => s + h.shares * (prices?.[h.ticker]?.price ?? 0), 0);
  const sgEquity = valueIn('SG');
  const usEquity = valueIn('US');
  return { sgEquity, usEquity, totalEquity: sgEquity + usEquity };
}

/** Buy-side cost spent per market within [qStart, qEnd]. `getMarket` injected. */
export function computeQuarterSpend(
  trades: EquityTradeData[],
  qStart: Date,
  qEnd: Date,
  getMarket: (ticker: string) => 'SG' | 'US' | null
): { sgSpent: number; usSpent: number } {
  let sg = 0;
  let us = 0;
  for (const t of trades) {
    if (t.action !== 'buy') continue;
    const d = new Date(t.date);
    if (d < qStart || d > qEnd) continue;
    const cost = t.shares * t.price + t.fees;
    if (getMarket(t.ticker.toUpperCase()) === 'SG') sg += cost;
    else us += cost;
  }
  return { sgSpent: sg, usSpent: us };
}

export interface BreakdownInput {
  investmentAmount: number;
  ratios: Ratios;
  cashAlloc: CashAlloc;
  savings: number;
  bonds: number;
  emergencyFundGoal: number;
  warChestGoal: number;
  sgEquity: number;
  usEquity: number;
  sgSpent: number;
  usSpent: number;
}

export interface BreakdownResult {
  totalRatio: number;
  rspMonthly: number;
  sgMonthly: number;
  usMonthly: number;
  sgQuarterly: number;
  usQuarterly: number;
  bondsSurplus: number;
  bondsShortfall: number;
  totalDeployable: number;
  sgCash: number;
  usCash: number;
  totalSupposed: number;
  sgTarget: number;
  usTarget: number;
  sgAvailable: number;
  usAvailable: number;
  sgDeployPct: number;
  usDeployPct: number;
  budgets: MarketBudgets;
}

/**
 * All derived investment-breakdown figures. Pure — every input is passed in
 * (no time, DOM, or query access), so the financial math is unit-testable.
 *
 * Deployable cash: savings already includes the quarterly budget (snapshot is
 * taken after salary deposit). Savings − emergency fund − bonds shortfall is
 * deployable from savings; bonds above the war-chest goal is deployable surplus.
 */
export function computeInvestmentBreakdown(
  input: BreakdownInput
): BreakdownResult {
  const {
    investmentAmount,
    ratios,
    cashAlloc,
    savings,
    bonds,
    emergencyFundGoal,
    warChestGoal,
    sgEquity,
    usEquity,
    sgSpent,
    usSpent,
  } = input;

  const totalRatio = ratios.rsp + ratios.us + ratios.sg;

  const rspMonthly = investmentAmount * (ratios.rsp / 100);
  const sgMonthly = investmentAmount * (ratios.sg / 100);
  const usMonthly = investmentAmount * (ratios.us / 100);
  const sgQuarterly = floorH(sgMonthly * 3);
  const usQuarterly = floorH(usMonthly * 3);

  const bondsSurplus = Math.max(bonds - warChestGoal, 0);
  const bondsShortfall = Math.max(warChestGoal - bonds, 0);
  const fromSavings = Math.max(savings - emergencyFundGoal - bondsShortfall, 0);
  const totalDeployable = floorH(fromSavings + bondsSurplus);
  const sgCash = floorH(totalDeployable * (cashAlloc.sg / 100));
  const usCash = floorH(totalDeployable * (cashAlloc.us / 100));

  const totalEquity = sgEquity + usEquity;
  const totalSupposed = totalEquity + totalDeployable;

  const sgTarget = totalSupposed * (cashAlloc.sg / 100);
  const usTarget = totalSupposed * (cashAlloc.us / 100);

  const sgAvailable = sgTarget - sgEquity;
  const usAvailable = usTarget - usEquity;

  const sgDeployPct = sgTarget > 0 ? (sgAvailable / sgTarget) * 100 : 0;
  const usDeployPct = usTarget > 0 ? (usAvailable / usTarget) * 100 : 0;

  const budgets: MarketBudgets = {
    sg: {
      target: sgTarget,
      quarterly: sgQuarterly,
      quarterSpent: sgSpent,
      quarterRemaining: Math.max(sgQuarterly - sgSpent, 0),
      deployableCash: sgCash,
    },
    us: {
      target: usTarget,
      quarterly: usQuarterly,
      quarterSpent: usSpent,
      quarterRemaining: Math.max(usQuarterly - usSpent, 0),
      deployableCash: usCash,
    },
  };

  return {
    totalRatio,
    rspMonthly,
    sgMonthly,
    usMonthly,
    sgQuarterly,
    usQuarterly,
    bondsSurplus,
    bondsShortfall,
    totalDeployable,
    sgCash,
    usCash,
    totalSupposed,
    sgTarget,
    usTarget,
    sgAvailable,
    usAvailable,
    sgDeployPct,
    usDeployPct,
    budgets,
  };
}
