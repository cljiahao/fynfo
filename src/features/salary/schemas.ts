import { z } from 'zod';

export const salaryDataSchema = z.object({
  id: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Must be YYYY-MM format'),
  salary: z.number().min(0),
  bonus: z.number().min(0),
});

export const taxReliefDataSchema = z.object({
  reliefKey: z.string().min(1),
  amount: z.number().min(0),
});
