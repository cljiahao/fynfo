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
  householdHorizonMonths: 24,
};

const OLD_ROW = {
  emergency_months: 6,
  war_chest_months: 12,
  tithe_enabled: true,
  tithe_pct: 10,
  allowance_enabled: false,
  allowance_pct: 0,
};

const FREEDOM_ROW = {
  ...OLD_ROW,
  expense_buffer_pct: '5',
  freedom_real_return_pct: '4.5',
  freedom_withdrawal_rate_pct: '3.5',
  freedom_target_year: 2045,
};

describe('planner-actions - freedom assumptions', () => {
  it('maps the stored freedom assumptions', async () => {
    setSupabase({ selectData: FREEDOM_ROW });
    const { getPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    expect(await getPlannerSettings()).toMatchObject({
      freedomRealReturnPct: 4.5,
      freedomWithdrawalRatePct: 3.5,
      freedomTargetYear: 2045,
    });
  });

  it('leaves unset (NULL) assumptions out of the result', async () => {
    setSupabase({
      selectData: {
        ...FREEDOM_ROW,
        freedom_real_return_pct: null,
        freedom_withdrawal_rate_pct: null,
        freedom_target_year: null,
      },
    });
    const { getPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    const result = await getPlannerSettings();
    expect('freedomRealReturnPct' in (result ?? {})).toBe(false);
    expect('freedomWithdrawalRatePct' in (result ?? {})).toBe(false);
    expect('freedomTargetYear' in (result ?? {})).toBe(false);
  });

  it('writes the freedom assumptions only when given', async () => {
    const fake = setSupabase();
    const { upsertPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    await upsertPlannerSettings({
      ...VALID_SETTINGS,
      freedomRealReturnPct: 4,
      freedomWithdrawalRatePct: 3.5,
      freedomTargetYear: 2050,
    });
    await upsertPlannerSettings(VALID_SETTINGS);
    const [first, second] = fake.calls.upsert as Record<string, unknown>[];
    expect(first.freedom_real_return_pct).toBe(4);
    expect(first.freedom_withdrawal_rate_pct).toBe(3.5);
    expect(first.freedom_target_year).toBe(2050);
    expect('freedom_real_return_pct' in second).toBe(false);
    expect('freedom_withdrawal_rate_pct' in second).toBe(false);
    expect('freedom_target_year' in second).toBe(false);
  });

  it.each([
    ['freedomRealReturnPct', -0.1],
    ['freedomRealReturnPct', 12.1],
    ['freedomWithdrawalRatePct', 0.9],
    ['freedomWithdrawalRatePct', 10.1],
    ['freedomTargetYear', 1999],
    ['freedomTargetYear', 2201],
    ['freedomTargetYear', 2040.5],
  ])('rejects %s = %s', async (field, value) => {
    const fake = setSupabase();
    const { upsertPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    await expect(
      upsertPlannerSettings({ ...VALID_SETTINGS, [field]: value })
    ).rejects.toThrow();
    expect(fake.calls.upsert).toHaveLength(0);
  });

  it('accepts each bound', async () => {
    const fake = setSupabase();
    const { upsertPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    await upsertPlannerSettings({
      ...VALID_SETTINGS,
      freedomRealReturnPct: 0,
      freedomWithdrawalRatePct: 1,
      freedomTargetYear: 2000,
    });
    await upsertPlannerSettings({
      ...VALID_SETTINGS,
      freedomRealReturnPct: 12,
      freedomWithdrawalRatePct: 10,
      freedomTargetYear: 2200,
    });
    expect(fake.calls.upsert).toHaveLength(2);
  });
});

describe('planner-actions - missing-column fallback', () => {
  const MISSING = { code: '42703', message: 'column does not exist' };

  function scriptedClient(opts: {
    selects?: { data: unknown; error: unknown }[];
    upserts?: { error: unknown }[];
  }) {
    const selected: string[] = [];
    const upserted: Record<string, unknown>[] = [];
    const selects = [...(opts.selects ?? [])];
    const upserts = [...(opts.upserts ?? [])];
    supabase = {
      from: () => ({
        select: (columns: string) => {
          selected.push(columns);
          const chain = {
            eq: () => chain,
            maybeSingle: async () =>
              selects.shift() ?? { data: null, error: null },
          };
          return chain;
        },
        upsert: async (payload: Record<string, unknown>) => {
          upserted.push(payload);
          return upserts.shift() ?? { error: null };
        },
      }),
    } as unknown as typeof supabase;
    return { selected, upserted };
  }

  it('reads the old column set when no planner migration is applied', async () => {
    const { selected } = scriptedClient({
      selects: [
        { data: null, error: MISSING },
        { data: null, error: MISSING },
        { data: OLD_ROW, error: null },
      ],
    });
    const { getPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    const result = await getPlannerSettings();
    expect(selected).toHaveLength(3);
    expect(selected[2]).not.toContain('expense_buffer_pct');
    expect(result).toMatchObject({ emergencyMonths: 6, expenseBufferPct: 0 });
    expect('freedomTargetYear' in (result ?? {})).toBe(false);
  });

  it('keeps the buffer when only the freedom columns are missing', async () => {
    scriptedClient({
      selects: [
        { data: null, error: MISSING },
        { data: { ...OLD_ROW, expense_buffer_pct: '8' }, error: null },
      ],
    });
    const { getPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    expect((await getPlannerSettings())?.expenseBufferPct).toBe(8);
  });

  it('still saves the old fields when the freedom columns are missing', async () => {
    const { upserted } = scriptedClient({
      upserts: [{ error: MISSING }, { error: null }],
    });
    const { upsertPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    await upsertPlannerSettings({
      ...VALID_SETTINGS,
      expenseBufferPct: 7,
      freedomTargetYear: 2040,
    });
    expect(upserted).toHaveLength(2);
    expect(upserted[1].expense_buffer_pct).toBe(7);
    expect('freedom_target_year' in upserted[1]).toBe(false);
    expect(upserted[1].emergency_months).toBe(6);
  });

  it('falls back to the base fields when buffer and freedom columns are missing', async () => {
    const { upserted } = scriptedClient({
      upserts: [{ error: MISSING }, { error: MISSING }, { error: null }],
    });
    const { upsertPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    await upsertPlannerSettings({
      ...VALID_SETTINGS,
      expenseBufferPct: 7,
      freedomTargetYear: 2040,
    });
    expect(upserted).toHaveLength(3);
    expect('expense_buffer_pct' in upserted[2]).toBe(false);
    expect('freedom_target_year' in upserted[2]).toBe(false);
  });

  it('does not mask a non-column error', async () => {
    scriptedClient({
      upserts: [{ error: { code: '23514', message: 'check violation' } }],
    });
    const { upsertPlannerSettings } =
      await import('@/features/assets/actions/planner-actions');
    await expect(
      upsertPlannerSettings({ ...VALID_SETTINGS, freedomTargetYear: 2040 })
    ).rejects.toThrow('planner write failed');
  });
});
