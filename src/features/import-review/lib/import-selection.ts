import {
  importedExpenseSchema,
  type ExpenseData,
  type ImportedExpenseInput,
} from '@/features/expenses';
import type {
  DuplicateMatch,
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
    note: row.note?.trim() || undefined,
    splits: row.splits?.length ? row.splits : undefined,
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

export function savedImportMatches(
  inputs: ImportedExpenseInput[],
  saved: ExpenseData[]
): Map<string, Extract<DuplicateMatch, { kind: 'saved' }>> {
  const matches = new Map<string, Extract<DuplicateMatch, { kind: 'saved' }>>();
  for (const input of inputs) {
    const other = saved.find((record) =>
      samePurchase(input, {
        date: record.date,
        cents: Math.round(record.amount * 100),
        description: record.item,
      })
    );
    if (other)
      matches.set(input.id, {
        kind: 'saved',
        date: other.date.slice(0, 10),
        item: other.item,
        amount: other.amount,
      });
  }
  return matches;
}

/** Pairs each entry with the first other entry for the same purchase. */
export function statementImportMatches(
  entries: Array<{ key: string; input: ImportedExpenseInput }>
): Map<string, string> {
  const partners = new Map<string, string>();
  for (const entry of entries) {
    const other = entries.find(
      (candidate) =>
        candidate.key !== entry.key &&
        samePurchase(entry.input, candidate.input)
    );
    if (other) partners.set(entry.key, other.key);
  }
  return partners;
}
