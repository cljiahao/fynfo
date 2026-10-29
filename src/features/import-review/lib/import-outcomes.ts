import {
  importedExpenseValues,
  sameImportedValues,
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
  return sameImportedValues(row, importedExpenseValues(input))
    ? 'confirmed'
    : 'conflict';
}
