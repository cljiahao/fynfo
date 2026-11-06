import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const USER_ID = 'user-1';
const KH = Buffer.alloc(32, 9);
const HOUSEHOLD_ID = '7d1c6c0e-1f0a-4f55-8d0e-0a8e4b7a0c11';
const BUDGET_ID = '3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b';
const OTHER_ID = '9a1b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6c';

let supabase: ReturnType<typeof makeFakeSupabase>['client'];
const order: string[] = [];

vi.mock('@/lib/action-guard', () => ({
  requireHouseholdContext: async () => {
    order.push('guard');
    return { userId: USER_ID, kh: KH, supabase };
  },
}));

const budgetRow = (id: string, category: string, amount: number) => ({
  id,
  category: encryptPayload(category, KH),
  monthly_amount: encryptPayload(String(amount), KH),
});

function setSupabase(opts: FakeSupabaseOptions = {}) {
  const fake = makeFakeSupabase({
    ...opts,
    selectDataByTable: {
      household_members: [{ household_id: HOUSEHOLD_ID }],
      household_spending_budgets: [],
      ...opts.selectDataByTable,
    },
  });
  supabase = fake.client;
  return fake;
}

beforeEach(() => {
  order.length = 0;
  setSupabase();
});

describe('getSpendingBudgets', () => {
  it('decrypts budgets and orders them by category', async () => {
    setSupabase({
      selectDataByTable: {
        household_spending_budgets: [
          budgetRow(OTHER_ID, 'Utilities', 80.5),
          budgetRow(BUDGET_ID, 'Groceries', 300),
        ],
      },
    });
    const { getSpendingBudgets } =
      await import('@/features/household/actions/budget-actions');
    expect(await getSpendingBudgets()).toEqual([
      { id: BUDGET_ID, category: 'Groceries', monthlyAmount: 300 },
      { id: OTHER_ID, category: 'Utilities', monthlyAmount: 80.5 },
    ]);
  });
});

describe('setCategoryBudget', () => {
  it('encrypts category and amount and stamps the household and creator', async () => {
    const fake = setSupabase();
    const { setCategoryBudget } =
      await import('@/features/household/actions/budget-actions');
    await setCategoryBudget({ category: ' Groceries ', monthlyAmount: 250 });

    expect(fake.calls.from).toContain('household_spending_budgets');
    const row = fake.calls.insert[0] as Record<string, string>;
    expect(row.household_id).toBe(HOUSEHOLD_ID);
    expect(row.created_by).toBe(USER_ID);
    expect(row.category).not.toContain('Groceries');
    expect(decryptPayload(row.category, KH)).toBe('Groceries');
    expect(decryptPayload(row.monthly_amount, KH)).toBe('250');
  });

  it('returns the id of the created budget, as stored', async () => {
    const fake = setSupabase();
    const { setCategoryBudget } =
      await import('@/features/household/actions/budget-actions');
    const id = await setCategoryBudget({ category: 'Fun', monthlyAmount: 10 });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect((fake.calls.insert[0] as { id: string }).id).toBe(id);
  });

  it('returns the existing id when updating a budget', async () => {
    setSupabase({
      selectDataByTable: {
        household_spending_budgets: [budgetRow(BUDGET_ID, 'Groceries', 300)],
      },
    });
    const { setCategoryBudget } =
      await import('@/features/household/actions/budget-actions');
    expect(
      await setCategoryBudget({
        id: BUDGET_ID,
        category: 'Groceries',
        monthlyAmount: 320,
      })
    ).toBe(BUDGET_ID);
  });

  it('runs the auth guard before any database access', async () => {
    const fake = setSupabase();
    const { setCategoryBudget } =
      await import('@/features/household/actions/budget-actions');
    await setCategoryBudget({ category: 'Fun', monthlyAmount: 10 });
    expect(order[0]).toBe('guard');
    expect(fake.calls.from.length).toBeGreaterThan(0);
  });

  it('rejects a case or whitespace duplicate with an opaque BUDGET_EXISTS', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        household_spending_budgets: [budgetRow(BUDGET_ID, 'Groceries', 300)],
      },
    });
    const { setCategoryBudget } =
      await import('@/features/household/actions/budget-actions');
    await expect(
      setCategoryBudget({ category: '  GROCERIES', monthlyAmount: 100 })
    ).rejects.toThrow('BUDGET_EXISTS');
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('updates in place when the id matches the only normalized match', async () => {
    const fake = setSupabase({
      selectDataByTable: {
        household_spending_budgets: [budgetRow(BUDGET_ID, 'Groceries', 300)],
      },
    });
    const { setCategoryBudget } =
      await import('@/features/household/actions/budget-actions');
    await setCategoryBudget({
      id: BUDGET_ID,
      category: 'groceries',
      monthlyAmount: 350,
    });
    expect(fake.calls.insert).toHaveLength(0);
    const patch = fake.calls.update[0] as Record<string, string>;
    expect(decryptPayload(patch.monthly_amount, KH)).toBe('350');
    const eq = fake.calls.queries.at(-1)?.eq;
    expect(eq).toContainEqual({ column: 'id', value: BUDGET_ID });
    expect(eq).toContainEqual({
      column: 'household_id',
      value: HOUSEHOLD_ID,
    });
  });

  it('throws an opaque NOT_FOUND when the update changes no rows', async () => {
    setSupabase();
    const { setCategoryBudget } =
      await import('@/features/household/actions/budget-actions');
    const failure = await setCategoryBudget({
      id: BUDGET_ID,
      category: 'Groceries',
      monthlyAmount: 100,
    }).catch((e: Error) => e);
    expect(failure).toMatchObject({ code: 'NOT_FOUND' });
    expect((failure as Error).message).not.toMatch(
      /household_spending_budgets/
    );
  });

  it('rejects an edit that renames onto another budget', async () => {
    setSupabase({
      selectDataByTable: {
        household_spending_budgets: [
          budgetRow(BUDGET_ID, 'Groceries', 300),
          budgetRow(OTHER_ID, 'Utilities', 80),
        ],
      },
    });
    const { setCategoryBudget } =
      await import('@/features/household/actions/budget-actions');
    await expect(
      setCategoryBudget({
        id: BUDGET_ID,
        category: 'utilities',
        monthlyAmount: 100,
      })
    ).rejects.toThrow('BUDGET_EXISTS');
  });

  it.each([
    { category: '   ', monthlyAmount: 10 },
    { category: 'x'.repeat(41), monthlyAmount: 10 },
    { category: 'Fun', monthlyAmount: 0 },
    { category: 'Fun', monthlyAmount: Number.NaN },
    { category: 'Fun', monthlyAmount: '10' },
  ])('rejects invalid input %j before any database access', async (input) => {
    const fake = setSupabase();
    const { setCategoryBudget } =
      await import('@/features/household/actions/budget-actions');
    await expect(setCategoryBudget(input)).rejects.toThrow(/invalid input/);
    expect(fake.calls.from).toHaveLength(0);
  });

  it('hides database detail behind an opaque error', async () => {
    setSupabase({
      insertError: {
        message:
          'duplicate key value violates "household_spending_budgets_pkey"',
        code: '23505',
      },
    });
    const { setCategoryBudget } =
      await import('@/features/household/actions/budget-actions');
    const failure = await setCategoryBudget({
      category: 'Fun',
      monthlyAmount: 10,
    }).catch((e: Error) => e);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toMatch(
      /household_spending_budgets/
    );
  });
});

describe('deleteCategoryBudget', () => {
  it('deletes by id', async () => {
    const fake = setSupabase();
    const { deleteCategoryBudget } =
      await import('@/features/household/actions/budget-actions');
    await deleteCategoryBudget(BUDGET_ID);
    expect(fake.calls.delete).toBe(1);
    const eq = fake.calls.queries.at(-1)?.eq;
    expect(eq).toContainEqual({ column: 'id', value: BUDGET_ID });
    expect(eq).toContainEqual({
      column: 'household_id',
      value: HOUSEHOLD_ID,
    });
  });

  it('rejects a non-uuid id before any database access', async () => {
    const fake = setSupabase();
    const { deleteCategoryBudget } =
      await import('@/features/household/actions/budget-actions');
    await expect(deleteCategoryBudget('nope')).rejects.toThrow();
    expect(fake.calls.from).toHaveLength(0);
  });
});
