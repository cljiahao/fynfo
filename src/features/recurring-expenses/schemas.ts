import { EXPENSE_TYPE_LABELS, type ExpenseType } from '@/features/expenses';
import { z } from 'zod';
import { RECURRING_LIMITS } from './constants';
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const text = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => value.trim().length > 0);
const category = z.custom<ExpenseType>(
  (value) =>
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(EXPENSE_TYPE_LABELS, value)
);
export const recurringExpenseSchema = z.strictObject({
  id: z.uuid(),
  date: z.iso.date(),
  category,
  item: text(RECURRING_LIMITS.item),
  info: z.string().max(RECURRING_LIMITS.notes),
  cents: z.number().int().positive().max(RECURRING_LIMITS.cents),
});
export const recurringDefinitionSchema = z
  .strictObject({
    id: z.uuid(),
    name: text(RECURRING_LIMITS.name),
    enabled: z.boolean(),
    preferredDay: z.number().int().min(1).max(31),
    startMonth: month,
    endMonth: month.nullable(),
    cents: z.number().int().positive().max(RECURRING_LIMITS.cents),
    category,
    item: text(RECURRING_LIMITS.item),
    info: z.string().max(RECURRING_LIMITS.notes),
  })
  .refine(
    (value) => value.endMonth === null || value.endMonth >= value.startMonth
  );
const receiptBase = { month, requestId: z.uuid() };
export const recurringReceiptSchema = z.discriminatedUnion('outcome', [
  z.strictObject({
    ...receiptBase,
    outcome: z.literal('confirmed'),
    expense: recurringExpenseSchema,
  }),
  z.strictObject({
    ...receiptBase,
    outcome: z.literal('skipped'),
    expense: z.null(),
  }),
]);
export const recurringTemplateSchema = z
  .strictObject({
    definition: recurringDefinitionSchema,
    archived: z.boolean(),
    occurrences: z.array(recurringReceiptSchema).max(RECURRING_LIMITS.receipts),
  })
  .refine(
    (template) =>
      new Set(template.occurrences.map((entry) => entry.month)).size ===
      template.occurrences.length
  );
export const recurringTemplatesSchema = z
  .array(recurringTemplateSchema)
  .max(RECURRING_LIMITS.templates)
  .refine(
    (templates) =>
      new Set(templates.map((entry) => entry.definition.id)).size ===
      templates.length
  )
  .refine(
    (templates) =>
      templates.reduce((sum, entry) => sum + entry.occurrences.length, 0) <=
      RECURRING_LIMITS.receipts
  )
  .refine((templates) => {
    const receipts = templates.flatMap((entry) => entry.occurrences);
    const expenseIds = receipts.flatMap((receipt) =>
      receipt.expense ? [receipt.expense.id] : []
    );
    return (
      new Set(receipts.map((entry) => entry.requestId)).size ===
        receipts.length && new Set(expenseIds).size === expenseIds.length
    );
  });
export const recurringPayloadSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    requestId: z.uuid(),
    templates: recurringTemplatesSchema,
  })
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).length <=
      RECURRING_LIMITS.plaintextBytes
  );
export const recurringCommandSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('create'),
    definition: recurringDefinitionSchema,
  }),
  z.strictObject({
    kind: z.literal('edit'),
    definition: recurringDefinitionSchema,
  }),
  z.strictObject({ kind: z.literal('archive'), templateId: z.uuid() }),
  z.strictObject({
    kind: z.literal('confirm'),
    templateId: z.uuid(),
    month,
    expense: recurringExpenseSchema,
  }),
  z.strictObject({ kind: z.literal('skip'), templateId: z.uuid(), month }),
]);
export const recurringRevisionSchema = z
  .string()
  .regex(/^(0|[1-9]\d{0,18})$/)
  .refine((value) => value.length < 19 || value < '9223372036854775807');
export const recurringMutationSchema = z.strictObject({
  bookId: z.uuid(),
  expectedRevision: recurringRevisionSchema,
  requestId: z.uuid(),
  command: recurringCommandSchema,
});
