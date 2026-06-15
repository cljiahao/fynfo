import {
  nearestDpu,
  sharesHeldAsOf,
  suggestAmount,
} from '@/features/equity/lib/dividend-suggest';
import type { EquityTradeData } from '@/features/equity/types';
import { describe, expect, it } from 'vitest';

const trade = (over: Partial<EquityTradeData>): EquityTradeData => ({
  date: '2026-01-01',
  broker: 'IBKR',
  ticker: 'MLT',
  action: 'buy',
  shares: 100,
  price: 1,
  fees: 0,
  ...over,
});

describe('sharesHeldAsOf', () => {
  it('nets buys minus sells up to and including the date', () => {
    const trades = [
      trade({ date: '2026-01-01', action: 'buy', shares: 100 }),
      trade({ date: '2026-02-01', action: 'sell', shares: 30 }),
    ];
    expect(sharesHeldAsOf(trades, 'MLT', '2026-03-01')).toBe(70);
  });

  it('excludes trades dated after the as-of date', () => {
    const trades = [
      trade({ date: '2026-01-01', shares: 100 }),
      trade({ date: '2026-06-01', shares: 50 }),
    ];
    expect(sharesHeldAsOf(trades, 'MLT', '2026-03-01')).toBe(100);
  });

  it('ignores other tickers and is case-insensitive', () => {
    const trades = [
      trade({ ticker: 'mlt', shares: 100 }),
      trade({ ticker: 'FCT', shares: 999 }),
    ];
    expect(sharesHeldAsOf(trades, 'MLT', '2026-12-31')).toBe(100);
  });

  it('clamps to 0 when net is negative', () => {
    const trades = [
      trade({ date: '2026-01-01', action: 'buy', shares: 10 }),
      trade({ date: '2026-02-01', action: 'sell', shares: 40 }),
    ];
    expect(sharesHeldAsOf(trades, 'MLT', '2026-03-01')).toBe(0);
  });
});

describe('suggestAmount', () => {
  it('multiplies DPU by shares held', () => {
    expect(suggestAmount(0.022, 1000)).toBeCloseTo(22);
  });
});

describe('nearestDpu', () => {
  it('returns null when there are no points', () => {
    expect(nearestDpu([], '2026-05-30')).toBeNull();
  });

  it('picks the DPU of the ex-date closest to the target', () => {
    const points = [
      { exDate: '2026-02-15', dpu: 0.02 },
      { exDate: '2026-05-20', dpu: 0.025 },
      { exDate: '2026-08-15', dpu: 0.021 },
    ];
    expect(nearestDpu(points, '2026-05-30')).toBe(0.025);
  });
});
