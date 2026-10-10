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

// Spec103 bounds apply only to saved snapshots, not the live planner contract.
export const scenarioInputsSchema = z.strictObject({
  salary: z.number().min(0).max(1e9),
  expenses: z.number().min(0).max(1e9),
  emergencyMonths: z.number().min(0).max(120),
  warChestMonths: z.number().min(0).max(120),
  titheEnabled: z.boolean(),
  tithePctInput: z.number().min(0).max(100),
  allowanceEnabled: z.boolean(),
  allowancePctInput: z.number().min(0).max(100),
  currentSavings: z.number().min(-1e9).max(1e9),
  currentBonds: z.number().min(-1e9).max(1e9),
});

export const scenarioPayloadSchema = z.strictObject({
  schemaVersion: z.literal(1),
  name: z.string().trim().min(1).max(80),
  model: z.literal('allocation-flat-cpf-v1'),
  currency: z.literal('SGD'),
  capturedAt: z.iso.datetime(),
  sourceSnapshotMonth: YYYY_MM.optional(),
  inputs: scenarioInputsSchema,
});

export const scenarioRevisionSchema = z
  .string()
  .regex(/^[1-9]\d{0,18}$/)
  .refine(
    (value) =>
      /^[1-9]\d{0,18}$/.test(value) &&
      BigInt(value) <= BigInt('9223372036854775807')
  );
export const scenarioIdentitySchema = z.strictObject({
  id: z.uuid(),
  revision: scenarioRevisionSchema,
});
export const createScenarioSchema = z.strictObject({
  creationRequestId: z.uuid(),
  payload: scenarioPayloadSchema,
});
export const updateScenarioSchema = scenarioIdentitySchema.extend({
  payload: scenarioPayloadSchema,
});
