import { z } from 'zod';

export const createHouseholdSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const acceptInviteSchema = z.object({
  // base64url secret minted by generateInviteSecret (32 bytes -> 43 chars).
  secret: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/, 'invalid invite code'),
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

export const createGoalSchema = z.object({
  name: z.string().trim().min(1).max(80),
  targetAmount: z.number().positive().finite(),
  targetDate: z.string().regex(ISO_DATE, 'date must be ISO-8601').optional(),
});

export const addContributionSchema = z.object({
  goalId: z.string().uuid(),
  amount: z.number().positive().finite(),
  note: z.string().trim().max(200).optional(),
  date: z.string().regex(ISO_DATE, 'date must be ISO-8601'),
});

export const addGoalItemSchema = z.object({
  goalId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  budget: z.number().positive().finite(),
});

export const addItemPaymentSchema = z.object({
  itemId: z.string().uuid(),
  amount: z.number().positive().finite(),
  note: z.string().trim().max(200).optional(),
  date: z.string().regex(ISO_DATE, 'date must be ISO-8601'),
});

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const createSpaceSchema = z
  .object({
    kind: z.enum(['ongoing', 'trip']),
    name: z.string().trim().min(1).max(80),
    startDate: z.string().regex(ISO_DAY).optional(),
    endDate: z.string().regex(ISO_DAY).optional(),
  })
  .refine(
    (space) =>
      !space.startDate || !space.endDate || space.startDate <= space.endDate,
    { message: 'end date must not be before start date', path: ['endDate'] }
  );

export const addSpendingSchema = z.object({
  spaceId: z.string().uuid(),
  date: z.string().regex(ISO_DAY, 'date must be YYYY-MM-DD'),
  category: z.string().trim().min(1).max(40),
  amount: z.number().positive().finite(),
  note: z.string().trim().max(200).optional(),
});

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type AddContributionInput = z.infer<typeof addContributionSchema>;
export type AddGoalItemInput = z.infer<typeof addGoalItemSchema>;
export type AddItemPaymentInput = z.infer<typeof addItemPaymentSchema>;
export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;
export type AddSpendingInput = z.infer<typeof addSpendingSchema>;
