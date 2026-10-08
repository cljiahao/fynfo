import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const USER_ID = 'user-1';
const PARTNER_ID = 'user-2';
const KH = Buffer.alloc(32, 9);

let supabase: ReturnType<typeof makeFakeSupabase>['client'];

vi.mock('@/lib/action-guard', () => ({
  requireHouseholdContext: async () => ({ userId: USER_ID, kh: KH, supabase }),
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

describe('goal-actions — getGoals', () => {
  it('decrypts goals + contributions and attaches progress, flagging self vs partner', async () => {
    setSupabase({
      selectDataByTable: {
        household_goals: [
          {
            id: 'g1',
            name: encryptPayload('Sofa', KH),
            target_amount: encryptPayload('1000', KH),
            target_date: '2026-12-01',
            created_at: '2026-06-27',
          },
        ],
        household_goal_contributions: [
          {
            id: 'c1',
            goal_id: 'g1',
            contributor_user_id: USER_ID,
            amount: encryptPayload('300', KH),
            note: encryptPayload('first', KH),
            date: '2026-06-20',
          },
          {
            id: 'c2',
            goal_id: 'g1',
            contributor_user_id: PARTNER_ID,
            amount: encryptPayload('200', KH),
            note: null,
            date: '2026-06-21',
          },
        ],
      },
    });
    const { getGoals } =
      await import('@/features/household/actions/goal-actions');
    const goals = await getGoals();

    expect(goals).toHaveLength(1);
    const g = goals[0];
    expect(g.name).toBe('Sofa');
    expect(g.targetAmount).toBe(1000);
    expect(g.contributed).toBe(500);
    expect(g.remaining).toBe(500);
    expect(g.pct).toBe(50);
    expect(g.contributions).toHaveLength(2);
    expect(g.contributions[0]).toMatchObject({ amount: 300, isSelf: true });
    expect(g.contributions[1]).toMatchObject({ amount: 200, isSelf: false });
  });

  it('returns [] when there are no goals (skips the contributions read)', async () => {
    const fake = setSupabase({ selectDataByTable: { household_goals: [] } });
    const { getGoals } =
      await import('@/features/household/actions/goal-actions');
    expect(await getGoals()).toEqual([]);
    expect(fake.calls.from).not.toContain('household_goal_contributions');
  });

  it('throws an opaque error on a goals read failure', async () => {
    setSupabase({ selectError: { message: 'permission denied' } });
    const { getGoals } =
      await import('@/features/household/actions/goal-actions');
    await expect(getGoals()).rejects.toThrow('household goals read failed');
  });
});

describe('goal-actions — createGoal', () => {
  const VALID = { name: 'Sofa', targetAmount: 1000, targetDate: '2026-12-01' };

  it('seals name + target amount before insert', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        household_members: [{ household_id: 'h1' }],
      },
    });
    const { createGoal } =
      await import('@/features/household/actions/goal-actions');
    await createGoal(VALID);

    const row = fake.calls.insert[0] as Record<string, string>;
    expect(row.household_id).toBe('h1');
    expect(row.created_by).toBe(USER_ID);
    expect(row.target_date).toBe('2026-12-01');
    expect(row.name).not.toBe('Sofa');
    expect(decryptPayload(row.name, KH)).toBe('Sofa');
    expect(decryptPayload(row.target_amount, KH)).toBe('1000');
  });

  it('rejects invalid input before any DB write', async () => {
    const fake = setSupabase({
      selectDataByTable: { household_members: [{ household_id: 'h1' }] },
    });
    const { createGoal } =
      await import('@/features/household/actions/goal-actions');
    await expect(createGoal({ ...VALID, targetAmount: -5 })).rejects.toThrow();
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('surfaces an opaque error on an insert failure', async () => {
    setSupabase({
      selectDataByTable: { household_members: [{ household_id: 'h1' }] },
      insertError: { message: 'permission denied' },
    });
    const { createGoal } =
      await import('@/features/household/actions/goal-actions');
    await expect(createGoal(VALID)).rejects.toThrow(
      'household goal create failed'
    );
  });
});

describe('goal-actions — addContribution', () => {
  const VALID = {
    goalId: '123e4567-e89b-42d3-a456-426614174000',
    amount: 250,
    note: 'bonus',
    date: '2026-06-25',
  };

  it('seals amount + note, attributes to the caller', async () => {
    const fake = setSupabase();
    const { addContribution } =
      await import('@/features/household/actions/goal-actions');
    await addContribution(VALID);

    const row = fake.calls.insert[0] as Record<string, string>;
    expect(row.goal_id).toBe(VALID.goalId);
    expect(row.contributor_user_id).toBe(USER_ID);
    expect(decryptPayload(row.amount, KH)).toBe('250');
    expect(decryptPayload(row.note as string, KH)).toBe('bonus');
  });

  it('rejects invalid input before any DB write', async () => {
    const fake = setSupabase();
    const { addContribution } =
      await import('@/features/household/actions/goal-actions');
    await expect(addContribution({ ...VALID, amount: 0 })).rejects.toThrow();
    expect(fake.calls.insert).toHaveLength(0);
  });
});

describe('goal-actions — deleteGoal', () => {
  it('issues a scoped delete on household_goals', async () => {
    const fake = setSupabase();
    const { deleteGoal } =
      await import('@/features/household/actions/goal-actions');
    await deleteGoal('g1');
    expect(fake.calls.from).toContain('household_goals');
    expect(fake.calls.delete).toBe(1);
    expect(
      fake.calls.queries.find(
        (query) =>
          query.table === 'household_goals' && query.operation === 'delete'
      )?.eq
    ).toEqual([{ column: 'id', value: 'g1' }]);
  });

  it('surfaces an opaque error on a delete failure', async () => {
    setSupabase({ selectError: { message: 'permission denied' } });
    const { deleteGoal } =
      await import('@/features/household/actions/goal-actions');
    await expect(deleteGoal('g1')).rejects.toThrow(
      'household goal delete failed'
    );
  });
});
