import {
  importedExpenseSchema,
  type ExpenseData,
  type ImportedExpenseInput,
} from '@/features/expenses';
import type {
  StatementBank,
  StatementCandidate,
  StatementPeriod,
} from '../types';
import { getStatementReview } from './statement-parser';

const DUPLICATE_ISSUE = 'Possible duplicate: compare the source rows.';
export function createImportInput(
  row: StatementCandidate,
  bank: StatementBank,
  period: StatementPeriod,
  id: string
): ImportedExpenseInput | null {
  const review = getStatementReview(
    { ...row, issues: row.issues.filter((issue) => issue !== DUPLICATE_ISSUE) },
    period
  );
  if (review.status !== 'candidate') return null;
  const parsed = importedExpenseSchema.safeParse({
    id,
    date: row.date,
    type: row.category,
    description: row.description,
    cents: Math.round(Number(row.amount.replaceAll(',', '')) * 100),
    bank,
    period,
    source: row.source,
    suggestedClassification: row.suggestedClassification,
    classification: row.classification,
  });
  return parsed.success ? parsed.data : null;
}

function samePurchase(
  a: { date: string; cents: number; description: string },
  b: { date: string; cents: number; description: string }
): boolean {
  const normalize = (value: string) =>
    value.trim().replace(/\s+/g, ' ').toLowerCase();
  return (
    a.date.slice(0, 10) === b.date.slice(0, 10) &&
    a.cents === b.cents &&
    normalize(a.description) === normalize(b.description)
  );
}

export function possibleImportDuplicates(
  inputs: ImportedExpenseInput[],
  saved: ExpenseData[]
): Set<string> {
  return new Set(
    inputs
      .filter(
        (input, index) =>
          inputs.some(
            (other, otherIndex) =>
              index !== otherIndex && samePurchase(input, other)
          ) ||
          saved.some((other) =>
            samePurchase(input, {
              date: other.date,
              cents: Math.round(other.amount * 100),
              description: other.item,
            })
          )
      )
      .map((input) => input.id)
  );
}

export function hasSourceDuplicate(row: StatementCandidate): boolean {
  return row.issues.includes(DUPLICATE_ISSUE);
}
