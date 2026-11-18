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
const BUFFER_COLUMNS = `${BASE_COLUMNS}, expense_buffer_pct`;
const FREEDOM_COLUMNS = `${BUFFER_COLUMNS}, freedom_real_return_pct, freedom_withdrawal_rate_pct, freedom_target_year`;
const COVERAGE_COLUMNS = `${FREEDOM_COLUMNS}, insurance_pct, dividend_spend_threshold_pct, dividend_spend_share_pct`;

// Postgres "undefined_column": a planner migration (buffer, freedom
// assumptions, coverage settings) has not been applied yet, so the planner runs without those
// stored values instead of failing.
function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === '42703';
}

interface PlannerRow {
  emergency_months: number;
  war_chest_months: number;
  tithe_enabled: boolean;
  tithe_pct: number;
  allowance_enabled: boolean;
  allowance_pct: number;
  household_horizon_months: number | null;
  expense_buffer_pct?: unknown;
  freedom_real_return_pct?: unknown;
  freedom_withdrawal_rate_pct?: unknown;
  freedom_target_year?: unknown;
  insurance_pct?: unknown;
  dividend_spend_threshold_pct?: unknown;
  dividend_spend_share_pct?: unknown;
}

// NUMERIC columns arrive as strings and unset ones as null.
function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function getPlannerSettings(): Promise<PlannerSettingsData | null> {
  const { userId, supabase } = await requireDbContext();

  // Newest column set first; each missing-column error steps down to the set
  // that predates the unapplied migration.
  const tiers = [
    COVERAGE_COLUMNS,
    FREEDOM_COLUMNS,
    BUFFER_COLUMNS,
    BASE_COLUMNS,
  ];
  let result = await supabase
    .from('planner_settings')
    .select(tiers[0])
    .eq('user_id', userId)
    .maybeSingle();
  for (const columns of tiers.slice(1)) {
    if (!isMissingColumn(result.error)) break;
    result = await supabase
      .from('planner_settings')
      .select(columns)
      .eq('user_id', userId)
      .maybeSingle();
  }
  throwIfSupabaseError(result.error, 'planner read');
  // The column list is chosen at runtime, so the client cannot infer the row.
  const data = result.data as PlannerRow | null;
  if (!data) return null;
  const freedomRealReturnPct = optionalNumber(data.freedom_real_return_pct);
  const freedomWithdrawalRatePct = optionalNumber(
    data.freedom_withdrawal_rate_pct
  );
  const freedomTargetYear = optionalNumber(data.freedom_target_year);
  const insurancePct = optionalNumber(data.insurance_pct);
  const dividendSpendThresholdPct = optionalNumber(
    data.dividend_spend_threshold_pct
  );
  const dividendSpendSharePct = optionalNumber(data.dividend_spend_share_pct);

  return {
    emergencyMonths: data.emergency_months,
    warChestMonths: data.war_chest_months,
    titheEnabled: data.tithe_enabled,
    tithePct: data.tithe_pct,
    allowanceEnabled: data.allowance_enabled,
    allowancePct: data.allowance_pct,
    householdHorizonMonths:
      data.household_horizon_months ?? DEFAULT_HOUSEHOLD_HORIZON_MONTHS,
    expenseBufferPct: optionalNumber(data.expense_buffer_pct) ?? 0,
    ...(freedomRealReturnPct === undefined ? {} : { freedomRealReturnPct }),
    ...(freedomWithdrawalRatePct === undefined
      ? {}
      : { freedomWithdrawalRatePct }),
    ...(freedomTargetYear === undefined ? {} : { freedomTargetYear }),
    ...(insurancePct === undefined ? {} : { insurancePct }),
    ...(dividendSpendThresholdPct === undefined
      ? {}
      : { dividendSpendThresholdPct }),
    ...(dividendSpendSharePct === undefined ? {} : { dividendSpendSharePct }),
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

  // Optional groups are omitted when undefined so an autosave never resets them.
  const bufferFields =
    data.expenseBufferPct === undefined
      ? {}
      : { expense_buffer_pct: data.expenseBufferPct };
  const freedomFields = {
    ...(data.freedomRealReturnPct === undefined
      ? {}
      : { freedom_real_return_pct: data.freedomRealReturnPct }),
    ...(data.freedomWithdrawalRatePct === undefined
      ? {}
      : { freedom_withdrawal_rate_pct: data.freedomWithdrawalRatePct }),
    ...(data.freedomTargetYear === undefined
      ? {}
      : { freedom_target_year: data.freedomTargetYear }),
  };
  const coverageFields = {
    ...(data.insurancePct === undefined
      ? {}
      : { insurance_pct: data.insurancePct }),
    ...(data.dividendSpendThresholdPct === undefined
      ? {}
      : { dividend_spend_threshold_pct: data.dividendSpendThresholdPct }),
    ...(data.dividendSpendSharePct === undefined
      ? {}
      : { dividend_spend_share_pct: data.dividendSpendSharePct }),
  };
  const hasCoverage = Object.keys(coverageFields).length > 0;
  const hasFreedom = Object.keys(freedomFields).length > 0;
  const hasBuffer = Object.keys(bufferFields).length > 0;

  // A missing-column error drops the newest unapplied group and retries, so
  // the older fields still save before the owner applies a migration.
  const attempts = [
    { ...row, ...bufferFields, ...freedomFields, ...coverageFields },
    ...(hasCoverage ? [{ ...row, ...bufferFields, ...freedomFields }] : []),
    ...(hasFreedom ? [{ ...row, ...bufferFields }] : []),
    ...(hasBuffer ? [row] : []),
  ];
  let error: { code?: string; message: string } | null = null;
  for (const payload of attempts) {
    ({ error } = await supabase
      .from('planner_settings')
      .upsert(payload, { onConflict: 'user_id' }));
    if (!isMissingColumn(error)) break;
  }

  throwIfSupabaseError(error, 'planner write');
}
