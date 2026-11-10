import { encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const ME = '11111111-1111-4111-8111-111111111111';
const PARTNER = '22222222-2222-4222-8222-222222222222';
const KH = Buffer.alloc(32, 9);
const HOUSEHOLD_ID = '7d1c6c0e-1f0a-4f55-8d0e-0a8e4b7a0c11';
const GOAL = '44444444-4444-4444-8444-444444444444';
const BUDGET = '77777777-7777-4777-8777-777777777777';

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
      household_goals: [{ id: GOAL }],
      household_spending_budgets: [{ id: BUDGET }],
      household_planner_settings: null,
      ...opts.selectDataByTable,
    },
  }).client;
}

const storedSplit = (split: unknown) => ({
  split: encryptPayload(JSON.stringify(split), KH),
  updated_at: '2026-11-10T00:00:00Z',
});

const goal = {
  id: GOAL,
  name: 'Wedding',
  targetAmount: 46000,
  targetDate: '2028-05-01',
  createdAt: '2026-10-01',
  contributed: 10000,
  remaining: 36000,
  contributions: [],
  pct: 21,
  budgeted: 0,
  paid: 0,
  items: [
    {
      id: 'i-quote',
      name: 'Venue',
      budget: 8000,
      quote: 10000,
      dueDate: '2027-01-15',
      paid: 2000,
      payments: [],
      remaining: 8000,
      over: 0,
    },
    {
      id: 'i-budget',
      name: 'Flowers',
      budget: 1500,
      quote: null,
      dueDate: null,
      paid: 0,
      payments: [],
      remaining: 1500,
      over: 0,
    },
  ],
};

async function load() {
  return import('@/features/household/actions/plan-actions');
}

beforeEach(() => {
  calls.length = 0;
  setSupabase();
  household.mockReset();
  goals.mockReset();
  budgets.mockReset();
});

describe('getHouseholdPlanInput', () => {
  it('returns state none without reading anything else', async () => {
    household.mockResolvedValue(null);
    const { getHouseholdPlanInput } = await load();
    expect(await getHouseholdPlanInput()).toMatchObject({
      state: 'none',
      goals: [],
      budgets: [],
    });
    expect(calls).toEqual(['household']);
  });

  it('returns state locked without reading goals or budgets', async () => {
    household.mockResolvedValue({ locked: true });
    const { getHouseholdPlanInput } = await load();
    expect(await getHouseholdPlanInput()).toMatchObject({
      state: 'locked',
      goals: [],
      budgets: [],
    });
    expect(calls).toEqual(['household']);
  });

  it('maps goals and items, using quote over budget and passing dueDate', async () => {
    household.mockResolvedValue({ locked: false });
    goals.mockResolvedValue([goal]);
    budgets.mockResolvedValue([{ id: BUDGET, monthlyAmount: 400 }]);
    const { getHouseholdPlanInput } = await load();
    const result = await getHouseholdPlanInput();

    expect(result.state).toBe('ready');
    expect(result.isDefaultSplit).toBe(true);
    expect(result.callerShares).toEqual({ default: 0.5 });
    expect(result.goals).toEqual([
      {
        id: GOAL,
        name: 'Wedding',
        targetDate: '2028-05-01',
        createdAt: '2026-10-01',
        targetAmount: 46000,
        contributed: 10000,
        remaining: 36000,
        share: 0.5,
        items: [
          {
            id: 'i-quote',
            name: 'Venue',
            effective: 10000,
            paid: 2000,
            dueDate: '2027-01-15',
          },
          {
            id: 'i-budget',
            name: 'Flowers',
            effective: 1500,
            paid: 0,
            dueDate: null,
          },
        ],
      },
    ]);
    expect(result.budgets).toEqual([
      { id: BUDGET, monthlyAmount: 400, share: 0.5 },
    ]);
  });

  it('applies the caller default, overrides and nothing of the partner', async () => {
    household.mockResolvedValue({ locked: false });
    goals.mockResolvedValue([goal]);
    budgets.mockResolvedValue([{ id: BUDGET, monthlyAmount: 400 }]);
    setSupabase({
      selectDataByTable: {
        household_planner_settings: storedSplit({
          members: { [ME]: 70, [PARTNER]: 30 },
          goalOverrides: { [GOAL]: { [ME]: 25, [PARTNER]: 75 } },
          budgetOverrides: { [BUDGET]: { [ME]: 100, [PARTNER]: 0 } },
        }),
      },
    });
    const { getHouseholdPlanInput } = await load();
    const result = await getHouseholdPlanInput();

    expect(result.isDefaultSplit).toBe(false);
    expect(result.callerShares.default).toBeCloseTo(0.7);
    expect(result.goals[0].share).toBeCloseTo(0.25);
    expect(result.budgets[0].share).toBe(1);
    expect(JSON.stringify(result)).not.toContain(PARTNER);
  });

  it('keeps failures opaque', async () => {
    household.mockResolvedValue({ locked: false });
    goals.mockResolvedValue([]);
    budgets.mockResolvedValue([]);
    setSupabase({
      selectDataByTable: {
        household_planner_settings: {
          split: 'not-a-ciphertext',
          updated_at: '2026-11-10T00:00:00Z',
        },
      },
    });
    const { getHouseholdPlanInput } = await load();
    await expect(getHouseholdPlanInput()).rejects.toThrow(
      'Household planner split is unreadable'
    );
  });
});
