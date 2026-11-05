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
const DELETED_GOAL = '55555555-5555-4555-8555-555555555555';

let supabase: ReturnType<typeof makeFakeSupabase>['client'];
const order: string[] = [];

vi.mock('@/lib/action-guard', () => ({
  requireHouseholdContext: async () => {
    order.push('guard');
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
  setSupabase();
});

describe('getPlannerSplit', () => {
  it('returns 50/50 flagged as default when no row exists', async () => {
    const { getPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    expect(await getPlannerSplit()).toEqual({
      members: { [ME]: 50, [PARTNER]: 50 },
      goalOverrides: {},
      isDefault: true,
      userId: ME,
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
});

describe('setPlannerSplit', () => {
  const valid = { members: { [ME]: 70, [PARTNER]: 30 }, goalOverrides: {} };

  it('encrypts under K_h and upserts one row per household', async () => {
    const fake = setSupabase();
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await setPlannerSplit(valid);

    expect(fake.calls.from).toContain('household_planner_settings');
    const row = fake.calls.upsert[0] as Record<string, string>;
    expect(row.household_id).toBe(HOUSEHOLD_ID);
    expect(row.created_by).toBe(ME);
    expect(row.split).not.toContain(ME);
    expect(JSON.parse(decryptPayload(row.split, KH))).toEqual(valid);
  });

  it('prunes overrides of deleted goals on write', async () => {
    const fake = setSupabase();
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await setPlannerSplit({
      members: valid.members,
      goalOverrides: {
        [LIVE_GOAL]: { [ME]: 100, [PARTNER]: 0 },
        [DELETED_GOAL]: { [ME]: 0, [PARTNER]: 100 },
      },
    });
    const row = fake.calls.upsert[0] as Record<string, string>;
    expect(
      Object.keys(JSON.parse(decryptPayload(row.split, KH)).goalOverrides)
    ).toEqual([LIVE_GOAL]);
  });

  it('rejects invalid input before the guard or any database access', async () => {
    const fake = setSupabase();
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await expect(
      setPlannerSplit({
        members: { [ME]: 60, [PARTNER]: 60 },
        goalOverrides: {},
      })
    ).rejects.toThrow('invalid input');
    expect(order).toHaveLength(0);
    expect(fake.calls.upsert).toHaveLength(0);
  });

  it('rejects ids that are not the two household members', async () => {
    const fake = setSupabase();
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    await expect(
      setPlannerSplit({
        members: { [ME]: 50, [STRANGER]: 50 },
        goalOverrides: {},
      })
    ).rejects.toThrow('both household members');
    expect(fake.calls.upsert).toHaveLength(0);
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
    expect(fake.calls.upsert).toHaveLength(0);
  });

  it('surfaces an opaque error on a write failure', async () => {
    setSupabase({ upsertError: { message: 'relation leaked_table denied' } });
    const { setPlannerSplit } =
      await import('@/features/household/actions/planner-actions');
    const failure = setPlannerSplit(valid);
    await expect(failure).rejects.toThrow('household planner write failed');
    await expect(failure).rejects.not.toThrow('leaked_table');
  });
});
