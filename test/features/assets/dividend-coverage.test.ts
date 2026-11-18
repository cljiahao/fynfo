import {
  computeDividendAllowance,
  computeDividendCoverage,
} from '@/features/assets/lib/dividend-coverage';
import { describe, expect, it } from 'vitest';

describe('computeDividendCoverage', () => {
  it('computes coverage from the TTM monthly average', () => {
    const r = computeDividendCoverage({
      ttmMonthlyAvg: 300,
      monthlyExpenses: 2000,
    });
    expect(r.coverage).toBeCloseTo(0.15);
    expect(r.reached).toBe(0.1);
    expect(r.next).toBe(0.25);
    expect(r.gapTtmSgd).toBeCloseTo((0.25 * 2000 - 300) * 12);
  });

  it('gives null everything for zero or invalid expenses', () => {
    for (const monthlyExpenses of [0, -5, Number.NaN, null]) {
      expect(
        computeDividendCoverage({ ttmMonthlyAvg: 100, monthlyExpenses })
      ).toEqual({ coverage: null, reached: null, next: null, gapTtmSgd: null });
    }
  });

  it('gives coverage 0 and the first milestone for zero dividends', () => {
    const r = computeDividendCoverage({
      ttmMonthlyAvg: 0,
      monthlyExpenses: 1000,
    });
    expect(r.coverage).toBe(0);
    expect(r.reached).toBeNull();
    expect(r.next).toBe(0.1);
    expect(r.gapTtmSgd).toBeCloseTo(0.1 * 1000 * 12);
  });

  it('counts a milestone hit exactly as reached', () => {
    const r = computeDividendCoverage({
      ttmMonthlyAvg: 500,
      monthlyExpenses: 1000,
    });
    expect(r.reached).toBe(0.5);
    expect(r.next).toBe(1);
    expect(r.gapTtmSgd).toBeCloseTo(6000);
  });

  it('has no next milestone or gap at or above 100%', () => {
    const r = computeDividendCoverage({
      ttmMonthlyAvg: 1500,
      monthlyExpenses: 1000,
    });
    expect(r.reached).toBe(1);
    expect(r.next).toBeNull();
    expect(r.gapTtmSgd).toBeNull();
  });

  it('gives null for unvalued, negative or non-finite dividends', () => {
    for (const ttmMonthlyAvg of [null, -1, Number.NaN, Infinity]) {
      expect(
        computeDividendCoverage({ ttmMonthlyAvg, monthlyExpenses: 1000 })
          .coverage
      ).toBeNull();
    }
  });
});

describe('computeDividendAllowance', () => {
  const args = { ttmMonthlyAvg: 400, thresholdPct: 25, sharePct: 50 };

  it('is 0 below the threshold and reinvests everything', () => {
    expect(computeDividendAllowance({ ...args, coverage: 0.24 })).toEqual({
      monthlyAllowance: 0,
      monthlyReinvest: 400,
    });
  });

  it('spends the share at and above the threshold', () => {
    for (const coverage of [0.25, 0.8]) {
      const r = computeDividendAllowance({ ...args, coverage });
      expect(r?.monthlyAllowance).toBe(200);
      expect(r?.monthlyReinvest).toBe(200);
    }
  });

  it('handles share 0 and 100', () => {
    expect(
      computeDividendAllowance({ ...args, coverage: 1, sharePct: 0 })
    ).toEqual({ monthlyAllowance: 0, monthlyReinvest: 400 });
    expect(
      computeDividendAllowance({ ...args, coverage: 1, sharePct: 100 })
    ).toEqual({ monthlyAllowance: 400, monthlyReinvest: 0 });
  });

  it('uses the 25 / 50 defaults when settings are absent', () => {
    expect(
      computeDividendAllowance({ ttmMonthlyAvg: 400, coverage: 0.3 })
        ?.monthlyAllowance
    ).toBe(200);
  });

  it('is null when coverage is null and never negative', () => {
    expect(computeDividendAllowance({ ...args, coverage: null })).toBeNull();
    const r = computeDividendAllowance({
      ttmMonthlyAvg: -50,
      coverage: 1,
      thresholdPct: 25,
      sharePct: 150,
    });
    expect(r?.monthlyAllowance).toBe(0);
    expect(r?.monthlyReinvest).toBe(0);
  });
});
