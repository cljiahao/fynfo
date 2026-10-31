import {
  dividendSummary,
  incomeByYear,
  incomeForRecentYears,
  toSGD,
  totalSGD,
  trailing12MonthSGD,
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

// USD -> SGD
const RATE = 1.35;

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

describe('incomeForRecentYears', () => {
  it('returns five ascending years, zero-fills gaps and ignores outside years', () => {
    const out = incomeForRecentYears(
      [
        div({ date: '2021-03-01', amount: 10 }),
        div({ date: '2024-03-01', amount: 40 }),
        div({ date: '2024-09-01', amount: 10, currency: 'USD' }),
        div({ date: '2019-01-01', amount: 999 }),
        div({ date: '2027-01-01', amount: 999 }),
      ],
      RATE,
      2026
    );
    expect(out.map((r) => r.year)).toEqual([
      '2022',
      '2023',
      '2024',
      '2025',
      '2026',
    ]);
    expect(out.map((r) => r.total)).toEqual([0, 0, 40 + 13.5, 0, 0]);
  });
});

describe('trailing12MonthSGD', () => {
  const asOf = '2026-06-15';
  it('includes one year back minus a day, excludes exactly one year back and future rows', () => {
    const out = trailing12MonthSGD(
      [
        div({ date: '2025-06-16', amount: 1 }),
        div({ date: '2025-06-15', amount: 100 }),
        div({ date: '2026-06-16', amount: 100 }),
        div({ date: '2026-06-15', amount: 2, ticker: 'FCT' }),
      ],
      RATE,
      asOf
    );
    expect(out).toBe(3);
  });
  it('uses 28 Feb of the previous year when asOf is 29 Feb', () => {
    const out = trailing12MonthSGD(
      [
        div({ date: '2023-02-28', amount: 100 }),
        div({ date: '2023-03-01', amount: 5 }),
        div({ date: '2024-02-29', amount: 7 }),
      ],
      RATE,
      '2024-02-29'
    );
    expect(out).toBe(12);
  });
});

describe('dividendSummary', () => {
  const asOf = '2026-06-15';
  it('averages over completed years only, counting a gap year as zero', () => {
    const out = dividendSummary(
      [
        div({ date: '2023-05-01', amount: 300 }),
        div({ date: '2025-05-01', amount: 300 }),
        div({ date: '2026-02-01', amount: 1000 }),
        div({ date: '2026-12-01', amount: 5000 }),
      ],
      RATE,
      asOf
    );
    expect(out.fullYears).toBe(3);
    expect(out.averagePerYear).toBe(200);
    expect(out.totalToDate).toBe(1600);
    expect(out.trailing12m).toBe(1000);
  });
  it('has no average when the first dividend is in the current year', () => {
    const out = dividendSummary([div({ date: '2026-02-01' })], RATE, asOf);
    expect(out).toMatchObject({ averagePerYear: null, fullYears: 0 });
    expect(out.totalToDate).toBe(100);
  });
  it('returns zeros for no dividends or only future rows', () => {
    const empty = {
      totalToDate: 0,
      trailing12m: 0,
      averagePerYear: null,
      fullYears: 0,
    };
    expect(dividendSummary([], RATE, asOf)).toEqual(empty);
    expect(dividendSummary([div({ date: '2026-12-01' })], RATE, asOf)).toEqual(
      empty
    );
  });
});

describe('ttmDistributionsSGD', () => {
  it('sums only the ticker within the trailing 12 months of asOf', () => {
    const dividends = [
      // in window
      div({ ticker: 'MLT', date: '2025-07-01', amount: 30 }),
      // in window
      div({ ticker: 'MLT', date: '2026-05-01', amount: 40 }),
      // >12mo old
      div({ ticker: 'MLT', date: '2025-05-01', amount: 99 }),
      // future
      div({ ticker: 'MLT', date: '2026-07-01', amount: 99 }),
      // other ticker
      div({ ticker: 'FCT', date: '2026-05-01', amount: 99 }),
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
