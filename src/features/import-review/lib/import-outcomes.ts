import {
  importedExpenseValues,
  type ExpenseData,
  type ImportedExpenseInput,
  type ImportExpenseOutcome,
} from '@/features/expenses';

export function checkImportOutcome(
  input: ImportedExpenseInput,
  saved: ExpenseData[]
): ImportExpenseOutcome['status'] {
  const row = saved.find((value) => value.id === input.id);
  if (!row) return 'unconfirmed';
  const expected = importedExpenseValues(input);
  return row.date.slice(0, 10) === expected.date &&
    row.type === expected.type &&
    row.item === expected.item &&
    row.info === expected.info &&
    row.amount === expected.amount &&
    row.splitType === 'self' &&
    row.splits.length === 0
    ? 'confirmed'
    : 'conflict';
}
