import {
  salaryGlance,
  shiftMonth,
  snapshotGlance,
  spendingGlance,
  topCategories,
} from '@/features/overview/lib/glance';
import { expect, it } from 'vitest';
import { salaryRow } from '../../helpers/salary-fixture';

const sum = (entries: { amount: number }[]) =>
  entries.reduce((total, entry) => total + entry.amount, 0);

it('shifts months across year boundaries', () => {
  expect(shiftMonth('2026-02', -12)).toBe('2025-02');
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
});

it('ranks categories by combined amount and drops non-positive ones', () => {
  expect(
    topCategories(
      [
        { category: 'savings', account: 'a', amount: 100 },
        { category: 'stocks', account: 'b', amount: 300 },
        { category: 'savings', account: 'c', amount: 250 },
        { category: 'crypto', account: 'd', amount: 0 },
      ],
      2
    )
  ).toEqual([
    { key: 'savings', amount: 350 },
    { key: 'stocks', amount: 300 },
  ]);
});

it('compares the latest snapshot with the one before it regardless of order', () => {
  const result = snapshotGlance(
    [
      {
        id: '2026-10',
        entries: [{ category: 'savings', account: 'a', amount: 150 }],
      },
      {
        id: '2026-09',
        entries: [{ category: 'savings', account: 'a', amount: 100 }],
      },
    ],
    sum
  );
  expect(result?.latest.id).toBe('2026-10');
  expect(result?.change).toBe(50);
  expect(
    snapshotGlance([{ id: '2026-10', entries: [] }], sum)?.change
  ).toBeNull();
  expect(snapshotGlance([], sum)).toBeUndefined();
});

it('derives year change, last raise and bonus from salary history', () => {
  const result = salaryGlance([
    salaryRow('2025-10', 4000, 0),
    salaryRow('2026-04', 4400, 1000),
    salaryRow('2026-10', 4400, 0),
  ]);
  expect(result?.yearPct).toBeCloseTo(10);
  expect(result?.lastRaise?.month).toBe('2026-04');
  expect(result?.lastRaise?.pct).toBeCloseTo(10);
  expect(result?.sinceMonth).toBe('2026-04');
  expect(result?.latestBonus).toEqual({ amount: 1000, month: '2026-04' });
});

it('has no year change without a record a year back', () => {
  const result = salaryGlance([salaryRow('2026-10', 4000, 0)]);
  expect(result?.yearPct).toBeNull();
  expect(result?.lastRaise).toBeNull();
  expect(result?.sinceMonth).toBe('2026-10');
});

it('averages the previous months, using personal shares and top categories', () => {
  const base = { item: 'x', info: '', splitType: 'self' as const, splits: [] };
  const result = spendingGlance(
    [
      { ...base, id: '1', date: '2026-08-01', amount: 200, type: 'groceries' },
      { ...base, id: '2', date: '2026-09-01', amount: 400, type: 'groceries' },
      {
        ...base,
        id: '3',
        date: '2026-10-03',
        amount: 100,
        type: 'shopping',
        splitType: 'shared' as const,
        splits: [{ person: 'P', amount: 40, settled: false }],
      },
      { ...base, id: '4', date: '2026-10-05', amount: 30, type: 'groceries' },
      {
        ...base,
        id: '5',
        date: '2026-10-09',
        amount: 500,
        type: 'insurance',
      },
    ],
    '2026-10'
  );
  expect(result.total).toBe(90);
  expect(result.average).toBe(300);
  expect(result.categories).toEqual([
    { key: 'shopping', amount: 60 },
    { key: 'groceries', amount: 30 },
  ]);
  expect(result.lastExpenseDate).toBe('2026-10-05');
});

it('reports no average without earlier months', () => {
  expect(spendingGlance([], '2026-10').average).toBeNull();
});

it('counts gap months as zero and caps the span at 12 months', () => {
  const base = { item: 'x', info: '', splitType: 'self' as const, splits: [] };
  const gap = spendingGlance(
    [
      { ...base, id: '1', date: '2026-06-01', amount: 300, type: 'other' },
      { ...base, id: '2', date: '2026-09-01', amount: 300, type: 'other' },
    ],
    '2026-10'
  );
  expect(gap.average).toBe(150);
  const old = spendingGlance(
    [
      { ...base, id: '1', date: '2024-01-01', amount: 9999, type: 'other' },
      { ...base, id: '2', date: '2026-09-01', amount: 1200, type: 'other' },
    ],
    '2026-10'
  );
  expect(old.average).toBe(100);
});

it('shifts a year back across the boundary', () => {
  expect(shiftMonth('2026-01', -12)).toBe('2025-01');
});
