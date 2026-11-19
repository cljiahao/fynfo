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

const USER_ID = 'user-1';
const PARTNER_ID = 'user-2';
const KH = Buffer.alloc(32, 9);
const ID = '123e4567-e89b-42d3-a456-426614174000';
const DATE = '2026-11-19';

let supabase: ReturnType<typeof makeFakeSupabase>['client'];

vi.mock('@/lib/action-guard', () => ({
  requireHouseholdContext: async () => ({ userId: USER_ID, kh: KH, supabase }),
}));

const TWO_MEMBERS = [
  { household_id: 'h1', user_id: USER_ID },
  { household_id: 'h1', user_id: PARTNER_ID },
];
const ONE_MEMBER = [{ household_id: 'h1', user_id: USER_ID }];

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
] as const)('%s paidBy', (_name, schema, base) => {
  const input = { ...base, amount: 5, date: DATE };

  it.each([undefined, 'self', 'partner'])('accepts %s', (paidBy) => {
    expect(schema.safeParse({ ...input, paidBy }).success).toBe(true);
  });

  it.each(['other', ID, ''])('rejects %s', (paidBy) => {
    expect(schema.safeParse({ ...input, paidBy }).success).toBe(false);
  });
});

describe('paid-by create actions', () => {
  it.each([
    ['addItemPayment', 'payer_user_id', { itemId: ID }],
    ['addContribution', 'contributor_user_id', { goalId: ID }],
  ] as const)('%s attributes by role', async (fn, column, base) => {
    const actions = await import('@/features/household/actions/goal-actions');
    const input = { ...base, amount: 10, date: DATE };

    let fake = setSupabase({
      selectDataByTable: { household_members: TWO_MEMBERS },
    });
    await actions[fn](input);
    expect((fake.calls.insert[0] as Record<string, string>)[column]).toBe(
      USER_ID
    );

    fake = setSupabase({
      selectDataByTable: { household_members: TWO_MEMBERS },
    });
    await actions[fn]({ ...input, paidBy: 'self' });
    expect((fake.calls.insert[0] as Record<string, string>)[column]).toBe(
      USER_ID
    );

    fake = setSupabase({
      selectDataByTable: { household_members: TWO_MEMBERS },
    });
    await actions[fn]({ ...input, paidBy: 'partner' });
    expect((fake.calls.insert[0] as Record<string, string>)[column]).toBe(
      PARTNER_ID
    );
  });

  it.each([
    ['addItemPayment', { itemId: ID }],
    ['addContribution', { goalId: ID }],
  ] as const)(
    '%s rejects partner in a one-member household',
    async (fn, base) => {
      const fake = setSupabase({
        selectDataByTable: { household_members: ONE_MEMBER },
      });
      const actions = await import('@/features/household/actions/goal-actions');
      await expect(
        actions[fn]({ ...base, amount: 10, date: DATE, paidBy: 'partner' })
      ).rejects.toMatchObject({ code: 'VALIDATION' });
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
] as const)('%s paidBy', (fn, base, column, table) => {
  const input = { ...base, amount: 10, date: DATE };

  it('leaves the attribution column out when paidBy is omitted', async () => {
    const fake = setSupabase({
      selectDataByTable: { [table]: [{ id: ID }] },
    });
    const actions = await import('@/features/household/actions/goal-actions');
    await actions[fn](input);
    expect(fake.calls.update[0]).not.toHaveProperty(column);
  });

  it('changes the attribution when paidBy is set', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        [table]: [{ id: ID }],
        household_members: TWO_MEMBERS,
      },
    });
    const actions = await import('@/features/household/actions/goal-actions');
    await actions[fn]({ ...input, paidBy: 'partner' });
    expect(fake.calls.update[0]).toMatchObject({ [column]: PARTNER_ID });
    await actions[fn]({ ...input, paidBy: 'self' });
    expect(fake.calls.update[1]).toMatchObject({ [column]: USER_ID });
  });
});
