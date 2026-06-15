import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const USER_ID = 'user-1';

let supabase: ReturnType<typeof makeFakeSupabase>['client'];

vi.mock('@/lib/action-guard', () => ({
  requireDbContext: async () => ({ userId: USER_ID, supabase }),
}));

function setSupabase(opts: FakeSupabaseOptions = {}) {
  const fake = makeFakeSupabase(opts);
  supabase = fake.client;
  return fake;
}

beforeEach(() => {
  setSupabase();
});

const VALID_SETTINGS = {
  emergencyMonths: 6,
  warChestMonths: 12,
  titheEnabled: true,
  tithePct: 10,
  allowanceEnabled: false,
  allowancePct: 0,
};

describe('planner-actions — getPlannerSettings', () => {
  it('maps snake_case columns to the camelCase shape', async () => {
    setSupabase({
      selectData: {
        emergency_months: 6,
        war_chest_months: 12,
        tithe_enabled: true,
        tithe_pct: 10,
        allowance_enabled: false,
        allowance_pct: 0,
      },
    });
    const { getPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    expect(await getPlannerSettings()).toEqual(VALID_SETTINGS);
  });

  it('returns null when the row is missing', async () => {
    setSupabase({ selectData: null });
    const { getPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    expect(await getPlannerSettings()).toBeNull();
  });

  it('returns null on a read error (no throw, no leak)', async () => {
    setSupabase({
      selectError: { message: 'permission denied for table planner_settings' },
    });
    const { getPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    expect(await getPlannerSettings()).toBeNull();
  });
});

describe('planner-actions — upsertPlannerSettings', () => {
  it('writes mapped columns on valid input', async () => {
    const fake = setSupabase();
    const { upsertPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    await upsertPlannerSettings(VALID_SETTINGS);

    expect(fake.calls.from).toContain('planner_settings');
    const row = fake.calls.upsert[0] as Record<string, unknown>;
    expect(row.user_id).toBe(USER_ID);
    expect(row.emergency_months).toBe(6);
    expect(row.war_chest_months).toBe(12);
    expect(row.tithe_enabled).toBe(true);
    expect(row.tithe_pct).toBe(10);
    expect(row.allowance_enabled).toBe(false);
    expect(typeof row.updated_at).toBe('string');
  });

  it('rejects invalid input before any DB call', async () => {
    const fake = setSupabase();
    const { upsertPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    await expect(
      upsertPlannerSettings({ ...VALID_SETTINGS, tithePct: 150 })
    ).rejects.toThrow();
    expect(fake.calls.upsert).toHaveLength(0);
  });

  it('surfaces an opaque error on a write failure', async () => {
    setSupabase({ upsertError: { message: 'deadlock detected' } });
    const { upsertPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    await expect(upsertPlannerSettings(VALID_SETTINGS)).rejects.toThrow(
      'planner write failed'
    );
  });
});
