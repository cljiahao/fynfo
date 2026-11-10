import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const USER_ID = 'user-1';
const KH = Buffer.alloc(32, 9);
const GOAL_ID = '3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b';
const ITEM_A = '11111111-1111-4111-8111-111111111111';
const ITEM_B = '22222222-2222-4222-8222-222222222222';
const ITEM_C = '33333333-3333-4333-8333-333333333333';
const ROW_ID = '44444444-4444-4444-8444-444444444444';

let supabase: ReturnType<typeof makeFakeSupabase>['client'];
const order: string[] = [];

vi.mock('@/lib/action-guard', () => ({
  requireHouseholdContext: async () => {
    order.push('guard');
    return { userId: USER_ID, kh: KH, supabase };
  },
}));

function setSupabase(opts: FakeSupabaseOptions = {}) {
  const fake = makeFakeSupabase(opts);
  supabase = fake.client;
  return fake;
}

function itemRow(id: string, name: string, budget: number) {
  return {
    id,
    name: encryptPayload(name, KH),
    budget: encryptPayload(String(budget), KH),
    quote: null,
  };
}

beforeEach(() => {
  order.length = 0;
  setSupabase();
});

describe('saveGoal', () => {
  it('creates the goal and one insert per item, in draft order', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        household_goals: [],
        household_members: [{ household_id: 'h1' }],
      },
    });
    const { saveGoal } =
      await import('@/features/household/actions/goal-actions');
    const result = await saveGoal({
      goalId: GOAL_ID,
      name: 'Wedding',
      target: 5000,
      items: [
        { id: ITEM_A, name: 'Venue', budget: 3000 },
        { name: 'Photo', budget: 800, quote: 700 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.goalId).toBe(GOAL_ID);
    expect(result.itemIds[0]).toBe(ITEM_A);
    expect(result.itemIds).toHaveLength(2);
    expect(fake.calls.insert).toHaveLength(3);
    const goalRow = fake.calls.insert[0] as Record<string, string>;
    expect(decryptPayload(goalRow.name, KH)).toBe('Wedding');
    const second = fake.calls.insert[2] as Record<string, string>;
    expect(decryptPayload(second.quote, KH)).toBe('700');
    expect(second.id).toBe(result.itemIds[1]);
  });

  it('updates changed rows, inserts new ones and removes dropped ones', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        household_goals: [{ id: GOAL_ID }],
        household_goal_items: [
          itemRow(ITEM_A, 'Venue', 3000),
          itemRow(ITEM_B, 'Cake', 200),
        ],
      },
    });
    const { saveGoal } =
      await import('@/features/household/actions/goal-actions');
    const result = await saveGoal({
      goalId: GOAL_ID,
      name: 'Wedding',
      target: 6000,
      items: [
        { id: ITEM_A, name: 'Venue', budget: 3500 },
        { id: ITEM_C, name: 'Rings', budget: 900 },
      ],
    });
    expect(result.ok).toBe(true);
    expect(fake.calls.update).toHaveLength(2);
    expect(fake.calls.insert).toHaveLength(1);
    expect((fake.calls.insert[0] as { id: string }).id).toBe(ITEM_C);
    expect(fake.calls.delete).toBe(1);
    const removed = fake.calls.queries.find((q) => q.operation === 'delete');
    expect(removed?.in[0]?.values).toEqual([ITEM_B]);
    expect(removed?.eq).toContainEqual({ column: 'goal_id', value: GOAL_ID });
    const updates = fake.calls.queries.filter(
      (q) => q.table === 'household_goal_items' && q.operation === 'update'
    );
    expect(updates).toHaveLength(1);
    expect(updates[0]?.eq).toContainEqual({
      column: 'goal_id',
      value: GOAL_ID,
    });
  });

  it('skips the write for an unchanged existing row', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        household_goals: [{ id: GOAL_ID }],
        household_goal_items: [itemRow(ITEM_A, 'Venue', 3000)],
      },
    });
    const { saveGoal } =
      await import('@/features/household/actions/goal-actions');
    await saveGoal({
      goalId: GOAL_ID,
      name: 'Wedding',
      target: 6000,
      items: [{ id: ITEM_A, name: 'Venue', budget: 3000 }],
    });
    expect(fake.calls.update).toHaveLength(1);
    expect(fake.calls.insert).toHaveLength(0);
    expect(fake.calls.delete).toBe(0);
  });

  it('writes the item due date and null when none is set', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        household_goals: [],
        household_members: [{ household_id: 'h1' }],
      },
    });
    const { saveGoal } =
      await import('@/features/household/actions/goal-actions');
    const result = await saveGoal({
      goalId: GOAL_ID,
      name: 'Wedding',
      target: 5000,
      items: [
        { name: 'Deposit', budget: 1000, dueDate: '2027-01-15' },
        { name: 'Balance', budget: 2000 },
      ],
    });
    expect(result.ok).toBe(true);
    expect((fake.calls.insert[1] as Record<string, unknown>).due_date).toBe(
      '2027-01-15'
    );
    expect((fake.calls.insert[2] as Record<string, unknown>).due_date).toBe(
      null
    );
  });

  it('diffs the due date: unchanged skips, changed updates', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        household_goals: [{ id: GOAL_ID }],
        household_goal_items: [
          { ...itemRow(ITEM_A, 'Venue', 3000), due_date: '2027-01-15' },
          { ...itemRow(ITEM_B, 'Cake', 200), due_date: null },
        ],
      },
    });
    const { saveGoal } =
      await import('@/features/household/actions/goal-actions');
    await saveGoal({
      goalId: GOAL_ID,
      name: 'Wedding',
      target: 6000,
      items: [
        { id: ITEM_A, name: 'Venue', budget: 3000, dueDate: '2027-01-15' },
        { id: ITEM_B, name: 'Cake', budget: 200, dueDate: '2027-02-01' },
      ],
    });
    const updates = fake.calls.queries.filter(
      (q) => q.table === 'household_goal_items' && q.operation === 'update'
    );
    expect(updates).toHaveLength(1);
    expect(updates[0]?.eq).toContainEqual({ column: 'id', value: ITEM_B });
  });

  it('rejects a non-date due date', async () => {
    const fake = setSupabase();
    const { saveGoal } =
      await import('@/features/household/actions/goal-actions');
    const result = await saveGoal({
      goalId: GOAL_ID,
      name: 'Wedding',
      target: 5000,
      items: [{ name: 'Deposit', budget: 1000, dueDate: 'soon' }],
    });
    expect(result.ok).toBe(false);
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('returns flattened errors and reads nothing after the guard on bad input', async () => {
    const fake = setSupabase();
    const { saveGoal } =
      await import('@/features/household/actions/goal-actions');
    const result = await saveGoal({ name: '', target: -1, items: [] });
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
    if (result.ok || result.code !== 'VALIDATION') return;
    expect(Object.keys(result.error.fieldErrors)).toEqual(
      expect.arrayContaining(['name', 'target'])
    );
    expect(order).toEqual(['guard']);
    expect(fake.calls.from).toHaveLength(0);
  });

  it('rejects duplicate item ids', async () => {
    const { saveGoal } =
      await import('@/features/household/actions/goal-actions');
    const result = await saveGoal({
      name: 'X',
      target: 10,
      items: [
        { id: ITEM_A, name: 'a', budget: 1 },
        { id: ITEM_A, name: 'b', budget: 1 },
      ],
    });
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
  });

  it('returns an opaque server result with stable ids and no database text', async () => {
    setSupabase({
      selectDataByTable: {
        household_goals: [],
        household_members: [{ household_id: 'h1' }],
      },
      insertError: { message: 'duplicate key violates household_goals_pkey' },
    });
    const { saveGoal } =
      await import('@/features/household/actions/goal-actions');
    const result = await saveGoal({
      goalId: GOAL_ID,
      name: 'Wedding',
      target: 5000,
      items: [{ id: ITEM_A, name: 'Venue', budget: 3000 }],
    });
    expect(result).toEqual({
      ok: false,
      code: 'SERVER',
      goalId: GOAL_ID,
      itemIds: [ITEM_A],
    });
    expect(JSON.stringify(result)).not.toContain('pkey');
  });
});

describe.each([
  ['updateGoalPayment', 'paymentId', 'household_goal_payments'],
  ['updateGoalContribution', 'contributionId', 'household_goal_contributions'],
] as const)('%s', (fn, key, table) => {
  const valid = {
    [key]: ROW_ID,
    amount: 42.5,
    note: ' hi ',
    date: '2026-11-01',
  };

  it('encrypts the amount and note after the guard', async () => {
    const fake = setSupabase({
      selectDataByTable: { [table]: [{ id: ROW_ID }] },
    });
    const actions = await import('@/features/household/actions/goal-actions');
    await actions[fn](valid);
    expect(order).toEqual(['guard']);
    const written = fake.calls.update[0] as Record<string, string>;
    expect(decryptPayload(written.amount, KH)).toBe('42.5');
    expect(decryptPayload(written.note, KH)).toBe('hi');
    expect(written.date).toBe('2026-11-01');
    expect(fake.calls.queries[0]?.eq).toEqual([
      { column: 'id', value: ROW_ID },
    ]);
  });

  it('rejects invalid input before any write', async () => {
    const fake = setSupabase();
    const actions = await import('@/features/household/actions/goal-actions');
    await expect(actions[fn]({ ...valid, amount: 0 })).rejects.toThrow();
    await expect(actions[fn]({ ...valid, [key]: 'nope' })).rejects.toThrow();
    expect(fake.calls.update).toHaveLength(0);
  });

  it('treats zero updated rows as not found', async () => {
    setSupabase({ selectDataByTable: { [table]: [] } });
    const actions = await import('@/features/household/actions/goal-actions');
    await expect(actions[fn](valid)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('does not leak database text on failure', async () => {
    setSupabase({
      selectErrorByTable: {
        [table]: () => ({ message: `violates ${table}_check` }),
      },
    });
    const actions = await import('@/features/household/actions/goal-actions');
    const error = await actions[fn](valid).catch((e: Error) => e);
    expect((error as Error).message).not.toContain(table);
  });
});
