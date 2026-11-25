'use server';

import { requireHouseholdContext } from '@/lib/action-guard';
import { AppError, throwIfSupabaseError } from '@/lib/errors';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { ROW_UUID } from '@/lib/zod-utils';

/** A household member adds themself to a goal; the database enforces the cap and the household. */
export async function joinGoal(goalId: string): Promise<void> {
  parseOrThrow(ROW_UUID, goalId, 'household.joinGoal.id');
  const { userId, supabase } = await requireHouseholdContext();
  const { error } = await supabase
    .from('household_goal_members')
    .upsert(
      { goal_id: goalId, user_id: userId },
      { onConflict: 'goal_id,user_id', ignoreDuplicates: true }
    );
  throwIfSupabaseError(error, 'household goal join');
}

/** A member removes themself from a goal; the last member cannot leave. */
export async function leaveGoal(goalId: string): Promise<void> {
  parseOrThrow(ROW_UUID, goalId, 'household.leaveGoal.id');
  const { userId, supabase } = await requireHouseholdContext();
  const { data, error: readError } = await supabase
    .from('household_goal_members')
    .select('user_id')
    .eq('goal_id', goalId);
  throwIfSupabaseError(readError, 'household goal members read');
  const members = ((data ?? []) as { user_id: string }[]).map((m) => m.user_id);
  if (!members.includes(userId)) {
    throw new AppError('VALIDATION', 'You are not on this goal');
  }
  if (members.length <= 1) {
    throw new AppError('VALIDATION', 'A goal needs at least one member');
  }
  const { error } = await supabase
    .from('household_goal_members')
    .delete()
    .eq('goal_id', goalId)
    .eq('user_id', userId);
  throwIfSupabaseError(error, 'household goal leave');
}
