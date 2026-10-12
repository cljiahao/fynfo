import {
  buildExpenseAnomalyReview,
  type ExpenseAnomalyReview,
} from '@/features/expenses/lib/expense-anomalies';
import type { ExpenseData, ExpenseType } from '@/features/expenses/types';
import { describe, expect, it } from 'vitest';

const SELECTED_MONTH = '2026-09';
const CURRENT_MONTH = '2026-10';
const BASELINE_MONTHS = ['2026-06', '2026-07', '2026-08'];

function expense(
  month: string,
  amount: number,
  type: ExpenseType = 'groceries',
  suffix = ''
): ExpenseData {
  return {
    id: `${type}-${month}-${suffix}`,
    date: `${month}-15`,
    type,
    item: 'Synthetic household expense',
    info: '',
    amount,
    splitType: 'self',
    splits: [],
  };
}

function history(
  current = 100,
  baseline: readonly number[] = [50, 50, 50],
  category: ExpenseType = 'groceries'
): ExpenseData[] {
  return [
    ...BASELINE_MONTHS.map(function baselineExpense(month, index) {
      return expense(month, baseline[index], category);
    }),
    expense(SELECTED_MONTH, current, category),
  ];
}

function readyReview(rows: readonly ExpenseData[]) {
  const result = buildExpenseAnomalyReview(rows, SELECTED_MONTH, CURRENT_MONTH);
  expect(result.status).toBe('ready');
  if (result.status !== 'ready') throw new Error('Expected ready review');
  return result;
}

function comparableCategory(
  result: Extract<ExpenseAnomalyReview, { status: 'ready' }>,
  category: ExpenseType = 'groceries'
) {
  const comparison = result.categories.find(function matchingCategory(item) {
    return item.category === category;
  });
  expect(comparison?.status).toBe('comparable');
  if (!comparison || comparison.status !== 'comparable')
    throw new Error('Expected comparable category');
  return comparison;
}

function unavailableCategory(
  result: Extract<ExpenseAnomalyReview, { status: 'ready' }>,
  category: ExpenseType = 'groceries'
) {
  const comparison = result.categories.find(function matchingCategory(item) {
    return item.category === category;
  });
  expect(comparison?.status).toBe('unavailable');
  if (!comparison || comparison.status !== 'unavailable')
    throw new Error('Expected unavailable category');
  return comparison;
}

describe('recorded category spending review', () => {
  it.each([
    { current: 100, baseline: 50, flagged: true },
    { current: 99.99, baseline: 50, flagged: false },
    { current: 40, baseline: 20, flagged: false },
    { current: 150, baseline: 100, flagged: false },
    { current: 200, baseline: 100, flagged: true },
  ])(
    'requires both rules at the exact boundary: $current / $baseline',
    ({ current, baseline, flagged }) => {
      const result = readyReview(
        history(current, [baseline, baseline, baseline])
      );
      expect(result.suggestions).toHaveLength(flagged ? 1 : 0);
    }
  );

  it('uses the median of exactly the preceding three months, not their mean', () => {
    const result = readyReview(history(90, [20, 1000, 40]));
    expect(result.baselineMonths).toEqual(BASELINE_MONTHS);
    expect(result.suggestions[0]).toMatchObject({
      category: 'groceries',
      selectedTotalCents: 9000,
      baselineMedianCents: 4000,
      excessCents: 5000,
      baselineTotals: [
        { month: '2026-06', totalCents: 2000, recordCount: 1 },
        { month: '2026-07', totalCents: 100000, recordCount: 1 },
        { month: '2026-08', totalCents: 4000, recordCount: 1 },
      ],
    });
  });

  it('does not replace missing calendar/category history with older records or zero', () => {
    const rows = history().filter(function omitJuly(row) {
      return row.date.slice(0, 7) !== '2026-07';
    });
    rows.push(expense('2026-05', 50), expense('2026-07', 50, 'bills'));
    const result = readyReview(rows);
    expect(result.suggestions).toEqual([]);
    expect(unavailableCategory(result)).toMatchObject({
      reason: 'missing-history',
      missingMonths: ['2026-07'],
    });
    expect(readyReview([]).suggestions).toEqual([]);
    expect(unavailableCategory(readyReview([])).missingMonths).toEqual([
      ...BASELINE_MONTHS,
      SELECTED_MONTH,
    ]);
  });

  it('subtracts all other-person shares regardless of settlement', () => {
    const rows = history(400, [200, 200, 200]).map(function sharedExpense(row) {
      return {
        ...row,
        splitType: 'shared' as const,
        splits: [
          {
            person: 'Synthetic person',
            amount: row.amount / 2,
            settled: false,
          },
        ],
      };
    });
    const before = readyReview(rows);
    const settled = readyReview(
      rows.map(function settleExpense(row) {
        return {
          ...row,
          splits: row.splits.map(function settle(split) {
            return { ...split, settled: true };
          }),
        };
      })
    );
    expect(settled).toEqual(before);
    expect(before.suggestions[0].sources[0]).toMatchObject({
      grossCents: 40000,
      otherCents: 20000,
      personalCents: 20000,
    });
  });

  it('retains genuine zero personal shares without inventing a zero-baseline ratio', () => {
    const rows = history().map(function fullyAllocated(row) {
      return {
        ...row,
        splitType: 'shared' as const,
        splits: [
          { person: 'Synthetic person', amount: row.amount, settled: false },
        ],
      };
    });
    const result = readyReview(rows);
    expect(unavailableCategory(result).reason).toBe('zero-baseline');
    expect(result.suggestions).toEqual([]);
    const selectedZero = history().map(function zeroCurrentShare(row) {
      return row.date.slice(0, 7) === SELECTED_MONTH
        ? {
            ...row,
            splitType: 'shared' as const,
            splits: [
              { person: 'Synthetic person', amount: row.amount, settled: true },
            ],
          }
        : row;
    });
    expect(
      comparableCategory(readyReview(selectedZero)).selectedTotalCents
    ).toBe(0);
  });

  it('rounds each expense and each share before adding cents, and ignores stale self split rows', () => {
    const rows = history(100.01, [50, 50, 50]);
    rows[3] = {
      ...rows[3],
      splitType: 'shared',
      splits: [{ person: 'Synthetic person', amount: 0.014, settled: false }],
    };
    rows.push(expense(SELECTED_MONTH, 0.014, 'groceries', 'rounding-1'));
    rows.push(expense(SELECTED_MONTH, 0.014, 'groceries', 'rounding-2'));
    const result = readyReview(rows);
    expect(comparableCategory(result).selectedTotalCents).toBe(10002);
    const source = result.suggestions[0].sources.find(
      function originalSource(row) {
        return row.id === rows[3].id;
      }
    );
    expect(source).toMatchObject({
      grossCents: 10001,
      otherCents: 1,
      personalCents: 10000,
    });
    rows[0].splits = [
      { person: 'Synthetic stale share', amount: Number.NaN, settled: false },
    ];
    expect(comparableCategory(readyReview(rows)).baselineMedianCents).toBe(
      5000
    );
  });

  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER,
  ])(
    'makes an invalid gross amount %s unavailable without clamping it',
    (amount) => {
      const result = readyReview([
        ...history(),
        expense(SELECTED_MONTH, amount, 'groceries', 'bad'),
      ]);
      expect(unavailableCategory(result).reason).toBe('invalid-record');
      expect(result.suggestions).toEqual([]);
    }
  );

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 101])(
    'suppresses only the affected category for invalid share %s',
    (amount) => {
      const invalid = expense(SELECTED_MONTH, 100, 'groceries', 'bad-shared');
      invalid.splitType = 'shared';
      invalid.splits = [{ person: 'Synthetic person', amount, settled: false }];
      const result = readyReview([
        ...history(),
        ...history(100, [50, 50, 50], 'insurance'),
        invalid,
      ]);
      expect(unavailableCategory(result).reason).toBe('invalid-record');
      expect(
        result.suggestions.map(function category(item) {
          return item.category;
        })
      ).toEqual(['insurance']);
    }
  );

  it('rejects unsafe summed totals and does not overflow the twice-median comparison', () => {
    // Safe cents; twice its cent value is unsafe.
    const huge = 45035996273705;
    const rows = history(huge, [50, 50, 50]);
    rows.push(expense(SELECTED_MONTH, huge, 'groceries', 'huge-2'));
    rows.push(expense(SELECTED_MONTH, huge, 'groceries', 'huge-3'));
    expect(unavailableCategory(readyReview(rows)).reason).toBe('unsafe-total');
    const safeLarge = readyReview(history(huge, [huge, huge, huge]));
    expect(
      Number.isSafeInteger(comparableCategory(safeLarge).selectedTotalCents)
    ).toBe(true);
    expect(safeLarge.suggestions).toEqual([]);
  });

  it('includes insurance, ranks excess then fixed category order, and returns all source records deterministically', () => {
    const rows = [
      ...history(100, [50, 50, 50], 'groceries'),
      ...history(100, [50, 50, 50], 'bills'),
      ...history(150, [50, 50, 50], 'insurance'),
    ];
    rows.push(expense(SELECTED_MONTH, 0.01, 'insurance', 'source-2'));
    rows.push({
      ...expense(SELECTED_MONTH, 0.01, 'insurance', 'source-1'),
      date: '2026-09-01',
    });
    const original = JSON.stringify(rows);
    const first = readyReview(rows);
    expect(
      first.suggestions.map(function category(item) {
        return item.category;
      })
    ).toEqual(['insurance', 'bills', 'groceries']);
    expect(
      first.suggestions[0].sources.map(function id(item) {
        return item.id;
      })
    ).toEqual([
      'insurance-2026-09-source-1',
      'insurance-2026-09-',
      'insurance-2026-09-source-2',
    ]);
    expect(readyReview([...rows].reverse())).toEqual(first);
    expect(JSON.stringify(rows)).toBe(original);
  });

  it('uses the recorded timestamp prefix without shifting an offset timestamp across months', () => {
    const rows = history();
    rows[3].date = '2026-09-01T00:15:00+14:00';
    const result = readyReview(rows);
    expect(result.suggestions[0].sources[0].date).toBe('2026-09-01');
    expect(result.suggestions[0].selectedTotalCents).toBe(10000);
  });

  it('handles year rollover and valid leap days without reading the host clock', () => {
    const rows = ['2025-10', '2025-11', '2025-12', '2026-01'].map(
      function rolloverExpense(month, index) {
        return expense(month, index === 3 ? 100 : 50);
      }
    );
    const result = buildExpenseAnomalyReview(rows, '2026-01', '2026-02');
    expect(result).toMatchObject({
      status: 'ready',
      baselineMonths: ['2025-10', '2025-11', '2025-12'],
    });
    const leap = expense('2024-02', 1);
    leap.date = '2024-02-29';
    expect(buildExpenseAnomalyReview([leap], '2024-02', '2024-03').status).toBe(
      'ready'
    );
    leap.date = '2023-02-29';
    expect(
      buildExpenseAnomalyReview([leap], '2024-02', '2024-03')
    ).toMatchObject({ reason: 'invalid-date' });
  });

  it.each(['2026-00', '2026-13', '2026-9', 'invalid', '0000-01'])(
    'rejects invalid or unrepresentable review window %s',
    (month) => {
      expect(buildExpenseAnomalyReview([], month, CURRENT_MONTH)).toMatchObject(
        { status: 'unavailable', reason: 'invalid-month' }
      );
    }
  );

  it.each(['2026-10', '2026-11'])(
    'does not compare current or future month %s',
    (month) => {
      expect(buildExpenseAnomalyReview([], month, CURRENT_MONTH)).toMatchObject(
        { status: 'unavailable', reason: 'month-not-elapsed' }
      );
    }
  );

  it('rejects invalid current-month context and malformed dates even outside the apparent window', () => {
    expect(
      buildExpenseAnomalyReview(history(), SELECTED_MONTH, 'invalid')
    ).toMatchObject({ reason: 'invalid-month' });
    const row = expense('2025-01', 1);
    row.date = '2025-02-30';
    expect(
      buildExpenseAnomalyReview(
        [...history(), row],
        SELECTED_MONTH,
        CURRENT_MONTH
      )
    ).toMatchObject({ reason: 'invalid-date' });
    row.date = 'not-a-date';
    expect(
      buildExpenseAnomalyReview(
        [...history(), row],
        SELECTED_MONTH,
        CURRENT_MONTH
      )
    ).toMatchObject({ reason: 'invalid-date' });
  });

  it('ignores validly dated out-of-window financial values but fails unknown metadata inside the window', () => {
    const result = readyReview([...history(), expense('2025-01', Number.NaN)]);
    expect(result.suggestions).toHaveLength(1);
    const unknown = {
      ...expense(SELECTED_MONTH, 1),
      type: 'unknown-category',
    } as unknown as ExpenseData;
    expect(
      buildExpenseAnomalyReview(
        [...history(), unknown],
        SELECTED_MONTH,
        CURRENT_MONTH
      )
    ).toMatchObject({ reason: 'invalid-metadata' });
    const invalidSplitType = {
      ...expense(SELECTED_MONTH, 1),
      splitType: 'unknown-split',
    } as unknown as ExpenseData;
    expect(
      buildExpenseAnomalyReview(
        [...history(), invalidSplitType],
        SELECTED_MONTH,
        CURRENT_MONTH
      )
    ).toMatchObject({ reason: 'invalid-metadata' });
  });

  it('rejects duplicate window identities and prioritizes malformed-date failures independently of row order', () => {
    const rows = history();
    expect(
      buildExpenseAnomalyReview(
        [...rows, rows[3]],
        SELECTED_MONTH,
        CURRENT_MONTH
      )
    ).toMatchObject({ reason: 'duplicate-id' });
    const badDate = { ...expense('2025-01', 1), date: 'broken' };
    const unknown = {
      ...expense(SELECTED_MONTH, 1),
      type: 'unknown-category',
    } as unknown as ExpenseData;
    const mixed = [...rows, rows[3], unknown, badDate];
    expect(
      buildExpenseAnomalyReview(mixed, SELECTED_MONTH, CURRENT_MONTH)
    ).toEqual(
      buildExpenseAnomalyReview(
        [...mixed].reverse(),
        SELECTED_MONTH,
        CURRENT_MONTH
      )
    );
    expect(
      buildExpenseAnomalyReview(mixed, SELECTED_MONTH, CURRENT_MONTH)
    ).toMatchObject({ reason: 'invalid-date' });
  });
});
