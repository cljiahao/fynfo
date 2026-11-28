'use server';

import { requireActionContext } from '@/lib/action-guard';
import {
  encodeBudget,
  readWeeklyBudget,
  unavailable,
  weeklyBudgetInputSchema,
} from './publish-payload';

export async function getWeeklyBudget(): Promise<number | null> {
  const { userId, dek, supabase } = await requireActionContext();
  return readWeeklyBudget(supabase, userId, dek);
}

export async function setWeeklyBudget(input: unknown): Promise<void> {
  const { userId, dek, supabase } = await requireActionContext();
  const parsed = weeklyBudgetInputSchema.safeParse(input);
  if (!parsed.success) return unavailable();
  const { error } = await supabase.from('invest_settings').upsert(
    {
      user_id: userId,
      payload: encodeBudget(parsed.data.weeklyBudget, dek),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) unavailable();
}
