import { RECORD_ID } from '@/lib/zod-utils';
import { z } from 'zod';
import { EXPENSE_TYPES } from './constants';
import { getSplitAllocationError } from './lib/split-amounts';

const CALENDAR_DATE = z.iso.date();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

export const expenseSplitSchema = z.object({
  person: z.string().min(1),
  amount: z.number().min(0).finite(),
  settled: z.boolean(),
});

export const expenseRangeSchema = z
  .strictObject({ from: CALENDAR_DATE, to: CALENDAR_DATE })
  .refine(({ from, to }) => from <= to, 'from must not be after to');

export const MAX_SETTLE_EXPENSE_IDS = 2000;

export const settleSplitSchema = z.object({
  expenseIds: z.array(RECORD_ID).min(1).max(MAX_SETTLE_EXPENSE_IDS),
  person: expenseSplitSchema.shape.person,
  settled: z.boolean(),
});

export const expenseDataSchema = z
  .object({
    id: z.string().min(1),
    date: z
      .string()
      .regex(ISO_DATE, 'date must be ISO-8601 (YYYY-MM-DD or full timestamp)')
      .refine(
        (s) =>
          CALENDAR_DATE.safeParse(s.slice(0, 10)).success &&
          !Number.isNaN(Date.parse(s)),
        'date is not a valid calendar date'
      ),
    type: z.enum(EXPENSE_TYPES as [string, ...string[]]),
    item: z.string(),
    info: z.string(),
    amount: z.number().positive().finite(),
    splitType: z.enum(['self', 'shared']),
    splits: z.array(expenseSplitSchema),
  })
  .refine(
    (expense) =>
      expense.splitType !== 'shared' ||
      getSplitAllocationError(expense.amount, expense.splits) === null,
    { message: 'Invalid expense split allocation', path: ['splits'] }
  );
