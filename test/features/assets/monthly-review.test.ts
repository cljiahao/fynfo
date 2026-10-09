import type { ExpenseData } from '@/features/expenses';
import { buildMonthlyReview } from '@/features/review/lib/monthly-review';
import { expect, it } from 'vitest';

it('uses exact calendar months, minor units and personal shared-expense amounts', () => {
  const expense: ExpenseData = {
    id: 'fixture',
    date: '2026-01-31',
    type: 'insurance',
    item: 'Insurance',
    info: '',
    amount: 100.1,
    splitType: 'shared',
    splits: [{ person: 'Other', amount: 25.05, settled: false }],
  };
  const review = buildMonthlyReview(
    '2026-01',
    [
      {
        id: '2025-12',
        entries: [{ category: 'savings', account: 'Fixture', amount: 100.1 }],
      },
      {
        id: '2026-01',
        entries: [{ category: 'savings', account: 'Fixture', amount: 120.2 }],
      },
    ],
    [
      { id: '2026-01', salary: 5000.1, bonus: 0.2 },
      { id: '2025-12', salary: 99999, bonus: 0 },
    ],
    [expense, { ...expense, id: 'outside', date: '2026-02-01' }]
  );
  expect(review).toMatchObject({
    grossIncome: 5000.3,
    personalSpending: 75.05,
    assetChange: 20.1,
    previousMonth: '2025-12',
    expenseCount: 1,
    incomeRecorded: true,
  });
  expect(
    buildMonthlyReview(
      '2026-01',
      [],
      [],
      [{ ...expense, splits: [{ ...expense.splits[0], settled: true }] }]
    ).personalSpending
  ).toBe(75.05);
  expect(
    buildMonthlyReview(
      '2026-01',
      [],
      [],
      [
        {
          ...expense,
          splits: [{ person: 'Other', amount: 101, settled: false }],
        },
      ]
    ).personalSpending
  ).toBeNull();
});

it('distinguishes missing records and refuses a comparison across a missing month', () => {
  expect(
    buildMonthlyReview(
      '2026-03',
      [
        {
          id: '2026-01',
          entries: [{ category: 'savings', account: '', amount: 100 }],
        },
        {
          id: '2026-03',
          entries: [{ category: 'savings', account: '', amount: 200 }],
        },
      ],
      [],
      []
    )
  ).toMatchObject({
    assetTotal: 200,
    assetChange: null,
    incomeRecorded: false,
    expenseCount: 0,
  });
  expect(() => buildMonthlyReview('', [], [], [])).toThrow();
});
