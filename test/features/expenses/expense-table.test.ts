import {
  filterExpenses,
  sortExpenses,
} from '@/features/expenses/lib/expense-table';
import type { ExpenseData } from '@/features/expenses/types';
import { describe, expect, it } from 'vitest';

const row = (over: Partial<ExpenseData>): ExpenseData => ({
  id: over.id ?? 'x',
  date: '2026-06-01',
  type: 'food_drink',
  item: 'Lunch',
  info: '',
  amount: 10,
  splitType: 'self',
  splits: [],
  ...over,
});

const noFilter = { searchQuery: '', typeFilter: 'all', splitFilter: 'all' };

describe('filterExpenses', () => {
  const list = [
    row({ id: 'a', type: 'food_drink', item: 'Sushi', splitType: 'shared' }),
    row({ id: 'b', type: 'transport', item: 'Grab', info: 'airport' }),
  ];

  it('returns all rows with no active filters', () => {
    expect(filterExpenses(list, noFilter)).toHaveLength(2);
  });

  it('filters by type and by split', () => {
    expect(
      filterExpenses(list, { ...noFilter, typeFilter: 'transport' }).map(
        (e) => e.id
      )
    ).toEqual(['b']);
    expect(
      filterExpenses(list, { ...noFilter, splitFilter: 'shared' }).map(
        (e) => e.id
      )
    ).toEqual(['a']);
  });

  it('searches item, info, and the type label, case-insensitively', () => {
    expect(
      filterExpenses(list, { ...noFilter, searchQuery: 'SUSHI' }).map(
        (e) => e.id
      )
    ).toEqual(['a']);
    expect(
      filterExpenses(list, { ...noFilter, searchQuery: 'airport' }).map(
        (e) => e.id
      )
    ).toEqual(['b']);
  });
});

describe('sortExpenses', () => {
  const list = [
    row({ id: 'a', amount: 30, item: 'Beta' }),
    row({ id: 'b', amount: 10, item: 'Alpha' }),
    row({ id: 'c', amount: 20, item: 'Gamma' }),
  ];

  it('sorts by amount ascending and descending without mutating input', () => {
    const asc = sortExpenses(list, 'amount', 'asc').map((e) => e.id);
    const desc = sortExpenses(list, 'amount', 'desc').map((e) => e.id);
    expect(asc).toEqual(['b', 'c', 'a']);
    expect(desc).toEqual(['a', 'c', 'b']);
    expect(list.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by item label', () => {
    expect(sortExpenses(list, 'item', 'asc').map((e) => e.item)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ]);
  });
});
