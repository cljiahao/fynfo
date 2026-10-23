'use server';

import { requireHouseholdContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { throwIfSupabaseError } from '@/lib/errors';
import { readAllRows } from '@/lib/read-all-rows';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { randomUUID } from 'crypto';
import { computeGoalProgress } from '../lib/goal-progress';
import { computeItemBudget, computeProjectTotals } from '../lib/project-budget';
import {
  addContributionSchema,
  addGoalItemSchema,
  addItemPaymentSchema,
  createGoalSchema,
} from '../schemas';
import type {
  GoalContribution,
  GoalItem,
  GoalItemPayment,
  HouseholdGoal,
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
            .select('id, goal_id, name, budget', { count: 'exact' })
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
  const { supabase } = await requireHouseholdContext();
  const { error } = await supabase
    .from('household_goal_payments')
    .delete()
    .eq('id', id);
  throwIfSupabaseError(error, 'household goal payment delete');
}
