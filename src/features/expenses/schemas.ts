import { z } from 'zod';
import { EXPENSE_TYPES } from './constants';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

export const expenseSplitSchema = z.object({
  person: z.string().min(1),
  amount: z.number().min(0).finite(),
  settled: z.boolean(),
});

export const expenseDataSchema = z.object({
  id: z.string().min(1),
  date: z
    .string()
    .regex(ISO_DATE, 'date must be ISO-8601 (YYYY-MM-DD or full timestamp)')
    .refine(
      (s) => !Number.isNaN(Date.parse(s)),
      'date is not a valid calendar date'
    ),
  type: z.enum(EXPENSE_TYPES as [string, ...string[]]),
  item: z.string(),
  info: z.string(),
  amount: z.number().positive().finite(),
  splitType: z.enum(['self', 'shared']),
  splits: z.array(expenseSplitSchema),
});
