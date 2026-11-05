'use server';

import { requireHouseholdContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { AppError, throwIfSupabaseError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { readAllRows } from '@/lib/read-all-rows';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { ROW_UUID } from '@/lib/zod-utils';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { computeGoalProgress } from '../lib/goal-progress';
import { computeItemBudget, computeProjectTotals } from '../lib/project-budget';
import {
  addContributionSchema,
  addGoalItemSchema,
  addItemPaymentSchema,
  createGoalSchema,
  saveGoalSchema,
  updateGoalContributionSchema,
  updateGoalPaymentSchema,
  updateGoalSchema,
} from '../schemas';
import type {
  GoalContribution,
  GoalItem,
  GoalItemPayment,
  HouseholdGoal,
  SaveGoalResult,
} from '../types';

interface GoalRow {
  id: string;
  name: string;
  target_amount: string;
  target_date: string | null;
  created_at: string;
}

interface ContributionRow {
  id: string;
  goal_id: string;
  contributor_user_id: string;
  amount: string;
  note: string | null;
  date: string;
}

interface ItemRow {
  id: string;
  goal_id: string;
  name: string;
  budget: string;
  quote: string | null;
}

interface PaymentRow {
  id: string;
  item_id: string;
  payer_user_id: string;
  amount: string;
  note: string | null;
  date: string;
}

// Bound UUID filters as well as returned rows to keep request URLs manageable.
const ID_CHUNK = 100;

/** Reads, decrypts and groups each goal's budget items and their payments. */
async function readGoalItems(
  context: Awaited<ReturnType<typeof requireHouseholdContext>>,
  goalIds: string[]
): Promise<Map<string, GoalItem[]>> {
  const { userId, kh, supabase } = context;
  const items: ItemRow[] = [];
  for (let offset = 0; offset < goalIds.length; offset += ID_CHUNK) {
    const ids = goalIds.slice(offset, offset + ID_CHUNK);
    items.push(
      ...(await readAllRows<ItemRow>(
        (from, to) =>
          supabase
            .from('household_goal_items')
            .select('id, goal_id, name, budget, quote', { count: 'exact' })
            .in('goal_id', ids)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        'household goal items read'
      ))
    );
  }

  const paymentsByItem = new Map<string, GoalItemPayment[]>();
  const itemIds = items.map((item) => item.id);
  for (let offset = 0; offset < itemIds.length; offset += ID_CHUNK) {
    const ids = itemIds.slice(offset, offset + ID_CHUNK);
    const payments = await readAllRows<PaymentRow>(
      (from, to) =>
        supabase
          .from('household_goal_payments')
          .select('id, item_id, payer_user_id, amount, note, date', {
            count: 'exact',
          })
          .in('item_id', ids)
          .order('date', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
      'household goal payments read'
    );
    for (const p of payments) {
      const list = paymentsByItem.get(p.item_id) ?? [];
      list.push({
        id: p.id,
        amount: Number(decryptPayload(p.amount, kh)),
        note: p.note ? decryptPayload(p.note, kh) : null,
        date: p.date,
        isSelf: p.payer_user_id === userId,
      });
      paymentsByItem.set(p.item_id, list);
    }
  }

  const itemsByGoal = new Map<string, GoalItem[]>();
  for (const row of items) {
    const payments = paymentsByItem.get(row.id) ?? [];
    const budget = Number(decryptPayload(row.budget, kh));
    const list = itemsByGoal.get(row.goal_id) ?? [];
    list.push({
      id: row.id,
      name: decryptPayload(row.name, kh),
      budget,
      quote: row.quote ? Number(decryptPayload(row.quote, kh)) : null,
      payments,
      ...computeItemBudget(
        budget,
        payments.map((payment) => payment.amount)
      ),
    });
    itemsByGoal.set(row.goal_id, list);
  }
  return itemsByGoal;
}

/** Reads the caller's household goals + contributions, decrypts, attaches progress. */
export async function getGoals(): Promise<HouseholdGoal[]> {
  const context = await requireHouseholdContext();
  const { userId, kh, supabase } = context;

  const goals = await readAllRows<GoalRow>(
    (from, to) =>
      supabase
        .from('household_goals')
        .select('id, name, target_amount, target_date, created_at', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to),
    'household goals read'
  );
  if (goals.length === 0) return [];

  const contribByGoal = new Map<string, GoalContribution[]>();
  // Bound UUID filters as well as returned rows to keep request URLs manageable.
  for (let offset = 0; offset < goals.length; offset += 100) {
    const goalIds = goals.slice(offset, offset + 100).map((goal) => goal.id);
    const contributions = await readAllRows<ContributionRow>(
      (from, to) =>
        supabase
          .from('household_goal_contributions')
          .select('id, goal_id, contributor_user_id, amount, note, date', {
            count: 'exact',
          })
          .in('goal_id', goalIds)
          .order('date', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
      'household contributions read'
    );
    for (const c of contributions) {
      const entry: GoalContribution = {
        id: c.id,
        amount: Number(decryptPayload(c.amount, kh)),
        note: c.note ? decryptPayload(c.note, kh) : null,
        date: c.date,
        isSelf: c.contributor_user_id === userId,
      };
      const list = contribByGoal.get(c.goal_id) ?? [];
      list.push(entry);
      contribByGoal.set(c.goal_id, list);
    }
  }

  const itemsByGoal = await readGoalItems(
    context,
    goals.map((goal) => goal.id)
  );

  return goals.map((g) => {
    const contributions = contribByGoal.get(g.id) ?? [];
    const items = itemsByGoal.get(g.id) ?? [];
    const totals = computeProjectTotals(items);
    const targetAmount = Number(decryptPayload(g.target_amount, kh));
    const progress = computeGoalProgress(
      targetAmount,
      contributions.map((c) => c.amount)
    );
    return {
      id: g.id,
      name: decryptPayload(g.name, kh),
      targetAmount,
      targetDate: g.target_date,
      createdAt: g.created_at,
      contributions,
      contributed: progress.contributed,
      remaining: progress.remaining,
      pct: progress.pct,
      items,
      budgeted: totals.budgeted,
      paid: totals.paid,
    };
  });
}

/** Creates a goal in the caller's household, sealing name + target amount under K_h. */
export async function createGoal(input: unknown): Promise<void> {
  const data = parseOrThrow(createGoalSchema, input, 'household.goal.input');
  const { userId, kh, supabase } = await requireHouseholdContext();

  const { data: memberData, error: memberErr } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId);
  throwIfSupabaseError(memberErr, 'household member read');
  const householdId = ((memberData ?? [])[0] as { household_id: string })
    ?.household_id;
  if (!householdId) throw new Error('No household');

  const { error } = await supabase.from('household_goals').insert({
    id: randomUUID(),
    household_id: householdId,
    name: encryptPayload(data.name, kh),
    target_amount: encryptPayload(data.targetAmount.toString(), kh),
    target_date: data.targetDate ?? null,
    created_by: userId,
  });
  throwIfSupabaseError(error, 'household goal create');
}

/** Re-seals a goal's name and target under K_h; an omitted date clears it. */
export async function updateGoal(input: unknown): Promise<void> {
  const data = parseOrThrow(
    updateGoalSchema,
    input,
    'household.goal.update.input'
  );
  const { kh, supabase } = await requireHouseholdContext();

  const { data: rows, error } = await supabase
    .from('household_goals')
    .update({
      name: encryptPayload(data.name, kh),
      target_amount: encryptPayload(data.targetAmount.toString(), kh),
      target_date: data.targetDate ?? null,
    })
    .eq('id', data.goalId)
    .select('id');
  throwIfSupabaseError(error, 'household goal update');
  // RLS hides rows from non-members without an error, so zero rows is not a save.
  if (!rows || rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Goal not found');
  }
}

/** Logs a contribution toward a goal, sealing amount + note under K_h. */
export async function addContribution(input: unknown): Promise<void> {
  const data = parseOrThrow(
    addContributionSchema,
    input,
    'household.contribution.input'
  );
  const { userId, kh, supabase } = await requireHouseholdContext();

  const { error } = await supabase.from('household_goal_contributions').insert({
    id: randomUUID(),
    goal_id: data.goalId,
    contributor_user_id: userId,
    amount: encryptPayload(data.amount.toString(), kh),
    note: data.note ? encryptPayload(data.note, kh) : null,
    date: data.date,
  });
  throwIfSupabaseError(error, 'household contribution create');
}

/**
 * Deletes a goal (RLS + household membership scoped); contributions cascade.
 * Requires the same unlocked household session as other goal mutations.
 */
export async function deleteGoal(id: string): Promise<void> {
  parseOrThrow(ROW_UUID, id, 'household.deleteGoal.id');
  const { supabase } = await requireHouseholdContext();
  const { error } = await supabase
    .from('household_goals')
    .delete()
    .eq('id', id);
  throwIfSupabaseError(error, 'household goal delete');
}

/** Adds a budget line to a goal, sealing name + budget under K_h. */
export async function addGoalItem(input: unknown): Promise<void> {
  const data = parseOrThrow(addGoalItemSchema, input, 'household.item.input');
  const { kh, supabase } = await requireHouseholdContext();
  const { error } = await supabase.from('household_goal_items').insert({
    id: randomUUID(),
    goal_id: data.goalId,
    name: encryptPayload(data.name, kh),
    budget: encryptPayload(data.budget.toString(), kh),
  });
  throwIfSupabaseError(error, 'household goal item create');
}

/** Deletes a budget line (RLS scoped); its payments cascade. */
export async function deleteGoalItem(id: string): Promise<void> {
  parseOrThrow(ROW_UUID, id, 'household.deleteGoalItem.id');
  const { supabase } = await requireHouseholdContext();
  const { error } = await supabase
    .from('household_goal_items')
    .delete()
    .eq('id', id);
  throwIfSupabaseError(error, 'household goal item delete');
}

/** Records a payment against a budget line, sealing amount + note under K_h. */
export async function addItemPayment(input: unknown): Promise<void> {
  const data = parseOrThrow(
    addItemPaymentSchema,
    input,
    'household.payment.input'
  );
  const { userId, kh, supabase } = await requireHouseholdContext();
  const { error } = await supabase.from('household_goal_payments').insert({
    id: randomUUID(),
    item_id: data.itemId,
    payer_user_id: userId,
    amount: encryptPayload(data.amount.toString(), kh),
    note: data.note ? encryptPayload(data.note, kh) : null,
    date: data.date,
  });
  throwIfSupabaseError(error, 'household goal payment create');
}

/** Deletes one recorded payment (RLS scoped). */
export async function deleteItemPayment(id: string): Promise<void> {
  parseOrThrow(ROW_UUID, id, 'household.deleteItemPayment.id');
  const { supabase } = await requireHouseholdContext();
  const { error } = await supabase
    .from('household_goal_payments')
    .delete()
    .eq('id', id);
  throwIfSupabaseError(error, 'household goal payment delete');
}

/** Edits a payment's amount, note and date; the payer and item never change. */
export async function updateGoalPayment(input: unknown): Promise<void> {
  const { kh, supabase } = await requireHouseholdContext();
  const data = parseOrThrow(
    updateGoalPaymentSchema,
    input,
    'household.payment.update.input'
  );
  const { data: rows, error } = await supabase
    .from('household_goal_payments')
    .update({
      amount: encryptPayload(data.amount.toString(), kh),
      note: data.note ? encryptPayload(data.note, kh) : null,
      date: data.date,
    })
    .eq('id', data.paymentId)
    .select('id');
  throwIfSupabaseError(error, 'household goal payment update');
  // RLS hides rows the caller may not edit without an error, so zero rows is not a save.
  if (!rows || rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Payment not found');
  }
}

/** Edits a contribution's amount, note and date; the contributor never changes. */
export async function updateGoalContribution(input: unknown): Promise<void> {
  const { kh, supabase } = await requireHouseholdContext();
  const data = parseOrThrow(
    updateGoalContributionSchema,
    input,
    'household.contribution.update.input'
  );
  const { data: rows, error } = await supabase
    .from('household_goal_contributions')
    .update({
      amount: encryptPayload(data.amount.toString(), kh),
      note: data.note ? encryptPayload(data.note, kh) : null,
      date: data.date,
    })
    .eq('id', data.contributionId)
    .select('id');
  throwIfSupabaseError(error, 'household contribution update');
  if (!rows || rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Contribution not found');
  }
}

interface ExistingItem {
  name: string;
  budget: number;
  quote: number | null;
}

/**
 * Saves a goal and its budget lines from the editor draft.
 *
 * Not transactional: goal first, then item updates and inserts, deletes last,
 * each keyed on a stable id so a retry converges instead of duplicating. A
 * failure returns an opaque result with the ids so the draft retries as is.
 */
export async function saveGoal(input: unknown): Promise<SaveGoalResult> {
  const { userId, kh, supabase } = await requireHouseholdContext();
  const parsed = saveGoalSchema.safeParse(input);
  if (!parsed.success) {
    const error = z.flattenError(parsed.error);
    logger.warn(
      { label: 'household.goal.save.input', issues: error },
      'server-action input validation failed'
    );
    return {
      ok: false,
      code: 'VALIDATION',
      error: {
        formErrors: error.formErrors,
        fieldErrors: Object.fromEntries(
          Object.entries(error.fieldErrors).map(([key, value]) => [
            key,
            value ?? [],
          ])
        ),
      },
    };
  }
  const data = parsed.data;
  const goalId = data.goalId ?? randomUUID();
  const draft = data.items.map((item) => ({
    ...item,
    id: item.id ?? randomUUID(),
  }));
  const itemIds = draft.map((item) => item.id);

  try {
    const { data: goalRows, error: goalReadError } = await supabase
      .from('household_goals')
      .select('id')
      .eq('id', goalId);
    throwIfSupabaseError(goalReadError, 'household goal read');
    const goalExists = (goalRows ?? []).length > 0;

    const goalFields = {
      name: encryptPayload(data.name, kh),
      target_amount: encryptPayload(data.target.toString(), kh),
      target_date: data.targetDate ?? null,
    };
    if (goalExists) {
      const { error } = await supabase
        .from('household_goals')
        .update(goalFields)
        .eq('id', goalId);
      throwIfSupabaseError(error, 'household goal update');
    } else {
      const { data: memberRows, error: memberError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId);
      throwIfSupabaseError(memberError, 'household member read');
      const householdId = (
        (memberRows ?? [])[0] as { household_id: string } | undefined
      )?.household_id;
      if (!householdId) throw new AppError('NOT_FOUND', 'No household');
      const { error } = await supabase.from('household_goals').insert({
        id: goalId,
        household_id: householdId,
        ...goalFields,
        created_by: userId,
      });
      throwIfSupabaseError(error, 'household goal create');
    }

    const existing = new Map<string, ExistingItem>();
    if (goalExists) {
      const rows = await readAllRows<
        Pick<ItemRow, 'id' | 'name' | 'budget' | 'quote'>
      >(
        (from, to) =>
          supabase
            .from('household_goal_items')
            .select('id, name, budget, quote', { count: 'exact' })
            .eq('goal_id', goalId)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        'household goal items read'
      );
      for (const row of rows) {
        existing.set(row.id, {
          name: decryptPayload(row.name, kh),
          budget: Number(decryptPayload(row.budget, kh)),
          quote: row.quote ? Number(decryptPayload(row.quote, kh)) : null,
        });
      }
    }

    const seal = (item: (typeof draft)[number]) => ({
      name: encryptPayload(item.name, kh),
      budget: encryptPayload(item.budget.toString(), kh),
      quote: item.quote ? encryptPayload(item.quote.toString(), kh) : null,
    });

    for (const item of draft) {
      const before = existing.get(item.id);
      if (!before) continue;
      const unchanged =
        before.name === item.name &&
        before.budget === item.budget &&
        before.quote === (item.quote ?? null);
      if (unchanged) continue;
      const { error } = await supabase
        .from('household_goal_items')
        .update(seal(item))
        .eq('id', item.id)
        .eq('goal_id', goalId);
      throwIfSupabaseError(error, 'household goal item update');
    }

    // One insert per row: rows in a batch share a transaction timestamp, which
    // would lose the draft order that reads sort by.
    for (const item of draft) {
      if (existing.has(item.id)) continue;
      const { error } = await supabase
        .from('household_goal_items')
        .insert({ id: item.id, goal_id: goalId, ...seal(item) });
      throwIfSupabaseError(error, 'household goal item create');
    }

    const kept = new Set(itemIds);
    const removed = [...existing.keys()].filter((id) => !kept.has(id));
    if (removed.length > 0) {
      const { error } = await supabase
        .from('household_goal_items')
        .delete()
        .in('id', removed)
        .eq('goal_id', goalId);
      throwIfSupabaseError(error, 'household goal item delete');
    }
    return { ok: true, goalId, itemIds };
  } catch (error) {
    logger.error({ err: error, goalId }, 'household goal save failed');
    return { ok: false, code: 'SERVER', goalId, itemIds };
  }
}
