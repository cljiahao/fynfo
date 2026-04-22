import { z } from 'zod';
import { EXPENSE_TYPES } from './constants';

export const expenseSplitSchema = z.object({
  person: z.string().min(1),
  amount: z.number().min(0),
  settled: z.boolean(),
});

export const expenseDataSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  type: z.enum(EXPENSE_TYPES as [string, ...string[]]),
  item: z.string(),
  info: z.string(),
  amount: z.number().positive(),
  splitType: z.enum(['self', 'shared']),
  splits: z.array(expenseSplitSchema),
});
