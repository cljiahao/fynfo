import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const ME = '11111111-1111-4111-8111-111111111111';
const PARTNER = '22222222-2222-4222-8222-222222222222';
const KH = Buffer.alloc(32, 9);
const HOUSEHOLD_ID = '7d1c6c0e-1f0a-4f55-8d0e-0a8e4b7a0c11';

let supabase: ReturnType<typeof makeFakeSupabase>['client'];
const calls: string[] = [];
const household = vi.fn();
const goals = vi.fn();
const budgets = vi.fn();

vi.mock('@/lib/action-guard', () => ({
  requireHouseholdContext: async () => ({ userId: ME, kh: KH, supabase }),
}));
vi.mock('@/features/household/actions/household-actions', () => ({
  getHousehold: () => {
    calls.push('household');
    return household();
  },
}));
vi.mock('@/features/household/actions/goal-actions', () => ({
  getGoals: () => {
    calls.push('goals');
    return goals();
  },
}));
vi.mock('@/features/household/actions/budget-actions', () => ({
  getSpendingBudgets: () => {
    calls.push('budgets');
    return budgets();
  },
}));

function setSupabase(opts: FakeSupabaseOptions = {}) {
  supabase = makeFakeSupabase({
    ...opts,
    selectDataByTable: {
      household_members: [
        { household_id: HOUSEHOLD_ID, user_id: ME },
        { household_id: HOUSEHOLD_ID, user_id: PARTNER },
      ],
      household_planner_settings: null,
      ...opts.selectDataByTable,
    },
  }).client;
}

async function load() {
  return import('@/features/household/actions/planner-actions');
}

beforeEach(() => {
  calls.length = 0;
  setSupabase();
  household.mockReset();
  goals.mockReset();
  budgets.mockReset();
});

describe('getPlannerCommitment', () => {
  it('rejects an out-of-range horizon before touching any data', async () => {
    const { getPlannerCommitment } = await load();
    await expect(getPlannerCommitment({ horizonMonths: 0 })).rejects.toThrow();
    await expect(
      getPlannerCommitment({ horizonMonths: 121 })
    ).rejects.toThrow();
    await expect(getPlannerCommitment(undefined)).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it('returns state none for a user without a household', async () => {
    household.mockResolvedValue(null);
    const { getPlannerCommitment } = await load();
    const result = await getPlannerCommitment({ horizonMonths: 24 });
    expect(result).toMatchObject({
      state: 'none',
      reserve: 0,
      monthlyDeduction: 0,
      goals: [],
      excluded: [],
    });
    expect(calls).toEqual(['household']);
  });

  it('returns state locked without reading goals or budgets', async () => {
    household.mockResolvedValue({ locked: true });
    const { getPlannerCommitment } = await load();
    const result = await getPlannerCommitment({ horizonMonths: 24 });
    expect(result.state).toBe('locked');
    expect(result.reserve).toBe(0);
    expect(calls).toEqual(['household']);
  });

  it('splits budgets and reserves goals inside the horizon', async () => {
    household.mockResolvedValue({ locked: false });
    const soon = new Date();
    soon.setMonth(soon.getMonth() + 3);
    goals.mockResolvedValue([
      {
        id: 'g-due',
        name: 'Holiday',
        remaining: 1200,
        targetDate: soon.toISOString().slice(0, 10),
      },
      { id: 'g-open', name: 'Someday', remaining: 500, targetDate: null },
    ]);
    budgets.mockResolvedValue([{ monthlyAmount: 400 }]);
    const { getPlannerCommitment } = await load();
    const result = await getPlannerCommitment({ horizonMonths: 24 });
    expect(result.state).toBe('ready');
    expect(result.isDefaultSplit).toBe(true);
    expect(result.budgets.monthlyShare).toBe(200);
    expect(result.monthlyDeduction).toBe(200);
    expect(result.reserve).toBe(600);
    expect(result.goals.find((g) => g.name === 'Holiday')).toMatchObject({
      bucket: 'reserve',
      amount: 600,
    });
    expect(result.excluded).toEqual([
      { goalId: 'g-open', name: 'Someday', reason: 'no-date' },
    ]);
  });
});
