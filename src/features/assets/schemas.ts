import { YYYY_MM } from '@/lib/zod-utils';
import { z } from 'zod';
import { CATEGORIES } from './constants';
import type { AssetCategory } from './types';

export const assetEntrySchema = z.object({
  category: z.enum(CATEGORIES as [AssetCategory, ...AssetCategory[]]),
  account: z.string(),
  amount: z.number().min(0, 'Amount must be positive'),
});

export const snapshotFormSchema = z.object({
  id: YYYY_MM,
  entries: z.array(assetEntrySchema),
});

export type SnapshotFormValues = z.infer<typeof snapshotFormSchema>;

export const snapshotVersionSchema = z.object({
  snapshotId: z.string().min(1).max(200),
  revision: z
    .string()
    .regex(/^(0|[1-9][0-9]{0,18})$/)
    .refine((value) => value.length < 19 || value <= '9223372036854775807'),
});

export const snapshotEditReadSchema = snapshotVersionSchema.extend({
  id: YYYY_MM,
  entries: z.array(
    z.object({
      category: assetEntrySchema.shape.category,
      account: z.string().nullable(),
      amount: z.string(),
    })
  ),
});

export const plannerSettingsSchema = z.object({
  emergencyMonths: z.number().min(0),
  warChestMonths: z.number().min(0),
  titheEnabled: z.boolean(),
  tithePct: z.number().min(0).max(100),
  allowanceEnabled: z.boolean(),
  allowancePct: z.number().min(0).max(100),
});
