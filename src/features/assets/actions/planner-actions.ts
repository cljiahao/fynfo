'use server';

import { requireDbContext } from '@/lib/action-guard';
import { throwIfSupabaseError } from '@/lib/errors';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { randomUUID } from 'crypto';
import { plannerSettingsSchema } from '../schemas';
import type { PlannerSettingsData } from '../types';

const DEFAULT_HOUSEHOLD_HORIZON_MONTHS = 24;

export async function getPlannerSettings(): Promise<PlannerSettingsData | null> {
  const { userId, supabase } = await requireDbContext();

  const { data, error } = await supabase
    .from('planner_settings')
    .select(
      'emergency_months, war_chest_months, tithe_enabled, tithe_pct, allowance_enabled, allowance_pct, household_horizon_months'
    )
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
    householdHorizonMonths:
      data.household_horizon_months ?? DEFAULT_HOUSEHOLD_HORIZON_MONTHS,
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
      // Omitted when absent so a planner save never resets the stored horizon.
      ...(data.householdHorizonMonths === undefined
        ? {}
        : { household_horizon_months: data.householdHorizonMonths }),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
    }
  );

  throwIfSupabaseError(error, 'planner write');
}
