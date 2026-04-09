import { z } from 'zod';
import { CATEGORIES } from './constants';

export const assetEntrySchema = z.object({
  category: z.enum(CATEGORIES as [string, ...string[]]),
  account: z.string(),
  amount: z.number().min(0, 'Amount must be positive'),
});

export const snapshotFormSchema = z.object({
  id: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Must be YYYY-MM format'),
  entries: z.array(assetEntrySchema),
});

export type SnapshotFormValues = z.infer<typeof snapshotFormSchema>;

const importEntrySchema = z
  .object({
    category: z.enum(CATEGORIES as [string, ...string[]]),
    account: z.string().optional().default(''),
    note: z.string().optional(),
    amount: z.number().min(0),
  })
  .transform((e) => ({
    category: e.category,
    account: e.account || e.note || '',
    amount: e.amount,
  }));

export const importDataSchema = z.object({
  version: z.number().optional(),
  exportedAt: z.string().optional(),
  snapshots: z.array(
    z.object({
      id: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      entries: z.array(importEntrySchema),
    })
  ),
});
