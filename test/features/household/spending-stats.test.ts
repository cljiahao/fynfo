import {
  categoryOptions,
  monthVsBudget,
  normalizeCategory,
  resolveCategory,
  shiftMonth,
  suggestedBudget,
} from '@/features/household/lib/spending-stats';
import type {
  SharedSpendingEntry,
  SpendingBudget,
} from '@/features/household/types';
import { describe, expect, it } from 'vitest';

let seq = 0;
const entry = (
  date: string,
  category: string,
  amount: number
): SharedSpendingEntry => ({
  id: `e${seq++}`,
  date,
  category,
  amount,
  note: null,
  isSelf: true,
});
const budget = (category: string, monthlyAmount: number): SpendingBudget => ({
  id: `b-${category}`,
  category,
  monthlyAmount,
});

describe('normalizeCategory', () => {
  it('trims and lower-cases so variants share a key', () => {
    expect(normalizeCategory('  Groceries ')).toBe('groceries');
    expect(normalizeCategory('GROCERIES')).toBe(normalizeCategory('groceries'));
  });
});

describe('shiftMonth', () => {
  it('crosses year boundaries both ways', () => {
    expect(shiftMonth('2026-02', -3)).toBe('2025-11');
    expect(shiftMonth('2026-11', 2)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('categoryOptions / resolveCategory', () => {
  const budgets = [budget('Groceries', 300)];
  const entries = [
    entry('2026-10-01', 'groceries ', 10),
    entry('2026-10-02', 'Utilities', 10),
    entry('2026-10-03', 'dining', 10),
    entry('2026-10-04', 'Dining', 10),
  ];

  it('lists budgeted first, then used, deduplicated by normalized key', () => {
    const options = categoryOptions(budgets, entries);
    expect(options.map((o) => o.label)).toEqual([
      'Groceries',
      'Dining',
      'Utilities',
    ]);
    expect(options.map((o) => o.budgeted)).toEqual([true, false, false]);
  });

  it('maps a case or whitespace variant to the existing label', () => {
    const options = categoryOptions(budgets, entries);
    expect(resolveCategory(options, '  GROCERIES')).toBe('Groceries');
    expect(resolveCategory(options, ' Brand new ')).toBe('Brand new');
  });
});

describe('monthVsBudget', () => {
  const month = [
    entry('2026-11-02', 'groceries', 120.1),
    entry('2026-11-03', 'Groceries ', 100.2),
    entry('2026-11-04', 'Fun', 15),
  ];

  it('groups by normalized key, flags over-budget and leaves unbudgeted plain', () => {
    const rows = monthVsBudget(month, [
      budget('Groceries', 200),
      budget('Travel', 500),
    ]);
    expect(rows.map((r) => r.category)).toEqual(['Groceries', 'Travel', 'Fun']);
    const [groceries, travel, fun] = rows;
    expect(groceries.spent).toBeCloseTo(220.3, 2);
    expect(groceries.over).toBe(true);
    expect(travel).toMatchObject({ spent: 0, over: false });
    expect(fun).toMatchObject({ budget: null, over: false, ratio: 0 });
  });

  it('is not over when spend equals the budget', () => {
    const [row] = monthVsBudget(
      [entry('2026-11-01', 'a', 50)],
      [budget('A', 50)]
    );
    expect(row.over).toBe(false);
    expect(row.ratio).toBe(1);
  });
});

describe('suggestedBudget', () => {
  const now = '2026-11';

  it('is the mean of the last 3 full months, zero-filling empty ones', () => {
    const entries = [
      entry('2026-08-10', 'Groceries', 300),
      entry('2026-08-20', 'groceries', 60),
      entry('2026-10-05', 'Groceries', 90),
      entry('2026-11-05', 'Groceries', 9999),
      entry('2026-10-05', 'Other', 9999),
    ];
    expect(suggestedBudget(entries, 'GROCERIES', now)).toBe(150);
  });

  it('is absent with fewer than 3 months of history', () => {
    const entries = [
      entry('2026-09-10', 'Groceries', 300),
      entry('2026-10-10', 'Groceries', 300),
    ];
    expect(suggestedBudget(entries, 'Groceries', now)).toBeNull();
    expect(suggestedBudget(entries, 'Missing', now)).toBeNull();
  });

  it('ignores spend from the current month when history is old enough', () => {
    const entries = [
      entry('2026-08-01', 'Rent', 30),
      entry('2026-11-01', 'Rent', 1000),
    ];
    expect(suggestedBudget(entries, 'Rent', now)).toBe(10);
  });
});
