import { computeExpenseDriftPct } from '@/features/assets/hooks/use-freedom-inputs';
import { expenseTrend } from '@/features/assets/lib/expense-trend';
import {
  calcRecentAvgExpense,
  calcRecentInsuranceAvg,
  computeSalaryPlan,
  insuranceHintPct,
  plannedSavingsRatePct,
  type SalaryPlanInput,
} from '@/features/assets/lib/salary-plan';
import type { ExpenseData } from '@/features/expenses';
import { describe, expect, it } from 'vitest';

const base: SalaryPlanInput = {
  salary: 10000,
  expenses: 2000,
  emergencyMonths: 3,
  warChestMonths: 9,
  titheEnabled: false,
  tithePctInput: 10,
  allowanceEnabled: false,
  allowancePctInput: 5,
  currentSavings: 100000,
  currentBonds: 100000,
};

describe('computeSalaryPlan insurance and CPF inputs', () => {
  it('defaults insurance to 5 percent and net to 80 percent', () => {
    const p = computeSalaryPlan(base);
    expect(p.insurancePct).toBe(0.05);
    expect(p.netAfterCpf).toBe(8000);
    expect(computeSalaryPlan({ ...base, insurancePctInput: 5 })).toEqual(p);
  });

  it('moves insurance and investing together for a 7 percent input', () => {
    const p5 = computeSalaryPlan(base);
    const p7 = computeSalaryPlan({ ...base, insurancePctInput: 7 });
    expect(p7.insurancePct).toBeCloseTo(0.07);
    expect(p7.insuranceAmt).toBeCloseTo(560);
    expect(p5.investmentPct - p7.investmentPct).toBeCloseTo(0.02);
  });

  it('falls back to the default for a non-finite insurance input', () => {
    const p = computeSalaryPlan({ ...base, insurancePctInput: Number.NaN });
    expect(p).toEqual(computeSalaryPlan(base));
    expect(Number.isFinite(p.investmentAmt)).toBe(true);
  });

  it('keeps salary * 0.8 when the CPF figure is absent or null', () => {
    expect(
      computeSalaryPlan({ ...base, employeeCpfMonthly: null }).netAfterCpf
    ).toBe(8000);
  });

  it('subtracts the supplied CPF and never goes negative', () => {
    expect(
      computeSalaryPlan({ ...base, employeeCpfMonthly: 1600 }).netAfterCpf
    ).toBe(8400);
    expect(
      computeSalaryPlan({ ...base, salary: 0, employeeCpfMonthly: 0 })
        .netAfterCpf
    ).toBe(0);
    expect(
      computeSalaryPlan({ ...base, salary: 100, employeeCpfMonthly: 500 })
        .netAfterCpf
    ).toBe(0);
  });
});

describe('calcRecentInsuranceAvg and hint', () => {
  const NOW = new Date(2026, 10, 15);
  const exp = (over: Partial<ExpenseData>): ExpenseData => ({
    id: 'x',
    date: '2026-10-01',
    type: 'insurance',
    item: '',
    info: '',
    amount: 0,
    splitType: 'self',
    splits: [],
    ...over,
  });

  it('counts only insurance, applies the share and skips the current month', () => {
    const list = [
      exp({ amount: 300 }),
      exp({
        amount: 100,
        splitType: 'shared',
        splits: [{ amount: 40 } as never],
      }),
      exp({ amount: 999, type: 'food_drink' }),
      exp({ amount: 777, date: '2026-11-02' }),
    ];
    const r = calcRecentInsuranceAvg(list, NOW);
    expect(r.average).toBe(360);
    expect(r.monthsUsed).toBe(1);
    expect(calcRecentAvgExpense(list, NOW).average).toBe(999);
  });

  it('is 0 without insurance and hides the hint', () => {
    expect(
      calcRecentInsuranceAvg([exp({ type: 'food_drink', amount: 5 })], NOW)
        .average
    ).toBe(0);
    expect(insuranceHintPct(0, 8000)).toBeNull();
  });

  it('uses the stated divisor with under 12 months of data', () => {
    const list = [
      exp({ date: '2026-08-01', amount: 300 }),
      exp({ date: '2026-10-01', amount: 300 }),
    ];
    const r = calcRecentInsuranceAvg(list, NOW);
    expect(r.monthsUsed).toBe(3);
    expect(r.average).toBe(200);
  });

  it('spreads an annual premium over overall expense history', () => {
    const list = [
      exp({ date: '2026-01-01', type: 'food_drink', amount: 100 }),
      exp({ date: '2026-09-01', amount: 1200 }),
    ];
    const r = calcRecentInsuranceAvg(list, NOW);
    expect(r.monthsUsed).toBe(10);
    expect(r.average).toBeCloseTo(120);
    expect(calcRecentAvgExpense(list, NOW)).toEqual({
      average: 10,
      monthsUsed: 10,
    });
  });

  it('computes percent of take-home and hides on bad net pay', () => {
    expect(insuranceHintPct(496, 8000)).toBeCloseTo(6.2);
    expect(insuranceHintPct(496, 0)).toBeNull();
    expect(insuranceHintPct(496, -1)).toBeNull();
  });
});

describe('computeExpenseDriftPct 3-month basis', () => {
  const twelve = { average: 1000, monthsUsed: 12 };

  it('is positive above and negative below the 12-month average', () => {
    expect(
      computeExpenseDriftPct({
        override: null,
        recentAvg: twelve,
        recentShort: { average: 1200, monthsUsed: 3 },
      })
    ).toBeCloseTo(20);
    expect(
      computeExpenseDriftPct({
        override: null,
        recentAvg: twelve,
        recentShort: { average: 800, monthsUsed: 3 },
      })
    ).toBeCloseTo(-20);
  });

  it('needs 3 months in both windows', () => {
    expect(
      computeExpenseDriftPct({
        override: null,
        recentAvg: twelve,
        recentShort: { average: 1200, monthsUsed: 2 },
      })
    ).toBeNull();
    expect(
      computeExpenseDriftPct({
        override: null,
        recentAvg: { average: 1000, monthsUsed: 2 },
        recentShort: { average: 1200, monthsUsed: 2 },
      })
    ).toBeNull();
  });

  it('uses the shorter 12-month average between 3 and 11 months', () => {
    expect(
      computeExpenseDriftPct({
        override: null,
        recentAvg: { average: 500, monthsUsed: 5 },
        recentShort: { average: 600, monthsUsed: 3 },
      })
    ).toBeCloseTo(20);
  });

  it('is null for zero averages', () => {
    expect(
      computeExpenseDriftPct({
        override: null,
        recentAvg: { average: 0, monthsUsed: 12 },
        recentShort: { average: 100, monthsUsed: 3 },
      })
    ).toBeNull();
    expect(
      computeExpenseDriftPct({
        override: null,
        recentAvg: twelve,
        recentShort: { average: 0, monthsUsed: 3 },
      })
    ).toBeNull();
  });

  it('leaves the override branch unchanged', () => {
    expect(
      computeExpenseDriftPct({
        override: 800,
        recentAvg: twelve,
        recentShort: { average: 5000, monthsUsed: 3 },
      })
    ).toBeCloseTo(25);
  });
});

describe('expenseTrend display rule', () => {
  it('hides without data, shows steady under 5 percent, else direction', () => {
    expect(expenseTrend(null)).toBeNull();
    expect(expenseTrend(4.9)).toEqual({ direction: 'steady' });
    expect(expenseTrend(-4.9)).toEqual({ direction: 'steady' });
    expect(expenseTrend(5)).toEqual({ direction: 'up', pct: 5 });
    expect(expenseTrend(-12.4)).toEqual({ direction: 'down', pct: 12 });
  });
});

describe('plannedSavingsRatePct', () => {
  it('is null for zero or negative net', () => {
    expect(plannedSavingsRatePct(0, 100, 100)).toBeNull();
    expect(plannedSavingsRatePct(-5, 100, 100)).toBeNull();
    expect(plannedSavingsRatePct(null, 100, 100)).toBeNull();
  });

  it('is (investing + savings) / net as a percent', () => {
    expect(plannedSavingsRatePct(5000, 1000, 500)).toBeCloseTo(30);
  });
});
