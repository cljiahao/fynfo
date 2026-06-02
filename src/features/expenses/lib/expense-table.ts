import { EXPENSE_TYPE_LABELS } from '../constants';
import type { ExpenseData } from '../types';

export type SortKey = 'date' | 'type' | 'item' | 'amount' | 'splitType';
export type SortDir = 'asc' | 'desc';

export interface ExpenseFilters {
  searchQuery: string;
  typeFilter: string;
  splitFilter: string;
}

/** Apply the type / split / free-text filters. Search matches item, info, and type label. */
export function filterExpenses(
  expenses: ExpenseData[],
  { searchQuery, typeFilter, splitFilter }: ExpenseFilters
): ExpenseData[] {
  return expenses.filter((e) => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (splitFilter !== 'all' && e.splitType !== splitFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.item.toLowerCase().includes(q) ||
        e.info.toLowerCase().includes(q) ||
        EXPENSE_TYPE_LABELS[e.type].toLowerCase().includes(q)
      );
    }
    return true;
  });
}

/** Stable sort by the given column/direction (does not mutate the input). */
export function sortExpenses(
  list: ExpenseData[],
  sortKey: SortKey,
  sortDir: SortDir
): ExpenseData[] {
  return [...list].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'date':
        cmp = a.date.localeCompare(b.date);
        break;
      case 'type':
        cmp = EXPENSE_TYPE_LABELS[a.type].localeCompare(
          EXPENSE_TYPE_LABELS[b.type]
        );
        break;
      case 'item':
        cmp = a.item.localeCompare(b.item);
        break;
      case 'amount':
        cmp = a.amount - b.amount;
        break;
      case 'splitType':
        cmp = a.splitType.localeCompare(b.splitType);
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });
}
