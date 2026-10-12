import type { ExpenseData } from '@/features/expenses';
import {
  calculateReserve,
  compareBudget,
  parseContributionCount,
  parsePlanningAmount,
  qualifyBudgetSpending,
} from '@/features/review/lib/budget-reserve';
import { buildMonthlyReview } from '@/features/review/lib/monthly-review';
import { describe, expect, it } from 'vitest';

function expense(overrides: Partial<ExpenseData> = {}): ExpenseData {
  return {
    id: 'synthetic-expense',
    date: '2026-01-15',
    type: 'insurance',
    item: 'Synthetic cost',
    info: '',
    amount: 100,
    splitType: 'self',
    splits: [],
    ...overrides,
  };
}
function spending(rows: ExpenseData[], month = '2026-01') {
  return qualifyBudgetSpending(
    month,
    rows,
    buildMonthlyReview(month, [], [], rows)
  );
}

describe('explicit planning input', () => {
  it('distinguishes blank from zero and preserves decimal cents without floating rounding', () => {
    expect(parsePlanningAmount(' ')).toEqual({ status: 'unset' });
    expect(parsePlanningAmount('0')).toEqual({ status: 'valid', value: 0 });
    expect(parsePlanningAmount(' 1.15 ')).toEqual({
      status: 'valid',
      value: 115,
    });
    expect(parsePlanningAmount('0001.2')).toEqual({
      status: 'valid',
      value: 120,
    });
    expect(parsePlanningAmount('90071992547409.91')).toEqual({
      status: 'valid',
      value: Number.MAX_SAFE_INTEGER,
    });
  });
  it.each([
    '-1',
    'NaN',
    'Infinity',
    '1e2',
    '1.005',
    '1.',
    '.25',
    '1,000',
    '90071992547409.92',
    '999999999999999999999999',
  ])('rejects invalid amount %s rather than rounding or clamping', (input) => {
    expect(parsePlanningAmount(input)).toEqual({ status: 'invalid' });
  });
  it('requires an explicit whole contribution count in the selected range', () => {
    expect(parseContributionCount('')).toEqual({ status: 'unset' });
    expect(parseContributionCount('12')).toEqual({
      status: 'valid',
      value: 12,
    });
    for (const input of ['0', '13', '1.5', '-1', 'Infinity', '1e1'])
      expect(parseContributionCount(input)).toEqual({ status: 'invalid' });
  });
});

describe('qualified monthly recorded spending', () => {
  it('preserves exact contributing personal cents when the dollar round-trip changes a cent', () => {
    const rows = [
      expense({
        amount: 45035996273700.03,
        splitType: 'shared',
        splits: [{ person: 'Synthetic person', amount: 0.01, settled: false }],
      }),
    ];
    const review = buildMonthlyReview('2026-01', [], [], rows);
    expect(review.sources.expenses[0].personalCents).toBe(4503599627370002);
    expect(Math.round((review.personalSpending ?? 0) * 100)).toBe(
      4503599627370003
    );
    expect(qualifyBudgetSpending('2026-01', rows, review)).toEqual({
      status: 'recorded',
      cents: 4503599627370002,
      expenseCount: 1,
    });
    expect(
      compareBudget(
        4503599627370002,
        qualifyBudgetSpending('2026-01', rows, review)
      )
    ).toEqual({ status: 'within-limit', remainingCents: 0 });
  });
  it('rejects an unknown split type rather than counting it as a self expense', () => {
    const malformed = {
      ...expense(),
      splitType: 'unexpected',
      splits: [{ person: 'Synthetic person', amount: 50, settled: false }],
    } as unknown as ExpenseData;
    expect(spending([malformed])).toEqual({
      status: 'invalid',
      issue: 'splits',
    });
  });
  it('uses exact recorded month and all personal shares regardless of category or settlement', () => {
    const rows = [
      expense({
        amount: 10.01,
        splitType: 'shared',
        splits: [
          { person: 'Synthetic person', amount: 3.34, settled: true },
          { person: 'Synthetic other', amount: 2.22, settled: false },
        ],
      }),
      expense({
        id: 'second',
        date: '2026-01-31T23:30:00-08:00',
        type: 'travel',
        amount: 1.15,
      }),
      expense({ id: 'outside', date: '2026-02-01', amount: 999 }),
    ];
    expect(spending(rows)).toEqual({
      status: 'recorded',
      cents: 560,
      expenseCount: 2,
    });
    rows[0].splits.forEach((split) => {
      split.settled = !split.settled;
    });
    expect(spending(rows)).toEqual({
      status: 'recorded',
      cents: 560,
      expenseCount: 2,
    });
  });
  it('distinguishes missing records from recorded zero personal share', () => {
    expect(spending([])).toEqual({ status: 'not-recorded' });
    expect(
      spending([
        expense({
          splitType: 'shared',
          splits: [{ person: 'Synthetic person', amount: 100, settled: false }],
        }),
      ])
    ).toEqual({ status: 'recorded', cents: 0, expenseCount: 1 });
  });
  it.each([NaN, Infinity, -1, 0, Number.MAX_SAFE_INTEGER])(
    'blocks malformed contributing bill %s',
    (amount) => {
      expect(spending([expense({ amount })])).toEqual({
        status: 'invalid',
        issue: 'amount',
      });
    }
  );
  it.each([NaN, Infinity, -1, 100.01])(
    'blocks malformed or overallocated shared amount %s without a partial total',
    (amount) => {
      expect(
        spending([
          expense(),
          expense({
            id: 'bad',
            splitType: 'shared',
            splits: [{ person: 'Synthetic person', amount, settled: false }],
          }),
        ])
      ).toMatchObject({ status: 'invalid', issue: 'splits' });
    }
  );
  it('does not let invalid amounts from another valid month poison this month', () => {
    expect(
      spending([
        expense(),
        expense({ id: 'outside', date: '2026-02-15', amount: NaN }),
      ])
    ).toEqual({ status: 'recorded', cents: 10000, expenseCount: 1 });
  });
  it.each(['not-a-date', '2026-02-30', '2026-01-15Tnonsense'])(
    'blocks unassignable or invalid date %s instead of excluding it',
    (date) => {
      expect(spending([expense(), expense({ id: 'bad-date', date })])).toEqual({
        status: 'invalid',
        issue: 'date',
      });
    }
  );
  it('blocks an unsafe accumulated cents total and inconsistent review', () => {
    expect(
      spending([
        expense({ amount: 50000000000000 }),
        expense({ id: 'second', amount: 50000000000000 }),
      ])
    ).toEqual({ status: 'invalid', issue: 'overflow' });
    expect(
      qualifyBudgetSpending('2026-01', [expense()], {
        ...buildMonthlyReview('2026-01', [], [], [expense()]),
        personalSpending: 100,
        expenseCount: 0,
      })
    ).toEqual({ status: 'invalid', issue: 'review' });
    expect(
      qualifyBudgetSpending('2026-01', [expense()], {
        ...buildMonthlyReview('2026-01', [], [], [expense()]),
        personalSpending: 101,
        expenseCount: 1,
      })
    ).toEqual({ status: 'invalid', issue: 'review' });
    expect(
      qualifyBudgetSpending('2026-13', [], {
        ...buildMonthlyReview('2026-01', [], [], []),
        personalSpending: 0,
        expenseCount: 0,
      })
    ).toEqual({ status: 'invalid', issue: 'month' });
  });
});

describe('budget comparison', () => {
  it('compares recorded cents and keeps overspending signed without advice or clamping', () => {
    const recorded = {
      status: 'recorded' as const,
      cents: 1050,
      expenseCount: 1,
    };
    expect(compareBudget(1200, recorded)).toEqual({
      status: 'within-limit',
      remainingCents: 150,
    });
    expect(compareBudget(1000, recorded)).toEqual({
      status: 'over-limit',
      remainingCents: -50,
    });
    expect(compareBudget(0, { ...recorded, cents: 0 })).toEqual({
      status: 'within-limit',
      remainingCents: 0,
    });
    expect(compareBudget(1000, { status: 'not-recorded' })).toEqual({
      status: 'unavailable',
    });
    expect(compareBudget(-1, recorded)).toEqual({ status: 'invalid-limit' });
  });
});

describe('explicit reserve arithmetic', () => {
  it('distributes ceiling contributions with an adjusted final slot and no inferred dates', () => {
    expect(calculateReserve(10000, 1, 4)).toEqual({
      status: 'remaining',
      remainingCents: 9999,
      regularContributionCents: 2500,
      contributionsCents: [2500, 2500, 2500, 2499],
      finalContributionCents: 2499,
    });
  });
  it('does not produce negative payments when the target is fewer cents than planned slots', () => {
    expect(calculateReserve(2, 0, 4)).toEqual({
      status: 'remaining',
      remainingCents: 2,
      regularContributionCents: 1,
      contributionsCents: [1, 1, 0, 0],
      finalContributionCents: 0,
    });
  });
  it('handles explicitly covered or zero targets without altering entered amounts', () => {
    expect(calculateReserve(100, 150, 1)).toEqual({
      status: 'covered',
      remainingCents: 0,
      regularContributionCents: 0,
      contributionsCents: [0],
      finalContributionCents: 0,
    });
    expect(calculateReserve(0, 0, 12).status).toBe('covered');
  });
  it('preserves exact safe-cent totals across all allowed contribution counts', () => {
    for (const target of [0, 1, 2, 101, 9999, Number.MAX_SAFE_INTEGER]) {
      for (let count = 1; count <= 12; count += 1) {
        const result = calculateReserve(target, 0, count);
        if (result.status === 'invalid')
          throw new Error('Valid explicit inputs were rejected');
        expect(result.contributionsCents).toHaveLength(count);
        expect(
          result.contributionsCents.every(
            (amount) => Number.isSafeInteger(amount) && amount >= 0
          )
        ).toBe(true);
        expect(
          result.contributionsCents.reduce(
            (sum, amount) => sum + BigInt(amount),
            BigInt(0)
          )
        ).toBe(BigInt(target));
      }
    }
  });
  it.each([
    [1.5, 0, 1],
    [-1, 0, 1],
    [NaN, 0, 1],
    [100, Infinity, 1],
    [100, 0, 0],
    [100, 0, 13],
    [100, 0, 1.5],
  ])('rejects invalid explicit inputs %s/%s/%s', (target, reserved, count) => {
    expect(calculateReserve(target, reserved, count)).toEqual({
      status: 'invalid',
    });
  });
});
