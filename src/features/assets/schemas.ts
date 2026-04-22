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

const importEntrySchema = z
  .object({
    category: z.enum(CATEGORIES as [AssetCategory, ...AssetCategory[]]),
    account: z.string().optional().default(''),
    note: z.string().optional(),
    amount: z.number().min(0),
  })
  .transform((e) => ({
    category: e.category,
    account: e.account || e.note || '',
    amount: e.amount,
  }));

export const plannerSettingsSchema = z.object({
  emergencyMonths: z.number().min(0),
  warChestMonths: z.number().min(0),
  titheEnabled: z.boolean(),
  tithePct: z.number().min(0).max(100),
  allowanceEnabled: z.boolean(),
  allowancePct: z.number().min(0).max(100),
});

export const importDataSchema = z.object({
  version: z.number().optional(),
  exportedAt: z.string().optional(),
  snapshots: z.array(
    z.object({
      id: YYYY_MM,
      entries: z.array(importEntrySchema),
    })
  ),
});
