import {
  averageMonthlyTTM,
  currencySplit,
  expenseCoverage,
  forwardEstimate,
  incomeForRecentMonths,
  topTickerShares,
  trailingTwelveMonthChange,
} from '@/features/equity/lib/dividend-breakdown';
import type { Holding } from '@/features/equity/lib/holdings';
import type { DividendData } from '@/features/equity/types';
import { describe, expect, it } from 'vitest';

const RATE = 1.5;
const ASOF = '2026-06-15';

const div = (over: Partial<DividendData>): DividendData => ({
  ticker: 'MLT',
  amount: 100,
  currency: 'SGD',
  date: '2026-05-30',
  ...over,
});

const holding = (over: Partial<Holding>): Holding => ({
  ticker: 'MLT',
  market: 'SG',
  shares: 100,
  totalBuyCost: 1000,
  totalBuyShares: 100,
  avgBuyPrice: 10,
  costBasis: 10,
  ...over,
});

describe('trailingTwelveMonthChange', () => {
  it('compares the last 12 months with the 12 before', () => {
    const rows = [
      div({ amount: 150, date: '2026-03-01' }),
      div({ amount: 100, date: '2025-03-01' }),
    ];
    const r = trailingTwelveMonthChange(rows, RATE, ASOF);
    expect(r.current).toBe(150);
    expect(r.prior).toBe(100);
    expect(r.changePct).toBeCloseTo(0.5);
  });
  it('reports a negative change', () => {
    const rows = [
      div({ amount: 50, date: '2026-03-01' }),
      div({ amount: 100, date: '2025-03-01' }),
    ];
    expect(trailingTwelveMonthChange(rows, RATE, ASOF).changePct).toBeCloseTo(
      -0.5
    );
  });
  it('returns null change when the prior window is empty', () => {
    const r = trailingTwelveMonthChange([div({})], RATE, ASOF);
    expect(r.prior).toBe(0);
    expect(r.changePct).toBeNull();
  });
  it('handles empty input', () => {
    expect(trailingTwelveMonthChange([], RATE, ASOF)).toEqual({
      current: 0,
      prior: 0,
      changePct: null,
    });
  });
  it('converts USD and treats window edges as (start, end]', () => {
    const rows = [
      div({ amount: 10, currency: 'USD', date: '2026-06-15' }),
      div({ amount: 99, date: '2025-06-15' }),
      div({ amount: 20, date: '2025-06-16' }),
    ];
    const r = trailingTwelveMonthChange(rows, RATE, ASOF);
    expect(r.current).toBe(35);
    expect(r.prior).toBe(99);
  });
  it('falls back to 28 Feb on a leap day', () => {
    const rows = [
      div({ amount: 5, date: '2027-02-28' }),
      div({ amount: 7, date: '2026-03-01' }),
    ];
    const r = trailingTwelveMonthChange(rows, RATE, '2028-02-29');
    expect(r.current).toBe(0);
    expect(r.prior).toBe(7 + 5);
  });
});

describe('averageMonthlyTTM', () => {
  it('divides by twelve', () => {
    expect(averageMonthlyTTM(1200)).toBe(100);
    expect(averageMonthlyTTM(0)).toBe(0);
  });
});

describe('incomeForRecentMonths', () => {
  it('zero-fills 12 ascending months ending at the as-of month', () => {
    const r = incomeForRecentMonths(
      [div({ date: '2026-05-30' }), div({ date: '2026-05-02', amount: 20 })],
      RATE,
      ASOF
    );
    expect(r).toHaveLength(12);
    expect(r[0]?.month).toBe('2025-07');
    expect(r[11]?.month).toBe('2026-06');
    expect(r.find((m) => m.month === '2026-05')?.total).toBe(120);
    expect(r.filter((m) => m.total === 0)).toHaveLength(11);
  });
  it('crosses the year boundary', () => {
    const r = incomeForRecentMonths([], RATE, '2026-02-10', 4);
    expect(r.map((m) => m.month)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
  it('converts USD, ignores future and out-of-range rows', () => {
    const r = incomeForRecentMonths(
      [
        div({ amount: 10, currency: 'USD', date: '2026-06-01' }),
        div({ date: '2026-06-20' }),
        div({ date: '2024-01-01' }),
      ],
      RATE,
      ASOF
    );
    expect(r[11]?.total).toBe(15);
    expect(r.reduce((s, m) => s + m.total, 0)).toBe(15);
  });
  it('supports a single month', () => {
    const r = incomeForRecentMonths([div({})], RATE, ASOF, 1);
    expect(r).toEqual([{ month: '2026-06', total: 0 }]);
  });
});

describe('topTickerShares', () => {
  it('returns an empty breakdown when nothing was paid in the window', () => {
    expect(topTickerShares([], [], RATE, ASOF)).toEqual({
      total: 0,
      tickers: [],
      other: null,
    });
    expect(
      topTickerShares([div({ date: '2020-01-01' })], [], RATE, ASOF).tickers
    ).toEqual([]);
  });
  it('handles a single ticker with full share and no other bucket', () => {
    const r = topTickerShares(
      [div({ amount: 40 }), div({ amount: 60, date: '2026-01-10' })],
      [],
      RATE,
      ASOF
    );
    expect(r.total).toBe(100);
    expect(r.tickers).toEqual([
      { ticker: 'MLT', ttm: 100, share: 1, yieldOnCost: null },
    ]);
    expect(r.other).toBeNull();
  });
  it('folds tickers beyond the limit into Other and shares sum to 1', () => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((t, i) =>
      div({ ticker: t, amount: (7 - i) * 10 })
    );
    const r = topTickerShares(rows, [], RATE, ASOF);
    expect(r.tickers.map((t) => t.ticker)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(r.other).toEqual({ ttm: 30, share: 30 / 280, tickerCount: 2 });
    const sum =
      r.tickers.reduce((s, t) => s + t.share, 0) + (r.other?.share ?? 0);
    expect(sum).toBeCloseTo(1);
  });
  it('merges case variants and breaks ties by ticker', () => {
    const r = topTickerShares(
      [
        div({ ticker: 'mlt', amount: 10 }),
        div({ ticker: 'MLT', amount: 10 }),
        div({ ticker: 'AAA', amount: 20 }),
      ],
      [],
      RATE,
      ASOF
    );
    expect(r.tickers.map((t) => t.ticker)).toEqual(['AAA', 'MLT']);
  });
  it('computes yield on cost, converting US cost basis to SGD', () => {
    const rows = [
      div({ ticker: 'MLT', amount: 50 }),
      div({ ticker: 'VOO', amount: 30, currency: 'USD' }),
      div({ ticker: 'OLD', amount: 10 }),
    ];
    const r = topTickerShares(
      rows,
      [
        holding({ ticker: 'MLT' }),
        holding({ ticker: 'VOO', market: 'US', costBasis: 100, shares: 2 }),
      ],
      RATE,
      ASOF
    );
    const by = Object.fromEntries(r.tickers.map((t) => [t.ticker, t]));
    expect(by.MLT?.yieldOnCost).toBeCloseTo(50 / 1000);
    expect(by.VOO?.yieldOnCost).toBeCloseTo(45 / 300);
    expect(by.OLD?.yieldOnCost).toBeNull();
  });
  it('gives null yield for zero cost or non-finite conversion', () => {
    const rows = [div({ ticker: 'A' }), div({ ticker: 'B' })];
    const r = topTickerShares(
      rows,
      [
        holding({ ticker: 'A', costBasis: 0 }),
        holding({ ticker: 'B', market: 'US', costBasis: 5 }),
      ],
      Number.NaN,
      ASOF
    );
    expect(r.tickers.every((t) => t.yieldOnCost === null)).toBe(true);
  });
});

describe('forwardEstimate', () => {
  it('sums TTM for held tickers only', () => {
    const rows = [
      div({ ticker: 'MLT', amount: 100 }),
      div({ ticker: 'VOO', amount: 10, currency: 'USD' }),
      div({ ticker: 'SOLD', amount: 500 }),
      div({ ticker: 'MLT', amount: 999, date: '2024-01-01' }),
    ];
    const est = forwardEstimate(
      rows,
      [
        holding({ ticker: 'MLT' }),
        holding({ ticker: 'voo', market: 'US' }),
        holding({ ticker: 'SOLD', shares: 0 }),
      ],
      RATE,
      ASOF
    );
    expect(est).toBe(115);
  });
  it('is 0 with no holdings or no dividends', () => {
    expect(forwardEstimate([div({})], [], RATE, ASOF)).toBe(0);
    expect(forwardEstimate([], [holding({})], RATE, ASOF)).toBe(0);
  });
});

describe('expenseCoverage', () => {
  it('returns the fraction covered', () => {
    expect(expenseCoverage(500, 2000)).toBe(0.25);
  });
  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY, null, undefined])(
    'returns null for %s',
    (expenses) => {
      expect(expenseCoverage(500, expenses)).toBeNull();
    }
  );
});

describe('currencySplit', () => {
  it('splits SGD and USD received to date', () => {
    const r = currencySplit(
      [
        div({ amount: 100 }),
        div({ amount: 20, currency: 'USD' }),
        div({ amount: 999, date: '2027-01-01' }),
      ],
      RATE,
      ASOF
    );
    expect(r).toEqual({ sgd: 100, usdInSgd: 30, usdNative: 20 });
  });
  it('is all zero for no dividends', () => {
    expect(currencySplit([], RATE, ASOF)).toEqual({
      sgd: 0,
      usdInSgd: 0,
      usdNative: 0,
    });
  });
});
