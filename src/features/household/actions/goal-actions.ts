'use server';

import { requireHouseholdContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { throwIfSupabaseError } from '@/lib/errors';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { randomUUID } from 'crypto';
import { computeGoalProgress } from '../lib/goal-progress';
import { addContributionSchema, createGoalSchema } from '../schemas';
import type { GoalContribution, HouseholdGoal } from '../types';

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

/** Reads the caller's household goals + contributions, decrypts, attaches progress. */
export async function getGoals(): Promise<HouseholdGoal[]> {
  const { userId, kh, supabase } = await requireHouseholdContext();

  const { data: goalData, error: goalErr } = await supabase
    .from('household_goals')
    .select('id, name, target_amount, target_date, created_at')
    .order('created_at', { ascending: false });
  throwIfSupabaseError(goalErr, 'household goals read');

  const goals = (goalData ?? []) as GoalRow[];
  if (goals.length === 0) return [];

  const { data: contribData, error: contribErr } = await supabase
    .from('household_goal_contributions')
    .select('id, goal_id, contributor_user_id, amount, note, date')
    .in(
      'goal_id',
      goals.map((g) => g.id)
    )
    .order('date', { ascending: false });
  throwIfSupabaseError(contribErr, 'household contributions read');

  const contribByGoal = new Map<string, GoalContribution[]>();
  for (const c of (contribData ?? []) as ContributionRow[]) {
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

  return goals.map((g) => {
    const contributions = contribByGoal.get(g.id) ?? [];
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

/** Deletes a goal (RLS + household membership scoped); contributions cascade. */
export async function deleteGoal(id: string): Promise<void> {
  const { supabase } = await requireHouseholdContext();
  const { error } = await supabase
    .from('household_goals')
    .delete()
    .eq('id', id);
  throwIfSupabaseError(error, 'household goal delete');
}
