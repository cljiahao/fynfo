import { buildExpenseChart } from '@/features/expenses/lib/expense-chart';
import type { ExpenseData } from '@/features/expenses/types';
import { describe, expect, it } from 'vitest';

const row: ExpenseData = {
  id: 'synthetic',
  date: '2026-10-01',
  type: 'food_drink',
  item: 'Sample meal',
  info: '',
  amount: 0.3,
  splitType: 'shared',
  splits: [{ person: 'Sample', amount: 0.1, settled: true }],
};
const now = new Date('2026-09-30T16:00:00Z');

describe('spending chart aggregation', () => {
  it('includes the new Singapore month before UTC changes month', () => {
    const result = buildExpenseChart([row], now)!;
    expect(result.chartData[0].monthKey).toBe('2025-11');
    expect(result.chartData[11].monthKey).toBe('2026-10');
    expect(result.totalExpense).toBe(0.2);
    expect(result.chartData[11].food_drink).toBe(0.2);
  });

  it('handles the Singapore year boundary and excludes the expired month', () => {
    const result = buildExpenseChart(
      [{ ...row, date: '2026-01-01' }],
      new Date('2026-12-31T16:00:00Z')
    )!;
    expect(result.chartData[0].monthKey).toBe('2026-02');
    expect(result.chartData[11].monthKey).toBe('2027-01');
    expect(result.totalExpense).toBe(0);
    expect(result.allTimeAvg).toBe(0.2);
  });

  it('uses cents and counts settled allocations in the personal share', () => {
    const result = buildExpenseChart(
      [row, { ...row, id: 'second', amount: 0.2, splits: [] }],
      now
    )!;
    expect(result.totalExpense).toBe(0.4);
    expect(result.avgExpense).toBe(0.4);
    expect(result.allTimeAvg).toBe(0.4);
  });

  it('preserves zero-share month and all-time average semantics', () => {
    const result = buildExpenseChart(
      [
        row,
        { ...row, date: '2026-09-01', amount: 0.1 },
        { ...row, date: '2024-01-01', amount: 0.6, splits: [] },
      ],
      now
    )!;
    expect(result.totalExpense).toBe(0.2);
    expect(result.avgExpense).toBe(0.2);
    expect(result.allTimeAvg).toBeCloseTo(0.8 / 3);
  });

  it.each([
    { ...row, amount: -1 },
    { ...row, amount: Number.NaN },
    { ...row, amount: Number.MAX_SAFE_INTEGER },
    { ...row, amount: 0.01 },
    { ...row, date: '2026-02-30' },
    { ...row, type: 'invalid' as ExpenseData['type'] },
  ])('withholds totals for invalid history %#', (invalid) => {
    expect(buildExpenseChart([row, invalid], now)).toBeNull();
  });

  it('rejects unsafe aggregate cents even when individual rows are safe', () => {
    const large = {
      ...row,
      amount: 50_000_000_000_000,
      splitType: 'self' as const,
    };
    expect(buildExpenseChart([large, large], now)).toBeNull();
  });

  it('returns a complete empty window without NaN', () => {
    const result = buildExpenseChart([], now)!;
    expect(result.chartData).toHaveLength(12);
    expect(result.totalExpense).toBe(0);
    expect(result.avgExpense).toBe(0);
    expect(result.allTimeAvg).toBe(0);
  });
});
