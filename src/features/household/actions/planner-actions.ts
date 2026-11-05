'use server';

import { requireHouseholdContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { AppError, throwIfSupabaseError } from '@/lib/errors';
import { readAllRows } from '@/lib/read-all-rows';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { plannerSplitSchema } from '../schemas';
import type { PlannerSplit } from '../types';

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

// Overrides live inside ciphertext, so no foreign key can drop them.
function pruneOverrides(
  overrides: Record<string, Record<string, number>>,
  goalIds: Set<string>
): Record<string, Record<string, number>> {
  return Object.fromEntries(
    Object.entries(overrides).filter(([goalId]) => goalIds.has(goalId))
  );
}

/**
 * Reads the agreed split. With no saved row it returns 50/50 flagged
 * `isDefault`, so "never set" and "set to 50/50" stay distinguishable.
 * Overrides for goals that no longer exist are dropped.
 */
export async function getPlannerSplit(): Promise<PlannerSplit> {
  const ctx = await requireHouseholdContext();
  const { userId, kh, supabase } = ctx;
  const { householdId, memberIds } = await readRoster(ctx);

  const { data, error } = await supabase
    .from('household_planner_settings')
    .select('split')
    .eq('household_id', householdId)
    .maybeSingle();
  throwIfSupabaseError(error, 'household planner read');

  const row = data as { split: string } | null;
  if (!row)
    return {
      members: evenSplit(memberIds),
      goalOverrides: {},
      isDefault: true,
      userId,
    };

  const parsed = plannerSplitSchema.safeParse(
    JSON.parse(decryptPayload(row.split, kh))
  );
  if (!parsed.success)
    throw new AppError('INTERNAL', 'Household planner split is unreadable');

  const goalIds = await readGoalIds(ctx);
  return {
    members: parsed.data.members,
    goalOverrides: pruneOverrides(parsed.data.goalOverrides, goalIds),
    isDefault: false,
    userId,
  };
}

/** Validates, prunes overrides of deleted goals, encrypts under K_h and upserts. */
export async function setPlannerSplit(input: unknown): Promise<void> {
  const data = parseOrThrow(
    plannerSplitSchema,
    input,
    'household.plannerSplit.input'
  );
  const ctx = await requireHouseholdContext();
  const { userId, kh, supabase } = ctx;
  const { householdId, memberIds } = await readRoster(ctx);

  const submitted = Object.keys(data.members).sort().join();
  if (memberIds.length !== 2 || [...memberIds].sort().join() !== submitted)
    throw new AppError('VALIDATION', 'Split must cover both household members');

  const goalIds = await readGoalIds(ctx);
  const split = {
    members: data.members,
    goalOverrides: pruneOverrides(data.goalOverrides, goalIds),
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
