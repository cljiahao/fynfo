import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const ME = '11111111-1111-4111-8111-111111111111';
const PARTNER = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const KH = Buffer.alloc(32, 9);
const HOUSEHOLD_ID = '7d1c6c0e-1f0a-4f55-8d0e-0a8e4b7a0c11';
const LIVE_GOAL = '44444444-4444-4444-8444-444444444444';
const OTHER_GOAL = '66666666-6666-4666-8666-666666666666';
const DELETED_GOAL = '55555555-5555-4555-8555-555555555555';
const LIVE_BUDGET = '77777777-7777-4777-8777-777777777777';
const DELETED_BUDGET = '88888888-8888-4888-8888-888888888888';

let supabase: ReturnType<typeof makeFakeSupabase>['client'];
const order: string[] = [];
let guardError: Error | null = null;

vi.mock('@/lib/action-guard', () => ({
  requireHouseholdContext: async () => {
    order.push('guard');
    if (guardError) throw guardError;
    return { userId: ME, kh: KH, supabase };
  },
}));

function setSupabase(opts: FakeSupabaseOptions = {}) {
  const fake = makeFakeSupabase({
    ...opts,
    selectDataByTable: {
      household_members: [
        { household_id: HOUSEHOLD_ID, user_id: ME },
        { household_id: HOUSEHOLD_ID, user_id: PARTNER },
      ],
      household_goals: [{ id: LIVE_GOAL }],
      household_spending_budgets: [{ id: LIVE_BUDGET }],
      household_planner_settings: null,
      ...opts.selectDataByTable,
    },
  });
  supabase = fake.client;
  return fake;
}

const storedSplit = (split: unknown) => ({
  split: encryptPayload(JSON.stringify(split), KH),
});

beforeEach(() => {
  order.length = 0;
  guardError = null;
  setSupabase();
});

describe('getPlannerSplit', () => {
  it('returns 50/50 flagged as default when no row exists', async () => {
    const { getPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    expect(await getPlannerSplit()).toEqual({
      members: { [ME]: 50, [PARTNER]: 50 },
      goalOverrides: {},
      budgetOverrides: {},
      isDefault: true,
      userId: ME,
    });
  });

  it('reads a blob saved before budget overrides existed as empty ones', async () => {
    setSupabase({
      selectDataByTable: {
        household_planner_settings: storedSplit({
          members: { [ME]: 60, [PARTNER]: 40 },
          goalOverrides: {},
        }),
      },
    });
    const { getPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    const split = await getPlannerSplit();
    expect(split.isDefault).toBe(false);
    expect(split.budgetOverrides).toEqual({});
  });

  it('hides overrides of deleted budgets', async () => {
    setSupabase({
      selectDataByTable: {
        household_planner_settings: storedSplit({
          members: { [ME]: 50, [PARTNER]: 50 },
          goalOverrides: {},
          budgetOverrides: {
            [LIVE_BUDGET]: { [ME]: 0, [PARTNER]: 100 },
            [DELETED_BUDGET]: { [ME]: 10, [PARTNER]: 90 },
          },
        }),
      },
    });
    const { getPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    expect((await getPlannerSplit()).budgetOverrides).toEqual({
      [LIVE_BUDGET]: { [ME]: 0, [PARTNER]: 100 },
    });
  });

  it('decrypts a saved split and hides overrides of deleted goals', async () => {
    setSupabase({
      selectDataByTable: {
        household_planner_settings: storedSplit({
          members: { [ME]: 50, [PARTNER]: 50 },
          goalOverrides: {
            [LIVE_GOAL]: { [ME]: 80, [PARTNER]: 20 },
            [DELETED_GOAL]: { [ME]: 10, [PARTNER]: 90 },
          },
        }),
      },
    });
    const { getPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    const split = await getPlannerSplit();
    expect(split.isDefault).toBe(false);
    expect(split.goalOverrides).toEqual({
      [LIVE_GOAL]: { [ME]: 80, [PARTNER]: 20 },
    });
  });

  it('reports an opaque error for a corrupt stored split', async () => {
    setSupabase({
      selectDataByTable: {
        household_planner_settings: storedSplit({
          members: { [ME]: 90, [PARTNER]: 90 },
          goalOverrides: {},
        }),
      },
    });
    const { getPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await expect(getPlannerSplit()).rejects.toThrow('unreadable');
  });

  it('reports an opaque error when decryption fails', async () => {
    setSupabase({
      selectDataByTable: {
        household_planner_settings: {
          split: encryptPayload(
            JSON.stringify({ members: { [ME]: 50, [PARTNER]: 50 } }),
            Buffer.alloc(32, 1)
          ),
        },
      },
    });
    const { getPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    const failure = getPlannerSplit();
    await expect(failure).rejects.toThrow('unreadable');
    await expect(failure).rejects.toMatchObject({ code: 'INTERNAL' });
  });

  it('falls back to the default when the stored members differ from the roster', async () => {
    setSupabase({
      selectDataByTable: {
        household_planner_settings: storedSplit({
          members: { [ME]: 70, [STRANGER]: 30 },
          goalOverrides: {},
        }),
      },
    });
    const { getPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    expect(await getPlannerSplit()).toEqual({
      members: { [ME]: 50, [PARTNER]: 50 },
      goalOverrides: {},
      budgetOverrides: {},
      isDefault: true,
      userId: ME,
    });
  });
});

describe('setPlannerSplit', () => {
  const valid = { members: { [ME]: 70, [PARTNER]: 30 } };
  const stored = {
    members: { [ME]: 50, [PARTNER]: 50 },
    goalOverrides: {
      [LIVE_GOAL]: { [ME]: 80, [PARTNER]: 20 },
      [OTHER_GOAL]: { [ME]: 10, [PARTNER]: 90 },
    },
    budgetOverrides: {
      [LIVE_BUDGET]: { [ME]: 25, [PARTNER]: 75 },
    },
  };
  const withStored = () =>
    setSupabase({
      selectDataByTable: {
        household_goals: [{ id: LIVE_GOAL }, { id: OTHER_GOAL }],
        household_planner_settings: storedSplit(stored),
      },
    });
  const writes = (fake: ReturnType<typeof setSupabase>) =>
    [...fake.calls.insert, ...fake.calls.update] as Array<{ split: string }>;
  const written = (fake: ReturnType<typeof setSupabase>) =>
    JSON.parse(decryptPayload(writes(fake)[0].split, KH));

  it('encrypts under K_h and inserts the first row per household', async () => {
    const fake = setSupabase();
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await setPlannerSplit(valid);

    expect(fake.calls.from).toContain('household_planner_settings');
    const row = fake.calls.insert[0] as Record<string, string>;
    expect(row.household_id).toBe(HOUSEHOLD_ID);
    expect(row.created_by).toBe(ME);
    expect(row.split).not.toContain(ME);
    expect(written(fake)).toEqual({
      ...valid,
      goalOverrides: {},
      budgetOverrides: {},
    });
  });

  it('keeps stored goal overrides on a members-only edit', async () => {
    const fake = withStored();
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await setPlannerSplit(valid);
    expect(written(fake)).toEqual({
      members: valid.members,
      goalOverrides: stored.goalOverrides,
      budgetOverrides: stored.budgetOverrides,
    });
  });

  it('updates only the edited budget, leaving goal overrides alone', async () => {
    const fake = withStored();
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await setPlannerSplit({
      budgetId: LIVE_BUDGET,
      override: { [ME]: 0, [PARTNER]: 100 },
    });
    expect(written(fake)).toEqual({
      ...stored,
      budgetOverrides: { [LIVE_BUDGET]: { [ME]: 0, [PARTNER]: 100 } },
    });
  });

  it('clears one budget override and prunes deleted budgets on write', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        household_planner_settings: storedSplit({
          ...stored,
          budgetOverrides: {
            [LIVE_BUDGET]: { [ME]: 25, [PARTNER]: 75 },
            [DELETED_BUDGET]: { [ME]: 0, [PARTNER]: 100 },
          },
        }),
      },
    });
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await setPlannerSplit(valid);
    expect(Object.keys(written(fake).budgetOverrides)).toEqual([LIVE_BUDGET]);
    await setPlannerSplit({ budgetId: LIVE_BUDGET, override: null });
    const last = JSON.parse(decryptPayload(writes(fake)[1].split, KH));
    expect(last.budgetOverrides).toEqual({});
  });

  it('updates only the edited goal and keeps members and other overrides', async () => {
    const fake = withStored();
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await setPlannerSplit({
      goalId: LIVE_GOAL,
      override: { [ME]: 30, [PARTNER]: 70 },
    });
    expect(written(fake)).toEqual({
      members: stored.members,
      goalOverrides: {
        [LIVE_GOAL]: { [ME]: 30, [PARTNER]: 70 },
        [OTHER_GOAL]: stored.goalOverrides[OTHER_GOAL],
      },
      budgetOverrides: stored.budgetOverrides,
    });
  });

  it('removes only the named override when it is cleared', async () => {
    const fake = withStored();
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await setPlannerSplit({ goalId: LIVE_GOAL, override: null });
    expect(written(fake)).toEqual({
      members: stored.members,
      goalOverrides: { [OTHER_GOAL]: stored.goalOverrides[OTHER_GOAL] },
      budgetOverrides: stored.budgetOverrides,
    });
  });

  it('prunes overrides of deleted goals on write', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        household_planner_settings: storedSplit({
          members: stored.members,
          goalOverrides: {
            [LIVE_GOAL]: { [ME]: 100, [PARTNER]: 0 },
            [DELETED_GOAL]: { [ME]: 0, [PARTNER]: 100 },
          },
        }),
      },
    });
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await setPlannerSplit(valid);
    expect(Object.keys(written(fake).goalOverrides)).toEqual([LIVE_GOAL]);
  });

  it('authenticates before validating input', async () => {
    const fake = setSupabase();
    guardError = new Error('not signed in');
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await expect(setPlannerSplit({ members: 'junk' })).rejects.toThrow(
      'not signed in'
    );
    expect(order).toEqual(['guard']);
    expect(writes(fake)).toHaveLength(0);
  });

  it('rejects invalid input before any database access', async () => {
    const fake = setSupabase();
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await expect(
      setPlannerSplit({ members: { [ME]: 60, [PARTNER]: 60 } })
    ).rejects.toThrow('invalid input');
    expect(fake.calls.from).toHaveLength(0);
    expect(writes(fake)).toHaveLength(0);
  });

  it('rejects ids that are not the two household members', async () => {
    const fake = setSupabase();
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await expect(
      setPlannerSplit({ members: { [ME]: 50, [STRANGER]: 50 } })
    ).rejects.toThrow('both household members');
    expect(writes(fake)).toHaveLength(0);
  });

  it('rejects a write while the partner has not joined', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        household_members: [{ household_id: HOUSEHOLD_ID, user_id: ME }],
      },
    });
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await expect(setPlannerSplit(valid)).rejects.toThrow('both household');
    expect(writes(fake)).toHaveLength(0);
  });

  it('conditions the update on the version it read', async () => {
    const fake = withStored();
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await setPlannerSplit(valid);
    const query = fake.calls.queries.find((q) => q.operation === 'update');
    expect(query?.eq.map((e) => e.column)).toEqual([
      'household_id',
      'updated_at',
    ]);
  });

  it('re-reads and re-merges when the partner wrote first', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        household_goals: [{ id: LIVE_GOAL }, { id: OTHER_GOAL }],
        household_planner_settings: storedSplit(stored),
      },
      updateResult: (call) => ({ data: call === 0 ? [] : [{}], error: null }),
    });
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await setPlannerSplit(valid);
    expect(fake.calls.update).toHaveLength(2);
    expect(
      fake.calls.queries.filter(
        (q) =>
          q.table === 'household_planner_settings' && q.operation === 'read'
      )
    ).toHaveLength(2);
  });

  it('gives up with an opaque error after three lost races', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        household_planner_settings: storedSplit(stored),
      },
      updateResult: () => ({ data: [], error: null }),
    });
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await expect(setPlannerSplit(valid)).rejects.toThrow('same time');
    expect(fake.calls.update).toHaveLength(3);
  });

  it('retries when a concurrent first insert wins', async () => {
    const fake = setSupabase({
      insertError: { message: 'duplicate', code: '23505' },
    });
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await expect(setPlannerSplit(valid)).rejects.toThrow('same time');
    expect(fake.calls.insert).toHaveLength(3);
  });

  it('rejects a merged split that exceeds the override limit', async () => {
    const many = Object.fromEntries(
      Array.from({ length: 500 }, (_, i) => [
        `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        { [ME]: 50, [PARTNER]: 50 },
      ])
    );
    const ids = Object.keys(many);
    const fake = setSupabase({
      selectDataByTable: {
        household_goals: [...ids.map((id) => ({ id })), { id: LIVE_GOAL }],
        household_planner_settings: storedSplit({
          members: stored.members,
          goalOverrides: many,
          budgetOverrides: {},
        }),
      },
    });
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await expect(
      setPlannerSplit({
        goalId: LIVE_GOAL,
        override: { [ME]: 10, [PARTNER]: 90 },
      })
    ).rejects.toThrow('allowed size');
    expect(writes(fake)).toHaveLength(0);
  });

  it('surfaces an opaque error on a write failure', async () => {
    setSupabase({ insertError: { message: 'relation leaked_table denied' } });
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    const failure = setPlannerSplit(valid);
    await expect(failure).rejects.toThrow('household planner write failed');
    await expect(failure).rejects.not.toThrow('leaked_table');
  });
});
