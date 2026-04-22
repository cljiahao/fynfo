import { YYYY_MM } from '@/lib/zod-utils';
import { z } from 'zod';

export const salaryDataSchema = z.object({
  id: YYYY_MM,
  salary: z.number().min(0),
  bonus: z.number().min(0),
});

export const taxReliefDataSchema = z.object({
  reliefKey: z.string().min(1),
  amount: z.number().min(0),
});
