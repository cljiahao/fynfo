import { z } from 'zod';
import { GOAL_ITEM_LIMIT } from './constants';

import { CATEGORY_MAX_LENGTH } from './constants';

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

export const updateGoalSchema = createGoalSchema.extend({ goalId: z.uuid() });

export const addContributionSchema = z.object({
  goalId: z.uuid(),
  amount: z.number().positive().finite(),
  note: z.string().trim().max(200).optional(),
  date: z.string().regex(ISO_DATE, 'date must be ISO-8601'),
});

// The column is a plain DATE, so a time suffix or an impossible day must fail
// at the boundary instead of surfacing as a Postgres error.
const itemDueDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, 'date must be a real calendar date');

export const addGoalItemSchema = z.object({
  goalId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  budget: z.number().positive().finite(),
  dueDate: itemDueDate.nullish(),
});

export const addItemPaymentSchema = z.object({
  itemId: z.uuid(),
  amount: z.number().positive().finite(),
  note: z.string().trim().max(200).optional(),
  date: z.string().regex(ISO_DATE, 'date must be ISO-8601'),
});

export const saveGoalItemSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(80),
  budget: z.number().positive().finite(),
  quote: z.number().positive().finite().nullish(),
  dueDate: itemDueDate.nullish(),
});

export const saveGoalSchema = z
  .object({
    goalId: z.uuid().optional(),
    name: z.string().trim().min(1).max(80),
    target: z.number().positive().finite(),
    targetDate: z.string().regex(ISO_DATE, 'date must be ISO-8601').optional(),
    items: z.array(saveGoalItemSchema).max(GOAL_ITEM_LIMIT),
  })
  .refine(
    ({ items }) => {
      const ids = items.flatMap((item) => (item.id ? [item.id] : []));
      return new Set(ids).size === ids.length;
    },
    { message: 'duplicate item id', path: ['items'] }
  );

export const updateGoalPaymentSchema = z.object({
  paymentId: z.uuid(),
  amount: z.number().positive().finite(),
  note: z.string().trim().max(200).optional(),
  date: z.string().regex(ISO_DATE, 'date must be ISO-8601'),
});

export const updateGoalContributionSchema = z.object({
  contributionId: z.uuid(),
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
  spaceId: z.uuid(),
  date: z.string().regex(ISO_DAY, 'date must be YYYY-MM-DD'),
  category: z.string().trim().min(1).max(40),
  amount: z.number().positive().finite(),
  note: z.string().trim().max(200).optional(),
});

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type AddContributionInput = z.infer<typeof addContributionSchema>;
export type AddGoalItemInput = z.infer<typeof addGoalItemSchema>;
export type AddItemPaymentInput = z.infer<typeof addItemPaymentSchema>;
export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;
export type AddSpendingInput = z.infer<typeof addSpendingSchema>;
export type SaveGoalInput = z.infer<typeof saveGoalSchema>;
export type UpdateGoalPaymentInput = z.infer<typeof updateGoalPaymentSchema>;
export type UpdateGoalContributionInput = z.infer<
  typeof updateGoalContributionSchema
>;

export const setCategoryBudgetSchema = z.object({
  /** Present when editing an existing budget. */
  id: z.uuid().optional(),
  category: z.string().trim().min(1).max(CATEGORY_MAX_LENGTH),
  monthlyAmount: z.number().positive().finite(),
});

export type SetCategoryBudgetInput = z.infer<typeof setCategoryBudgetSchema>;

const PCT = z.number().int().min(0).max(100);
const MAX_GOAL_OVERRIDES = 500;
const MAX_BUDGET_OVERRIDES = 500;

// A split always covers exactly the two household members and totals 100.
const pctMapSchema = z
  .record(z.uuid(), PCT)
  .refine((map) => Object.keys(map).length === 2, {
    message: 'a split covers exactly two members',
  })
  .refine(
    (map) => Object.values(map).reduce((sum, pct) => sum + pct, 0) === 100,
    { message: 'a split must total 100' }
  );

export const plannerSplitSchema = z
  .object({
    members: pctMapSchema,
    goalOverrides: z
      .record(z.uuid(), pctMapSchema)
      .refine((all) => Object.keys(all).length <= MAX_GOAL_OVERRIDES, {
        message: 'too many goal overrides',
      }),
    // Blobs saved before per-budget splits have no key, so it defaults to empty.
    budgetOverrides: z
      .record(z.uuid(), pctMapSchema)
      .refine((all) => Object.keys(all).length <= MAX_BUDGET_OVERRIDES, {
        message: 'too many budget overrides',
      })
      .default({}),
  })
  .refine(
    ({ members, goalOverrides, budgetOverrides }) => {
      const ids = Object.keys(members).sort().join();
      return [
        ...Object.values(goalOverrides),
        ...Object.values(budgetOverrides),
      ].every((map) => Object.keys(map).sort().join() === ids);
    },
    {
      message: 'overrides must cover the same two members',
      path: ['goalOverrides'],
    }
  );

export type PlannerSplitInput = z.infer<typeof plannerSplitSchema>;

// Partial updates: the caller names only the part it edited, so a stale client
// cache can never overwrite what the partner saved meanwhile.
export const plannerSplitUpdateSchema = z.union([
  z.object({ members: pctMapSchema }),
  z.object({ goalId: z.uuid(), override: pctMapSchema.nullable() }),
  z.object({ budgetId: z.uuid(), override: pctMapSchema.nullable() }),
]);

export type PlannerSplitUpdateInput = z.infer<typeof plannerSplitUpdateSchema>;
