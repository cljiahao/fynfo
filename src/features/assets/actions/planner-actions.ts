'use server';

import { requireDbContext } from '@/lib/action-guard';
import { throwIfSupabaseError } from '@/lib/errors';
import { parseOrThrow } from '@/lib/validation/parse-or-throw';
import { randomUUID } from 'crypto';
import { plannerSettingsSchema } from '../schemas';
import type { PlannerSettingsData } from '../types';

const DEFAULT_HOUSEHOLD_HORIZON_MONTHS = 24;

const BASE_COLUMNS =
  'emergency_months, war_chest_months, tithe_enabled, tithe_pct, allowance_enabled, allowance_pct, household_horizon_months';

// Postgres "undefined_column": the buffer migration has not been applied yet,
// so the planner runs without a stored buffer instead of failing.
function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === '42703';
}

export async function getPlannerSettings(): Promise<PlannerSettingsData | null> {
  const { userId, supabase } = await requireDbContext();

  const withBuffer = await supabase
    .from('planner_settings')
    .select(`${BASE_COLUMNS}, expense_buffer_pct`)
    .eq('user_id', userId)
    .maybeSingle();

  const fallback = isMissingColumn(withBuffer.error)
    ? await supabase
        .from('planner_settings')
        .select(BASE_COLUMNS)
        .eq('user_id', userId)
        .maybeSingle()
    : null;
  const error = fallback ? fallback.error : withBuffer.error;
  const data = fallback ? fallback.data : withBuffer.data;

  throwIfSupabaseError(error, 'planner read');
  if (!data) return null;
  const bufferPct = fallback
    ? 0
    : Number((data as { expense_buffer_pct?: unknown }).expense_buffer_pct);

  return {
    emergencyMonths: data.emergency_months,
    warChestMonths: data.war_chest_months,
    titheEnabled: data.tithe_enabled,
    tithePct: data.tithe_pct,
    allowanceEnabled: data.allowance_enabled,
    allowancePct: data.allowance_pct,
    householdHorizonMonths:
      data.household_horizon_months ?? DEFAULT_HOUSEHOLD_HORIZON_MONTHS,
    expenseBufferPct: Number.isFinite(bufferPct) ? bufferPct : 0,
  };
}

export async function upsertPlannerSettings(
  data: PlannerSettingsData
): Promise<void> {
  parseOrThrow(plannerSettingsSchema, data, 'planner.upsert.input');
  const { userId, supabase } = await requireDbContext();

  const row = {
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
  };

  const bufferFields =
    data.expenseBufferPct === undefined
      ? {}
      : { expense_buffer_pct: data.expenseBufferPct };
  let { error } = await supabase
    .from('planner_settings')
    .upsert({ ...row, ...bufferFields }, { onConflict: 'user_id' });
  if (isMissingColumn(error) && data.expenseBufferPct !== undefined) {
    ({ error } = await supabase
      .from('planner_settings')
      .upsert(row, { onConflict: 'user_id' }));
  }

  throwIfSupabaseError(error, 'planner write');
}
