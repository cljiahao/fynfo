import { z } from 'zod';
import { EXPENSE_TYPES } from '../constants';
import type { ExpenseData, ExpenseSplitData } from '../types';
import { getSplitAllocationError } from './split-amounts';

const kindSchema = z.enum([
  'expense',
  'refund',
  'transfer',
  'card_repayment',
  'other_credit',
  'unknown',
]);
const importedExpenseBaseSchema = z.strictObject({
  id: z.uuid(),
  date: z.iso.date(),
  type: z.enum(EXPENSE_TYPES),
  description: z
    .string()
    .min(1)
    .max(4096)
    .refine((value) => value.trim().length > 0),
  cents: z.number().int().positive().max(1_000_000_000_000),
  note: z.string().max(1024).optional(),
  splits: z
    .array(
      z.strictObject({
        person: z
          .string()
          .max(256)
          .refine((value) => value.trim().length > 0),
        amount: z.number().min(0).finite(),
        settled: z.boolean(),
      })
    )
    .max(50)
    .optional(),
  bank: z.enum(['uob', 'dbs', 'hsbc', 'citibank']),
  period: z.strictObject({ from: z.iso.date(), to: z.iso.date() }),
  suggestedClassification: kindSchema,
  classification: z.literal('expense'),
  source: z
    .array(
      z.strictObject({
        page: z.number().int().min(1).max(100),
        line: z.number().int().positive(),
        text: z.string().min(1).max(4096),
      })
    )
    .min(1)
    .max(32),
});

export type ImportedExpenseInput = z.infer<typeof importedExpenseBaseSchema>;
export const importedExpenseSchema = importedExpenseBaseSchema
  .refine((value) => {
    const span = Date.parse(value.period.to) - Date.parse(value.period.from);
    return (
      span >= 0 &&
      span <= 400 * 86_400_000 &&
      value.date >= value.period.from &&
      value.date <= value.period.to
    );
  }, 'Invalid statement date range')
  .refine(
    (value) =>
      !value.splits?.length ||
      (getSplitAllocationError(value.cents / 100, value.splits) === null &&
        new Set(value.splits.map((split) => split.person.trim())).size ===
          value.splits.length),
    'Invalid split'
  )
  .refine(
    (value) =>
      new TextEncoder().encode(buildImportNote(value)).length <= 16 * 1024,
    'Source note exceeds supported size'
  )
  .refine((value) => {
    const source = value.source.map((line) => line.text).join(' ');
    const amounts =
      source.match(
        /(?:SGD|S\$|USD|US\$|\$)?\s*[+-]?\(?\d[\d,.]*\.\d+\)?(?:\s*(?:CR|DR))?/gi
      ) ?? [];
    return (
      !/\b(?:REFUND|CR|CREDIT|DIVIDEND|REVERSAL|REVERSED|TOTAL|BALANCE|SUMMARY)\b/i.test(
        source
      ) &&
      amounts.length > 0 &&
      !amounts.some((amount) => /[-()]/.test(amount))
    );
  }, 'The source cannot be recorded as positive spending');

export type ImportExpenseOutcome = {
  id: string;
  status: 'confirmed' | 'not_saved' | 'unconfirmed' | 'conflict';
  reason?: 'access' | 'rejected';
};

export function buildImportNote(value: ImportedExpenseInput): string {
  return [
    `Statement source: ${value.bank.toUpperCase()} · ${value.period.from} to ${value.period.to}`,
    `Suggested classification: ${value.suggestedClassification}; reviewed: ${value.classification}`,
    ...value.source.map(
      (line) => `Page ${line.page}, line ${line.line}: ${line.text}`
    ),
  ].join('\n');
}

export function importedExpenseValues(
  value: ImportedExpenseInput
): ExpenseData {
  return {
    id: value.id,
    date: value.date,
    type: value.type,
    item: value.description,
    info: value.note?.trim() ?? '',
    amount: value.cents / 100,
    splitType: value.splits?.length ? 'shared' : 'self',
    splits: (value.splits ?? []).map((split) => ({
      ...split,
      person: split.person.trim(),
    })),
  };
}

export function sameImportedValues(saved: ExpenseData, expected: ExpenseData) {
  return (
    saved.id === expected.id &&
    saved.date.slice(0, 10) === expected.date.slice(0, 10) &&
    saved.type === expected.type &&
    saved.item === expected.item &&
    saved.info === expected.info &&
    saved.amount === expected.amount &&
    saved.splitType === expected.splitType &&
    sameSplits(saved.splits, expected.splits)
  );
}

/** Saved splits come back in storage order, so compare them by person. */
export function sameSplits(a: ExpenseSplitData[], b: ExpenseSplitData[]) {
  const key = (splits: ExpenseSplitData[]) =>
    JSON.stringify(
      [...splits]
        .sort((x, y) => x.person.localeCompare(y.person))
        .map(({ person, amount, settled }) => [person, amount, settled])
    );
  return a.length === b.length && key(a) === key(b);
}
