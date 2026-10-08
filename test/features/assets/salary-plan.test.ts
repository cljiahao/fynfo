import {
  calcAllTimeAvgExpense,
  ceilToThousand,
  computeSalaryPlan,
  sumByCategory,
} from '@/features/assets/lib/salary-plan';
import type { ExpenseData } from '@/features/expenses';
import { describe, expect, it } from 'vitest';

describe('ceilToThousand', () => {
  it('rounds up to the nearest 1000', () => {
    expect(ceilToThousand(2001)).toBe(3000);
    expect(ceilToThousand(3000)).toBe(3000);
    expect(ceilToThousand(0)).toBe(0);
  });
});

describe('sumByCategory', () => {
  it('sums one category', () => {
    const entries = [
      { category: 'savings' as const, account: '', amount: 10 },
      { category: 'bonds' as const, account: '', amount: 5 },
      { category: 'savings' as const, account: '', amount: 7 },
    ];
    expect(sumByCategory(entries, 'savings')).toBe(17);
  });
});

describe('calcAllTimeAvgExpense', () => {
  const exp = (over: Partial<ExpenseData>): ExpenseData => ({
    id: 'x',
    date: '2026-06-01',
    type: 'food_drink',
    item: '',
    info: '',
    amount: 0,
    splitType: 'self',
    splits: [],
    ...over,
  });

  it('returns 0 for no expenses', () => {
    expect(calcAllTimeAvgExpense(undefined)).toBe(0);
    expect(calcAllTimeAvgExpense([])).toBe(0);
  });

  it('returns zero when every expense is excluded insurance', () => {
    expect(
      calcAllTimeAvgExpense([
        exp({ type: 'insurance', amount: 100, date: '2026-05-10' }),
        exp({ type: 'insurance', amount: 200, date: '2026-06-10' }),
      ])
    ).toBe(0);
  });

  it('averages per-month user-share, subtracting others split portions', () => {
    const list = [
      exp({ date: '2026-05-10', amount: 100 }),
      exp({
        date: '2026-06-05',
        amount: 200,
        splitType: 'shared',
        splits: [{ person: 'A', amount: 120, settled: false }],
        // June user-share: 80
      }),
    ];
    // (100 + 80) / 2 months = 90
    expect(calcAllTimeAvgExpense(list)).toBe(90);
  });
});

describe('computeSalaryPlan', () => {
  const base = {
    salary: 10000,
    expenses: 2000,
    emergencyMonths: 3,
    warChestMonths: 9,
    titheEnabled: true,
    tithePctInput: 10,
    allowanceEnabled: false,
    allowancePctInput: 5,
    currentSavings: 0,
    currentBonds: 0,
  };

  it('computes net after a flat 20% CPF and the goal amounts', () => {
    const p = computeSalaryPlan(base);
    expect(p.netAfterCpf).toBe(8000);
    expect(p.emergencyFundGoal).toBe(6000);
    expect(p.warChestGoal).toBe(18000);
  });

  it('routes the capped remainder to savings while goals are unmet', () => {
    const p = computeSalaryPlan(base);
    // used = expenses(0.25) + ins(0.05) + tithe(0.10) = 0.40; capped = 0.60
    // remaining goals = 24000; average = 24000/9 = 2666.7; cappedAmount = 4800
    // average < cappedAmount → savingsPct = 2666.7/8000
    expect(p.savingsPct).toBeCloseTo(2666.6667 / 8000, 4);
    expect(p.investmentPct).toBeCloseTo(0.6 - 2666.6667 / 8000, 4);
    expect(p.goalsFulfilled).toBe(false);
  });

  it('sends everything spare to investment once goals are fulfilled', () => {
    const p = computeSalaryPlan({
      ...base,
      currentSavings: 6000,
      currentBonds: 18000,
    });
    expect(p.goalsFulfilled).toBe(true);
    expect(p.savingsPct).toBe(0);
    expect(p.investmentPct).toBeCloseTo(0.6, 6);
  });

  it('zeroes all allocations when salary is 0', () => {
    const p = computeSalaryPlan({ ...base, salary: 0 });
    expect(p.netAfterCpf).toBe(0);
    expect(p.savingsPct).toBe(0);
    expect(p.investmentPct).toBe(0);
    expect(p.investmentAmt).toBe(0);
  });
});
