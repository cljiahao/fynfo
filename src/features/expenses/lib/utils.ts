import { EXPENSE_TOTAL_EXCLUDED_TYPES } from '../constants';
import type { ExpenseData, ExpenseSplitData, ExpenseType } from '../types';

/** Whether an expense type counts toward "total expenses" aggregates. */
export function isCountedInExpenseTotals(type: ExpenseType): boolean {
  return !EXPENSE_TOTAL_EXCLUDED_TYPES.includes(type);
}

export function generateId(): string {
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build a fresh "self" (non-split) expense payload with a generated id. Single
 * source of truth for the quick-add / paste submit paths so the shape stays in
 * lock-step.
 */
export function buildSelfExpense(p: {
  date: string;
  type: ExpenseType;
  item: string;
  info: string;
  amount: number;
}): ExpenseData {
  return { id: generateId(), ...p, splitType: 'self', splits: [] };
}

/**
 * Decides what happens when the split modal is confirmed for a row.
 * Returns the next row state and whether it should persist immediately.
 *
 * Existing, valid rows (`!isNew` with a date and a positive amount) persist on
 * confirm so split edits made in the modal are not lost — the modal close does
 * not trigger the row blur-save. New (unsaved) rows only stage the splits
 * locally and still save via the Enter/blur path once date + amount are valid.
 */
export function resolveSplitConfirm(
  data: ExpenseData,
  isNew: boolean,
  splits: ExpenseSplitData[]
): { next: ExpenseData; shouldSave: boolean } {
  const next: ExpenseData = { ...data, splits, id: data.id || generateId() };
  const shouldSave = !isNew && Boolean(next.date) && next.amount > 0;
  return { next, shouldSave };
}

/**
 * Optimistic cache transform for settling splits. Returns a new list with
 * `settled` flipped on every split whose `person` matches, for expenses whose
 * id is in `expenseIds`. Pure — inputs are not mutated. A single id covers the
 * per-row `settleSplit` case; many ids cover the month case.
 */
export function applySplitSettlement(
  list: ExpenseData[],
  expenseIds: readonly string[],
  person: string,
  settled: boolean
): ExpenseData[] {
  const ids = new Set(expenseIds);
  return list.map((expense) => {
    if (!ids.has(expense.id)) return expense;
    return {
      ...expense,
      splits: expense.splits.map((s) =>
        s.person === person ? { ...s, settled } : s
      ),
    };
  });
}
