import {
  computeInvestmentBreakdown,
  computeMarketEquity,
  computeQuarterSpend,
  deployPctColor,
  floorH,
  getCurrentQuarter,
  sumCat,
} from '@/features/assets/lib/investment-math';
import type { Holding } from '@/features/equity/lib/holdings';
import type { EquityTradeData } from '@/features/equity/types';
import { describe, expect, it } from 'vitest';

describe('floorH', () => {
  it('floors to the nearest 100', () => {
    expect(floorH(1099)).toBe(1000);
    expect(floorH(100)).toBe(100);
    expect(floorH(99)).toBe(0);
  });
});

describe('sumCat', () => {
  it('sums only the matching category', () => {
    const entries = [
      { category: 'savings' as const, account: '', amount: 100 },
      { category: 'savings' as const, account: '', amount: 50 },
      { category: 'bonds' as const, account: '', amount: 999 },
    ];
    expect(sumCat(entries, 'savings')).toBe(150);
    expect(sumCat(entries, 'bonds')).toBe(999);
  });
});

describe('getCurrentQuarter', () => {
  it('derives Q2 bounds for a mid-May date', () => {
    const q = getCurrentQuarter(new Date(2026, 4, 15)); // May 2026
    expect(q.label).toBe('Q2 2026');
    expect(q.start).toEqual(new Date(2026, 3, 1)); // Apr 1
    expect(q.end.getMonth()).toBe(5); // June
    expect(q.daysLeft).toBeGreaterThan(0);
  });
});

describe('deployPctColor', () => {
  it('maps deploy % to a semantic tone (low=gain, mid=warning, high=loss)', () => {
    expect(deployPctColor(0)).toBe('text-gain');
    expect(deployPctColor(20)).toBe('text-gain');
    expect(deployPctColor(40)).toBe('text-warning');
    expect(deployPctColor(80)).toBe('text-loss');
  });
});

const holding = (over: Partial<Holding>): Holding => ({
  ticker: 'X',
  market: 'SG',
  shares: 0,
  totalBuyCost: 0,
  totalBuyShares: 0,
  avgBuyPrice: 0,
  costBasis: 0,
  ...over,
});

describe('computeMarketEquity', () => {
  it('values each market at the given prices', () => {
    const holdings: Holding[] = [
      holding({ ticker: 'D05', market: 'SG', shares: 10 }),
      holding({ ticker: 'AAPL', market: 'US', shares: 5 }),
    ];
    const prices = {
      D05: {
        ticker: 'D05',
        symbol: 'D05.SI',
        price: 40,
        currency: 'SGD',
        change: 0,
        changePercent: 0,
      },
      AAPL: {
        ticker: 'AAPL',
        symbol: 'AAPL',
        price: 200,
        currency: 'USD',
        change: 0,
        changePercent: 0,
      },
    };
    const r = computeMarketEquity(holdings, prices);
    expect(r.sgEquity).toBe(400);
    expect(r.usEquity).toBe(1000);
    expect(r.totalEquity).toBe(1400);
  });

  it('treats missing prices as 0', () => {
    const holdings: Holding[] = [
      holding({ ticker: 'X', market: 'SG', shares: 10 }),
    ];
    expect(computeMarketEquity(holdings, undefined).sgEquity).toBe(0);
  });
});

describe('computeQuarterSpend', () => {
  const market = (t: string) => (t === 'D05' ? 'SG' : 'US') as 'SG' | 'US';
  const trade = (over: Partial<EquityTradeData>): EquityTradeData => ({
    id: 't',
    date: '2026-05-10',
    broker: 'IBKR',
    ticker: 'AAPL',
    action: 'buy',
    shares: 1,
    price: 100,
    fees: 0,
    ...over,
  });

  it('sums buy cost per market inside the window, ignoring sells/out-of-range', () => {
    const trades = [
      trade({ ticker: 'AAPL', shares: 2, price: 100, fees: 5 }), // US 205
      trade({ ticker: 'D05', shares: 10, price: 40, fees: 1 }), // SG 401
      trade({ ticker: 'AAPL', action: 'sell', shares: 1, price: 999 }), // ignored
      trade({ date: '2026-01-01' }), // out of window
    ];
    const r = computeQuarterSpend(
      trades,
      new Date(2026, 3, 1),
      new Date(2026, 5, 30, 23, 59, 59),
      market
    );
    expect(r.usSpent).toBe(205);
    expect(r.sgSpent).toBe(401);
  });
});

describe('computeInvestmentBreakdown', () => {
  const base = {
    investmentAmount: 1000,
    ratios: { rsp: 30, us: 20, sg: 50 },
    cashAlloc: { sg: 60, us: 40 },
    savings: 50000,
    bonds: 30000,
    emergencyFundGoal: 20000,
    warChestGoal: 25000,
    sgEquity: 6000,
    usEquity: 4000,
    sgSpent: 500,
    usSpent: 200,
  };

  it('derives monthly/quarterly splits floored to 100', () => {
    const r = computeInvestmentBreakdown(base);
    expect(r.totalRatio).toBe(100);
    expect(r.sgMonthly).toBe(500); // 1000 * 0.5
    expect(r.sgQuarterly).toBe(1500); // floorH(1500)
    expect(r.usQuarterly).toBe(600); // floorH(200*3)
  });

  it('computes deployable cash from savings surplus + bonds surplus', () => {
    const r = computeInvestmentBreakdown(base);
    // bondsSurplus = 30000-25000 = 5000; bondsShortfall = 0
    // fromSavings = 50000-20000-0 = 30000; total = floorH(35000) = 35000
    expect(r.bondsSurplus).toBe(5000);
    expect(r.totalDeployable).toBe(35000);
    expect(r.sgCash).toBe(floorHRef(35000 * 0.6));
    expect(r.usCash).toBe(floorHRef(35000 * 0.4));
  });

  it('subtracts a bonds shortfall from deployable savings', () => {
    const r = computeInvestmentBreakdown({ ...base, bonds: 20000 });
    // shortfall = 25000-20000 = 5000; fromSavings = 50000-20000-5000 = 25000
    expect(r.bondsShortfall).toBe(5000);
    expect(r.bondsSurplus).toBe(0);
    expect(r.totalDeployable).toBe(25000);
  });

  it('builds market budgets with remaining clamped at 0', () => {
    const r = computeInvestmentBreakdown({ ...base, sgSpent: 99999 });
    expect(r.budgets.sg.quarterRemaining).toBe(0);
    expect(r.budgets.us.quarterSpent).toBe(200);
  });
});

function floorHRef(v: number): number {
  return Math.floor(v / 100) * 100;
}
