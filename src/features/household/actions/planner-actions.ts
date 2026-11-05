'use server';

import { requireHouseholdContext } from '@/lib/action-guard';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { AppError, throwIfSupabaseError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { readAllRows } from '@/lib/read-all-rows';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { plannerSplitSchema, plannerSplitUpdateSchema } from '../schemas';
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
 * 50/50" stay distinguishable. Overrides for goals that no longer exist are
 * dropped.
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
      isDefault: true,
      userId,
    };

  const goalIds = await readGoalIds(ctx);
  return {
    members: stored.members,
    goalOverrides: pruneOverrides(stored.goalOverrides, goalIds),
    isDefault: false,
    userId,
  };
}

/**
 * Applies a partial edit to the stored split: a members edit keeps stored
 * overrides, an override edit touches only its goal key. Merging server-side
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
      : { members: evenSplit(memberIds), goalOverrides: {} };

  let merged: StoredSplit;
  if ('members' in data) {
    merged = { members: data.members, goalOverrides: current.goalOverrides };
  } else {
    const { [data.goalId]: _replaced, ...others } = current.goalOverrides;
    merged = {
      members: current.members,
      goalOverrides: data.override
        ? { ...others, [data.goalId]: data.override }
        : others,
    };
  }

  const goalIds = await readGoalIds(ctx);
  const split: StoredSplit = {
    members: merged.members,
    goalOverrides: pruneOverrides(merged.goalOverrides, goalIds),
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
