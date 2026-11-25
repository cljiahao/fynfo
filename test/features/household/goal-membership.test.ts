import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const USER_ID = '023e4567-e89b-42d3-a456-426614174000';
const KH = Buffer.alloc(32, 9);
const GOAL = '123e4567-e89b-42d3-a456-426614174000';
const DATE = '2026-11-19';
const U2 = '223e4567-e89b-42d3-a456-426614174000';
const U3 = '323e4567-e89b-42d3-a456-426614174000';
const U4 = '423e4567-e89b-42d3-a456-426614174000';
const OUTSIDER = '523e4567-e89b-42d3-a456-426614174000';

let supabase: ReturnType<typeof makeFakeSupabase>['client'];
let guardCalls: string[];

vi.mock('@/lib/action-guard', () => ({
  requireHouseholdContext: async () => {
    guardCalls.push('guard');
    return { userId: USER_ID, kh: KH, supabase };
  },
}));

function setSupabase(opts: FakeSupabaseOptions = {}) {
  const fake = makeFakeSupabase(opts);
  supabase = fake.client;
  return fake;
}

const rows = (...ids: string[]) =>
  ids.map((user_id) => ({ household_id: 'h1', goal_id: GOAL, user_id }));

beforeEach(() => {
  guardCalls = [];
  setSupabase();
});

describe('joinGoal', () => {
  it('adds the caller, never another user', async () => {
    const fake = setSupabase();
    const { joinGoal } =
      await import('@/features/household/actions/goal-member-actions');
    await joinGoal(GOAL);
    expect(fake.calls.from).toEqual([
      'household_goal_members',
      'household_goal_members',
    ]);
    expect(fake.calls.upsert).toEqual([{ goal_id: GOAL, user_id: USER_ID }]);
  });

  it('is a no-op for a caller already on a full goal', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        household_goal_members: rows(USER_ID, U2, U3, U4),
      },
    });
    const { joinGoal } =
      await import('@/features/household/actions/goal-member-actions');
    await expect(joinGoal(GOAL)).resolves.toBeUndefined();
    expect(fake.calls.upsert).toEqual([]);
  });

  it('rejects a malformed goal id before any database access', async () => {
    const fake = setSupabase();
    const { joinGoal } =
      await import('@/features/household/actions/goal-member-actions');
    await expect(joinGoal('nope')).rejects.toThrow();
    expect(fake.calls.from).toHaveLength(0);
  });

  it('hides the database message when the cap or household trigger fires', async () => {
    setSupabase({
      upsertError: { message: 'goal is full', code: 'P0001' },
    });
    const { joinGoal } =
      await import('@/features/household/actions/goal-member-actions');
    const error = await joinGoal(GOAL).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain('goal is full');
  });
});

describe('leaveGoal', () => {
  it.each([2, 3, 4])(
    'removes only the caller from a %i-member goal',
    async (n) => {
      const members = [USER_ID, U2, U3, U4].slice(0, n);
      const fake = setSupabase({
        selectDataByTable: { household_goal_members: rows(...members) },
      });
      const { leaveGoal } =
        await import('@/features/household/actions/goal-member-actions');
      await leaveGoal(GOAL);
      expect(fake.calls.delete).toBe(1);
      const del = fake.calls.queries.find((q) => q.operation === 'delete');
      expect(del?.eq).toEqual([
        { column: 'goal_id', value: GOAL },
        { column: 'user_id', value: USER_ID },
      ]);
    }
  );

  it('rejects the last member leaving', async () => {
    const fake = setSupabase({
      selectDataByTable: { household_goal_members: rows(USER_ID) },
    });
    const { leaveGoal } =
      await import('@/features/household/actions/goal-member-actions');
    await expect(leaveGoal(GOAL)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    expect(fake.calls.delete).toBe(0);
  });

  it('rejects leaving a goal the caller is not on', async () => {
    const fake = setSupabase({
      selectDataByTable: { household_goal_members: rows(U2, U3) },
    });
    const { leaveGoal } =
      await import('@/features/household/actions/goal-member-actions');
    await expect(leaveGoal(GOAL)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    expect(fake.calls.delete).toBe(0);
  });

  it('enters through the household guard first', async () => {
    setSupabase({
      selectDataByTable: { household_goal_members: rows(USER_ID, U2) },
    });
    const { leaveGoal } =
      await import('@/features/household/actions/goal-member-actions');
    await leaveGoal(GOAL);
    expect(guardCalls).toEqual(['guard']);
  });
});

describe('payer resolution with an explicit payer', () => {
  const chain = {
    household_goals: [{ household_id: 'h1' }],
    household_goal_items: [{ goal_id: GOAL }],
  };
  const input = { goalId: GOAL, amount: 10, date: DATE };

  async function contribute(payerUserId: string, opts: FakeSupabaseOptions) {
    const fake = setSupabase({ selectDataByTable: chain, ...opts });
    const { addContribution } =
      await import('@/features/household/actions/goal-actions');
    const result = addContribution({ ...input, payerUserId });
    return { fake, result };
  }

  it('accepts any of three household members on a goal without membership rows', async () => {
    const roster = rows(USER_ID, U2, U3);
    for (const payer of [USER_ID, U2, U3]) {
      const { fake, result } = await contribute(payer, {
        selectDataByTable: { ...chain, household_members: roster },
      });
      await result;
      expect(fake.calls.insert[0]).toMatchObject({
        contributor_user_id: payer,
      });
    }
  });

  it('rejects a user outside the household', async () => {
    const { fake, result } = await contribute(OUTSIDER, {
      selectDataByTable: {
        ...chain,
        household_members: rows(USER_ID, U2, U3),
      },
    });
    await expect(result).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('rejects a household member who is not on the goal', async () => {
    const { fake, result } = await contribute(U3, {
      selectDataByTable: {
        ...chain,
        household_members: rows(USER_ID, U2, U3, U4),
        household_goal_members: rows(USER_ID, U2),
      },
    });
    await expect(result).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('accepts a goal member', async () => {
    const { fake, result } = await contribute(U2, {
      selectDataByTable: {
        ...chain,
        household_members: rows(USER_ID, U2, U3, U4),
        household_goal_members: rows(USER_ID, U2),
      },
    });
    await result;
    expect(fake.calls.insert[0]).toMatchObject({ contributor_user_id: U2 });
  });

  it('reads the roster of the goal household', async () => {
    const { fake, result } = await contribute(U2, {
      selectDataByTable: {
        ...chain,
        household_goals: [{ household_id: 'h9' }],
        household_members: rows(USER_ID, U2),
      },
    });
    await result;
    const roster = fake.calls.queries.find(
      (q) => q.table === 'household_members'
    );
    expect(roster?.eq).toContainEqual({ column: 'household_id', value: 'h9' });
  });

  it('rejects the legacy partner role when it is ambiguous', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        ...chain,
        household_members: rows(USER_ID, U2, U3),
      },
    });
    const { addContribution } =
      await import('@/features/household/actions/goal-actions');
    await expect(
      addContribution({ ...input, paidBy: 'partner' })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('rejects a payer that is not a uuid', async () => {
    const { addContribution } =
      await import('@/features/household/actions/goal-actions');
    await expect(
      addContribution({ ...input, payerUserId: 'user-2' })
    ).rejects.toThrow();
  });
});

describe('goal creation', () => {
  it('adds the creator as the first goal member', async () => {
    const fake = setSupabase({
      selectDataByTable: { household_members: [{ household_id: 'h1' }] },
    });
    const { createGoal } =
      await import('@/features/household/actions/goal-actions');
    await createGoal({ name: 'Trip', targetAmount: 1000 });
    const [goal, member] = fake.calls.insert as Record<string, string>[];
    expect(member).toEqual({ goal_id: goal.id, user_id: USER_ID });
  });
});
