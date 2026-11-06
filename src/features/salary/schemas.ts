import { YYYY_MM } from '@/lib/zod-utils';
import { z } from 'zod';

/** Legacy per-month shape, still used to validate older export files. */
export const salaryDataSchema = z.object({
  id: YYYY_MM,
  salary: z.number().min(0),
  bonus: z.number().min(0),
});

export const MAX_INCOME_LINES = 20;
export const MAX_INCOME_LABEL = 60;
const MAX_INCOME_AMOUNT = 1e9;

export const incomeLineSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(['salary', 'bonus', 'one_time']),
  label: z.string().trim().min(1).max(MAX_INCOME_LABEL),
  amount: z.number().finite().positive().max(MAX_INCOME_AMOUNT),
});

export const salaryMonthSchema = z
  .object({
    id: YYYY_MM,
    lines: z.array(incomeLineSchema).min(1).max(MAX_INCOME_LINES),
  })
  .refine(
    (month) => {
      const labels = month.lines
        .filter((line) => line.type === 'salary')
        .map((line) => line.label.trim().toLowerCase());
      return new Set(labels).size === labels.length;
    },
    { message: 'Each employer may have only one salary line per month.' }
  );

export const TAX_YEAR = z.number().int().positive();

export const taxReliefDataSchema = z.object({
  reliefKey: z.string().min(1),
  amount: z.number().min(0),
});

export const taxReliefListSchema = z
  .array(taxReliefDataSchema)
  .refine(
    (reliefs) =>
      new Set(reliefs.map((relief) => relief.reliefKey)).size ===
      reliefs.length,
    { message: 'Each relief may appear only once.' }
  );
