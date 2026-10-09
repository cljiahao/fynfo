'use server';

import { requireDbContext } from '@/lib/action-guard';
import { throwIfSupabaseError } from '@/lib/errors';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { randomUUID } from 'crypto';
import { plannerSettingsSchema } from '../schemas';
import type { PlannerSettingsData } from '../types';

export async function getPlannerSettings(): Promise<PlannerSettingsData | null> {
  const { userId, supabase } = await requireDbContext();

  const { data, error } = await supabase
    .from('planner_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  throwIfSupabaseError(error, 'planner read');
  if (!data) return null;

  return {
    emergencyMonths: data.emergency_months,
    warChestMonths: data.war_chest_months,
    titheEnabled: data.tithe_enabled,
    tithePct: data.tithe_pct,
    allowanceEnabled: data.allowance_enabled,
    allowancePct: data.allowance_pct,
  };
}

export async function upsertPlannerSettings(
  data: PlannerSettingsData
): Promise<void> {
  parseOrThrow(plannerSettingsSchema, data, 'planner.upsert.input');
  const { userId, supabase } = await requireDbContext();

  const { error } = await supabase.from('planner_settings').upsert(
    {
      id: randomUUID(),
      user_id: userId,
      emergency_months: data.emergencyMonths,
      war_chest_months: data.warChestMonths,
      tithe_enabled: data.titheEnabled,
      tithe_pct: data.tithePct,
      allowance_enabled: data.allowanceEnabled,
      allowance_pct: data.allowancePct,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
    }
  );

  throwIfSupabaseError(error, 'planner write');
}
