'use server';

import { requireHouseholdContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { AppError, throwIfSupabaseError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { readAllRows } from '@/lib/read-all-rows';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { computeHouseholdCommitment } from '../lib/household-commitment';
import {
  plannerCommitmentInputSchema,
  plannerSplitSchema,
  plannerSplitUpdateSchema,
} from '../schemas';
import type { PlannerCommitment, PlannerSplit } from '../types';
import { getSpendingBudgets } from './budget-actions';
import { getGoals } from './goal-actions';
import { getHousehold } from './household-actions';

type Context = Awaited<ReturnType<typeof requireHouseholdContext>>;

interface Roster {
  householdId: string;
  memberIds: string[];
}

async function readRoster({ userId, supabase }: Context): Promise<Roster> {
  const { data: own, error: ownError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId);
  throwIfSupabaseError(ownError, 'household member read');
  const householdId = ((own ?? [])[0] as { household_id: string } | undefined)
    ?.household_id;
  if (!householdId) throw new AppError('NOT_FOUND', 'No household');

  const { data, error } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId);
  throwIfSupabaseError(error, 'household roster read');
  const memberIds = ((data ?? []) as { user_id: string }[]).map(
    (row) => row.user_id
  );
  return { householdId, memberIds };
}

function evenSplit(memberIds: string[]): Record<string, number> {
  if (memberIds.length !== 2)
    return Object.fromEntries(
      memberIds.map((id) => [id, 100 / memberIds.length])
    );
  return { [memberIds[0]]: 50, [memberIds[1]]: 50 };
}

async function readGoalIds({ supabase }: Context): Promise<Set<string>> {
  const rows = await readAllRows<{ id: string }>(
    (from, to) =>
      supabase
        .from('household_goals')
        .select('id', { count: 'exact' })
        .order('id', { ascending: true })
        .range(from, to),
    'household goal ids read'
  );
  return new Set(rows.map((row) => row.id));
}

async function readBudgetIds({ supabase }: Context): Promise<Set<string>> {
  const rows = await readAllRows<{ id: string }>(
    (from, to) =>
      supabase
        .from('household_spending_budgets')
        .select('id', { count: 'exact' })
        .order('id', { ascending: true })
        .range(from, to),
    'household budget ids read'
  );
  return new Set(rows.map((row) => row.id));
}

// Overrides live inside ciphertext, so no foreign key can drop them.
function pruneOverrides(
  overrides: Record<string, Record<string, number>>,
  goalIds: Set<string>
): Record<string, Record<string, number>> {
  return Object.fromEntries(
    Object.entries(overrides).filter(([goalId]) => goalIds.has(goalId))
  );
}

function withOverride(
  overrides: Record<string, Record<string, number>>,
  id: string,
  override: Record<string, number> | null
): Record<string, Record<string, number>> {
  const { [id]: _replaced, ...others } = overrides;
  return override ? { ...others, [id]: override } : others;
}

type StoredSplit = Omit<PlannerSplit, 'isDefault' | 'userId'>;

function sameIds(a: string[], b: string[]): boolean {
  return [...a].sort().join() === [...b].sort().join();
}

// Detail stays in the server log; callers only see an opaque message.
function parseStored(ciphertext: string, kh: Buffer): StoredSplit {
  try {
    const parsed = plannerSplitSchema.safeParse(
      JSON.parse(decryptPayload(ciphertext, kh))
    );
    if (!parsed.success) throw new Error('stored split failed validation');
    return parsed.data;
  } catch (err) {
    logger.error({ err }, 'household planner split unreadable');
    throw new AppError('INTERNAL', 'Household planner split is unreadable');
  }
}

async function readStoredRow(
  { supabase }: Context,
  householdId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('household_planner_settings')
    .select('split')
    .eq('household_id', householdId)
    .maybeSingle();
  throwIfSupabaseError(error, 'household planner read');
  return (data as { split: string } | null)?.split ?? null;
}

/**
 * Reads the agreed split. With no saved row, or one saved for a different
 * roster, it returns 50/50 flagged `isDefault`, so "never set" and "set to
 * 50/50" stay distinguishable. Overrides for goals and budgets that no
 * longer exist are dropped.
 */
export async function getPlannerSplit(): Promise<PlannerSplit> {
  const ctx = await requireHouseholdContext();
  const { userId, kh } = ctx;
  const { householdId, memberIds } = await readRoster(ctx);

  const ciphertext = await readStoredRow(ctx, householdId);
  const stored = ciphertext ? parseStored(ciphertext, kh) : null;
  if (!stored || !sameIds(Object.keys(stored.members), memberIds))
    return {
      members: evenSplit(memberIds),
      goalOverrides: {},
      budgetOverrides: {},
      isDefault: true,
      userId,
    };

  const [goalIds, budgetIds] = await Promise.all([
    readGoalIds(ctx),
    readBudgetIds(ctx),
  ]);
  return {
    members: stored.members,
    goalOverrides: pruneOverrides(stored.goalOverrides, goalIds),
    budgetOverrides: pruneOverrides(stored.budgetOverrides, budgetIds),
    isDefault: false,
    userId,
  };
}

/**
 * Applies a partial edit to the stored split: a members edit keeps stored
 * overrides, an override edit touches only its goal or budget key. Merging server-side
 * means a stale client cache cannot discard the partner's newer changes.
 */
export async function setPlannerSplit(input: unknown): Promise<void> {
  const ctx = await requireHouseholdContext();
  const { userId, kh, supabase } = ctx;
  const data = parseOrThrow(
    plannerSplitUpdateSchema,
    input,
    'household.plannerSplit.input'
  );
  const { householdId, memberIds } = await readRoster(ctx);

  const edited = 'members' in data ? data.members : data.override;
  if (
    edited &&
    (memberIds.length !== 2 || !sameIds(Object.keys(edited), memberIds))
  )
    throw new AppError('VALIDATION', 'Split must cover both household members');

  const ciphertext = await readStoredRow(ctx, householdId);
  const stored = ciphertext ? parseStored(ciphertext, kh) : null;
  const current: StoredSplit =
    stored && sameIds(Object.keys(stored.members), memberIds)
      ? stored
      : {
          members: evenSplit(memberIds),
          goalOverrides: {},
          budgetOverrides: {},
        };

  let merged: StoredSplit = current;
  if ('members' in data) {
    merged = { ...current, members: data.members };
  } else if ('goalId' in data) {
    merged = {
      ...current,
      goalOverrides: withOverride(
        current.goalOverrides,
        data.goalId,
        data.override
      ),
    };
  } else {
    merged = {
      ...current,
      budgetOverrides: withOverride(
        current.budgetOverrides,
        data.budgetId,
        data.override
      ),
    };
  }

  const [goalIds, budgetIds] = await Promise.all([
    readGoalIds(ctx),
    readBudgetIds(ctx),
  ]);
  const split: StoredSplit = {
    members: merged.members,
    goalOverrides: pruneOverrides(merged.goalOverrides, goalIds),
    budgetOverrides: pruneOverrides(merged.budgetOverrides, budgetIds),
  };

  const { error } = await supabase.from('household_planner_settings').upsert(
    {
      household_id: householdId,
      split: encryptPayload(JSON.stringify(split), kh),
      created_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'household_id' }
  );
  throwIfSupabaseError(error, 'household planner write');
}

function emptyCommitment(state: 'none' | 'locked'): PlannerCommitment {
  return {
    state,
    isDefaultSplit: false,
    reserve: 0,
    monthlyDeduction: 0,
    goals: [],
    budgets: { monthlyTotal: 0, share: 0, monthlyShare: 0 },
    excluded: [],
  };
}

/**
 * The caller's share of household goals and budgets for the personal planner.
 * Only the caller's computed figures leave the server. No household is `none`
 * and a locked one is `locked`, so the planner can render without either.
 */
export async function getPlannerCommitment(
  input: unknown
): Promise<PlannerCommitment> {
  const { horizonMonths } = parseOrThrow(
    plannerCommitmentInputSchema,
    input,
    'household.plannerCommitment.input'
  );

  const household = await getHousehold();
  if (!household) return emptyCommitment('none');
  if (household.locked) return emptyCommitment('locked');

  const [goals, budgets, split] = await Promise.all([
    getGoals(),
    getSpendingBudgets(),
    getPlannerSplit(),
  ]);

  const result = computeHouseholdCommitment({
    goals: goals.map((goal) => ({
      id: goal.id,
      remaining: goal.remaining,
      targetDate: goal.targetDate,
    })),
    budgets: budgets.map((budget) => ({
      id: budget.id,
      monthlyAmount: budget.monthlyAmount,
    })),
    split,
    callerUserId: split.userId,
    horizonMonths,
    now: new Date(),
  });

  const names = new Map(goals.map((goal) => [goal.id, goal.name]));
  const nameOf = (goalId: string) => names.get(goalId) ?? 'Goal';

  return {
    state: 'ready',
    isDefaultSplit: split.isDefault,
    reserve: result.reserve,
    monthlyDeduction: result.monthlyDeduction,
    goals: result.goals.map((line) => ({ ...line, name: nameOf(line.goalId) })),
    budgets: result.budgets,
    excluded: result.excluded.map((entry) => ({
      ...entry,
      name: nameOf(entry.goalId),
    })),
  };
}
