import type { ExpenseData, ExpenseSplitData } from '../types';

export function generateId(): string {
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
