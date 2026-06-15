import {
  incomeByYear,
  toSGD,
  totalSGD,
  totalsByTicker,
  ttmDistributionsSGD,
  yieldOnCost,
} from '@/features/equity/lib/dividend-metrics';
import type { Holding } from '@/features/equity/lib/holdings';
import type { DividendData } from '@/features/equity/types';
import { describe, expect, it } from 'vitest';

const div = (over: Partial<DividendData>): DividendData => ({
  ticker: 'MLT',
  amount: 100,
  currency: 'SGD',
  date: '2026-05-30',
  ...over,
});

const RATE = 1.35; // USD -> SGD

describe('toSGD', () => {
  it('passes SGD through unchanged', () => {
    expect(toSGD(100, 'SGD', RATE)).toBe(100);
  });
  it('converts USD by the rate', () => {
    expect(toSGD(100, 'USD', RATE)).toBeCloseTo(135);
  });
});

describe('totalSGD', () => {
  it('sums mixed-currency distributions in SGD', () => {
    const out = totalSGD(
      [
        div({ amount: 100, currency: 'SGD' }),
        div({ amount: 10, currency: 'USD' }),
      ],
      RATE
    );
    expect(out).toBeCloseTo(113.5);
  });
});

describe('totalsByTicker', () => {
  it('groups by ticker and sorts descending by total', () => {
    const out = totalsByTicker(
      [
        div({ ticker: 'MLT', amount: 50 }),
        div({ ticker: 'FCT', amount: 80 }),
        div({ ticker: 'mlt', amount: 50 }),
      ],
      RATE
    );
    expect(out).toEqual([
      { ticker: 'MLT', total: 100 },
      { ticker: 'FCT', total: 80 },
    ]);
  });
});

describe('incomeByYear', () => {
  it('groups by calendar year ascending', () => {
    const out = incomeByYear(
      [
        div({ date: '2025-03-01', amount: 40 }),
        div({ date: '2026-03-01', amount: 60 }),
        div({ date: '2026-09-01', amount: 10 }),
      ],
      RATE
    );
    expect(out).toEqual([
      { year: '2025', total: 40 },
      { year: '2026', total: 70 },
    ]);
  });
});

describe('ttmDistributionsSGD', () => {
  it('sums only the ticker within the trailing 12 months of asOf', () => {
    const dividends = [
      div({ ticker: 'MLT', date: '2025-07-01', amount: 30 }), // in window
      div({ ticker: 'MLT', date: '2026-05-01', amount: 40 }), // in window
      div({ ticker: 'MLT', date: '2025-05-01', amount: 99 }), // >12mo old
      div({ ticker: 'MLT', date: '2026-07-01', amount: 99 }), // future
      div({ ticker: 'FCT', date: '2026-05-01', amount: 99 }), // other ticker
    ];
    expect(ttmDistributionsSGD(dividends, 'MLT', RATE, '2026-06-15')).toBe(70);
  });
});

describe('yieldOnCost', () => {
  const holding = (over: Partial<Holding>): Holding => ({
    ticker: 'MLT',
    market: 'SG',
    shares: 1000,
    totalBuyCost: 2000,
    totalBuyShares: 1000,
    avgBuyPrice: 2,
    costBasis: 2,
    ...over,
  });

  it('divides TTM income by cost of shares still held', () => {
    // cost = costBasis(2) * shares(1000) = 2000; 100 / 2000 = 0.05
    expect(yieldOnCost(100, holding({}))).toBeCloseTo(0.05);
  });

  it('returns 0 when there is no cost basis', () => {
    expect(yieldOnCost(100, holding({ costBasis: 0, shares: 0 }))).toBe(0);
  });
});
