import {
  addContributionSchema,
  addItemPaymentSchema,
  updateGoalContributionSchema,
  updateGoalPaymentSchema,
} from '@/features/household/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const KH = Buffer.alloc(32, 9);
const ID = '123e4567-e89b-42d3-a456-426614174000';
const DATE = '2026-11-19';

let supabase: ReturnType<typeof makeFakeSupabase>['client'];

vi.mock('@/lib/action-guard', () => ({
  requireHouseholdContext: async () => ({ userId: USER_ID, kh: KH, supabase }),
}));

const TWO_MEMBERS = [
  { household_id: 'h1', user_id: USER_ID },
  { household_id: 'h1', user_id: OTHER_ID },
];
const ONE_MEMBER = [{ household_id: 'h1', user_id: USER_ID }];
const CHAIN = {
  household_goals: [{ household_id: 'h1' }],
  household_goal_items: [{ goal_id: ID }],
};

function setSupabase(opts: FakeSupabaseOptions = {}) {
  const fake = makeFakeSupabase(opts);
  supabase = fake.client;
  return fake;
}

beforeEach(() => {
  setSupabase();
});

describe.each([
  ['addItemPaymentSchema', addItemPaymentSchema, { itemId: ID }],
  ['addContributionSchema', addContributionSchema, { goalId: ID }],
  ['updateGoalPaymentSchema', updateGoalPaymentSchema, { paymentId: ID }],
  [
    'updateGoalContributionSchema',
    updateGoalContributionSchema,
    { contributionId: ID },
  ],
] as const)('%s payerUserId', (_name, schema, base) => {
  const input = { ...base, amount: 5, date: DATE };

  it.each([undefined, OTHER_ID])('accepts %s', (payerUserId) => {
    expect(schema.safeParse({ ...input, payerUserId }).success).toBe(true);
  });

  it.each(['self', 'partner', 'other', ''])('rejects %s', (payerUserId) => {
    expect(schema.safeParse({ ...input, payerUserId }).success).toBe(false);
  });
});

describe('payer create actions', () => {
  it.each([
    ['addItemPayment', 'payer_user_id', { itemId: ID }],
    ['addContribution', 'contributor_user_id', { goalId: ID }],
  ] as const)('%s attributes to the named payer', async (fn, column, base) => {
    const actions = await import('@/features/household/actions/goal-actions');
    const input = { ...base, amount: 10, date: DATE };

    let fake = setSupabase({
      selectDataByTable: { ...CHAIN, household_members: TWO_MEMBERS },
    });
    await actions[fn](input);
    expect((fake.calls.insert[0] as Record<string, string>)[column]).toBe(
      USER_ID
    );

    fake = setSupabase({
      selectDataByTable: { ...CHAIN, household_members: TWO_MEMBERS },
    });
    await actions[fn]({ ...input, payerUserId: USER_ID });
    expect((fake.calls.insert[0] as Record<string, string>)[column]).toBe(
      USER_ID
    );

    fake = setSupabase({
      selectDataByTable: { ...CHAIN, household_members: TWO_MEMBERS },
    });
    await actions[fn]({ ...input, payerUserId: OTHER_ID });
    expect((fake.calls.insert[0] as Record<string, string>)[column]).toBe(
      OTHER_ID
    );
  });

  it.each([
    ['addItemPayment', { itemId: ID }],
    ['addContribution', { goalId: ID }],
  ] as const)('%s rejects a payer outside the household', async (fn, base) => {
    const fake = setSupabase({
      selectDataByTable: { ...CHAIN, household_members: ONE_MEMBER },
    });
    const actions = await import('@/features/household/actions/goal-actions');
    await expect(
      actions[fn]({ ...base, amount: 10, date: DATE, payerUserId: OTHER_ID })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(fake.calls.insert).toHaveLength(0);
  });

  it.each([
    ['addItemPayment', { itemId: ID }],
    ['addContribution', { goalId: ID }],
  ] as const)('%s reads the roster of the goal household', async (fn, base) => {
    const fake = setSupabase({
      selectDataByTable: {
        ...CHAIN,
        household_goals: [{ household_id: 'h2' }],
        household_members: TWO_MEMBERS,
      },
    });
    const actions = await import('@/features/household/actions/goal-actions');
    await actions[fn]({
      ...base,
      amount: 10,
      date: DATE,
      payerUserId: OTHER_ID,
    });
    const roster = fake.calls.queries.find(
      (q) => q.table === 'household_members'
    );
    expect(roster?.eq).toContainEqual({
      column: 'household_id',
      value: 'h2',
    });
  });

  it.each([
    ['addItemPayment', { itemId: ID }],
    ['addContribution', { goalId: ID }],
  ] as const)(
    '%s writes nothing when the goal is not visible',
    async (fn, base) => {
      const fake = setSupabase({
        selectDataByTable: { household_goals: [], household_goal_items: [] },
      });
      const actions = await import('@/features/household/actions/goal-actions');
      await expect(
        actions[fn]({ ...base, amount: 10, date: DATE, payerUserId: OTHER_ID })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(fake.calls.insert).toHaveLength(0);
    }
  );
});

describe.each([
  [
    'updateGoalPayment',
    { paymentId: ID },
    'payer_user_id',
    'household_goal_payments',
  ],
  [
    'updateGoalContribution',
    { contributionId: ID },
    'contributor_user_id',
    'household_goal_contributions',
  ],
] as const)('%s payerUserId', (fn, base, column, table) => {
  const input = { ...base, amount: 10, date: DATE };

  it('leaves the attribution column out when payerUserId is omitted', async () => {
    const fake = setSupabase({
      selectDataByTable: { [table]: [{ id: ID }] },
    });
    const actions = await import('@/features/household/actions/goal-actions');
    await actions[fn](input);
    expect(fake.calls.update[0]).not.toHaveProperty(column);
  });

  it('changes the attribution when payerUserId is set', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        ...CHAIN,
        [table]: [{ id: ID, item_id: ID, goal_id: ID }],
        household_members: TWO_MEMBERS,
      },
    });
    const actions = await import('@/features/household/actions/goal-actions');
    await actions[fn]({ ...input, payerUserId: OTHER_ID });
    expect(fake.calls.update[0]).toMatchObject({ [column]: OTHER_ID });
    await actions[fn]({ ...input, payerUserId: USER_ID });
    expect(fake.calls.update[1]).toMatchObject({ [column]: USER_ID });
  });

  it('writes nothing for a payer outside the household', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        ...CHAIN,
        [table]: [{ id: ID, item_id: ID, goal_id: ID }],
        household_members: ONE_MEMBER,
      },
    });
    const actions = await import('@/features/household/actions/goal-actions');
    await expect(
      actions[fn]({ ...input, payerUserId: OTHER_ID })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(fake.calls.update).toHaveLength(0);
  });
});
