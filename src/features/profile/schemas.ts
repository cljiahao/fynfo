import { z } from 'zod';

export const profileSchema = z.object({
  birthYear: z
    .number()
    .int()
    .min(1940)
    .max(new Date().getFullYear())
    .nullable(),
  isNsman: z.boolean(),
  residencyStatus: z.enum(['resident', 'non_resident']),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
