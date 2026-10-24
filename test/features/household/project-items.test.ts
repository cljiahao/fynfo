import {
  computeItemBudget,
  computeProjectTotals,
} from '@/features/household/lib/project-budget';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '../../helpers/fake-supabase';

const USER_ID = 'user-1';
const PARTNER_ID = 'user-2';
const KH = Buffer.alloc(32, 7);
const GOAL_ID = '00000000-0000-4000-8000-0000000000a1';
const ITEM_ID = '00000000-0000-4000-8000-0000000000b1';

let supabase: ReturnType<typeof makeFakeSupabase>['client'];

vi.mock('@/lib/action-guard', () => ({
  requireHouseholdContext: async () => ({ userId: USER_ID, kh: KH, supabase }),
}));

function setSupabase(opts: Parameters<typeof makeFakeSupabase>[0] = {}) {
  const fake = makeFakeSupabase(opts);
  supabase = fake.client;
  return fake;
}

beforeEach(() => {
  setSupabase();
});

describe('project budget math', () => {
  it('reports remaining within budget and overspend beyond it', () => {
    expect(computeItemBudget(1000, [300, 200])).toEqual({
      paid: 500,
      remaining: 500,
      over: 0,
    });
    expect(computeItemBudget(1000, [800, 450])).toEqual({
      paid: 1250,
      remaining: 0,
      over: 250,
    });
  });

  it('does not let one item underspending hide another overspending', () => {
    expect(
      computeProjectTotals([
        { budget: 1000, paid: 1250, over: 250 },
        { budget: 500, paid: 100, over: 0 },
      ])
    ).toEqual({ budgeted: 1500, paid: 1350, over: 250 });
  });
});

describe('getGoals with budget items', () => {
  it('decrypts items and payments, totals them, and flags self vs partner', async () => {
    setSupabase({
      selectDataByTable: {
        household_goals: [
          {
            id: GOAL_ID,
            name: encryptPayload('Wedding', KH),
            target_amount: encryptPayload('30000', KH),
            target_date: null,
            created_at: '2026-10-01',
          },
        ],
        household_goal_contributions: [],
        household_goal_items: [
          {
            id: ITEM_ID,
            goal_id: GOAL_ID,
            name: encryptPayload('Venue', KH),
            budget: encryptPayload('12000', KH),
          },
        ],
        household_goal_payments: [
          {
            id: '3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b',
            item_id: ITEM_ID,
            payer_user_id: USER_ID,
            amount: encryptPayload('5000', KH),
            note: null,
            date: '2026-10-02',
          },
          {
            id: 'p2',
            item_id: ITEM_ID,
            payer_user_id: PARTNER_ID,
            amount: encryptPayload('8000', KH),
            note: encryptPayload('Deposit', KH),
            date: '2026-10-03',
          },
        ],
      },
    });
    const { getGoals } =
      await import('@/features/household/actions/goal-actions');
    const [goal] = await getGoals();
    expect(goal.items).toHaveLength(1);
    expect(goal.items[0]).toMatchObject({
      name: 'Venue',
      budget: 12000,
      paid: 13000,
      remaining: 0,
      over: 1000,
    });
    expect(goal.items[0].payments).toEqual([
      {
        id: '3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b',
        amount: 5000,
        note: null,
        date: '2026-10-02',
        isSelf: true,
      },
      {
        id: 'p2',
        amount: 8000,
        note: 'Deposit',
        date: '2026-10-03',
        isSelf: false,
      },
    ]);
    expect(goal.budgeted).toBe(12000);
    expect(goal.paid).toBe(13000);
  });

  it('returns goals with no items as empty breakdowns', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        household_goals: [
          {
            id: GOAL_ID,
            name: encryptPayload('Sofa', KH),
            target_amount: encryptPayload('1000', KH),
            target_date: null,
            created_at: '2026-10-01',
          },
        ],
        household_goal_contributions: [],
        household_goal_items: [],
      },
    });
    const { getGoals } =
      await import('@/features/household/actions/goal-actions');
    const [goal] = await getGoals();
    expect(goal).toMatchObject({ items: [], budgeted: 0, paid: 0 });
    expect(fake.calls.from).not.toContain('household_goal_payments');
  });

  it('throws an opaque error when items cannot be read', async () => {
    setSupabase({
      selectDataByTable: {
        household_goals: [
          {
            id: GOAL_ID,
            name: encryptPayload('Sofa', KH),
            target_amount: encryptPayload('1000', KH),
            target_date: null,
            created_at: '2026-10-01',
          },
        ],
        household_goal_contributions: [],
      },
      selectErrorByTable: {
        household_goal_items: () => ({ message: 'relation does not exist' }),
      },
    });
    const { getGoals } =
      await import('@/features/household/actions/goal-actions');
    await expect(getGoals()).rejects.toThrow(
      'household goal items read failed'
    );
  });
});

describe('item and payment writes', () => {
  it('seals item name and budget under the household key', async () => {
    const fake = setSupabase();
    const { addGoalItem } =
      await import('@/features/household/actions/goal-actions');
    await addGoalItem({ goalId: GOAL_ID, name: '  Venue ', budget: 12000 });
    const row = fake.calls.insert[0] as Record<string, string>;
    expect(row.goal_id).toBe(GOAL_ID);
    expect(row.name).not.toContain('Venue');
    expect(decryptPayload(row.name, KH)).toBe('Venue');
    expect(decryptPayload(row.budget, KH)).toBe('12000');
  });

  it('records a payment as the caller with a sealed amount and note', async () => {
    const fake = setSupabase();
    const { addItemPayment } =
      await import('@/features/household/actions/goal-actions');
    await addItemPayment({
      itemId: ITEM_ID,
      amount: 450.5,
      note: 'Deposit',
      date: '2026-10-05',
    });
    const row = fake.calls.insert[0] as Record<string, string>;
    expect(row).toMatchObject({
      item_id: ITEM_ID,
      payer_user_id: USER_ID,
      date: '2026-10-05',
    });
    expect(decryptPayload(row.amount, KH)).toBe('450.5');
    expect(decryptPayload(row.note, KH)).toBe('Deposit');
  });

  it.each([
    ['item', { goalId: 'not-a-uuid', name: 'Venue', budget: 100 }],
    ['item', { goalId: GOAL_ID, name: ' ', budget: 100 }],
    ['item', { goalId: GOAL_ID, name: 'Venue', budget: 0 }],
    ['payment', { itemId: ITEM_ID, amount: -1, date: '2026-10-05' }],
    ['payment', { itemId: ITEM_ID, amount: 10, date: 'yesterday' }],
  ])('rejects an invalid %s before any write', async (kind, input) => {
    const fake = setSupabase();
    const actions = await import('@/features/household/actions/goal-actions');
    const write =
      kind === 'item' ? actions.addGoalItem : actions.addItemPayment;
    await expect(write(input)).rejects.toThrow();
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('deletes items and payments by id on their own tables', async () => {
    const fake = setSupabase();
    const { deleteGoalItem, deleteItemPayment } =
      await import('@/features/household/actions/goal-actions');
    await deleteGoalItem(ITEM_ID);
    await deleteItemPayment('3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b');
    expect(fake.calls.delete).toBe(2);
    expect(
      fake.calls.queries
        .filter((query) => query.operation === 'delete')
        .map((query) => [query.table, query.eq])
    ).toEqual([
      ['household_goal_items', [{ column: 'id', value: ITEM_ID }]],
      [
        'household_goal_payments',
        [{ column: 'id', value: '3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b' }],
      ],
    ]);
  });
});
