import {
  jointGoalMonthly,
  savingsCoverShare,
} from '@/features/household/lib/household-joint-plan';
import {
  computeHouseholdPlan,
  type HouseholdPlanInput,
  type PlanGoal,
} from '@/features/household/lib/household-plan';
import { describe, expect, it } from 'vitest';

const NOW = new Date(2026, 10, 10, 12);

function goal(over: Partial<PlanGoal> & { id: string }): PlanGoal {
  return {
    name: over.id,
    targetDate: null,
    createdAt: '2026-11-01',
    targetAmount: 0,
    contributed: 0,
    remaining: 0,
    share: 0.5,
    items: [],
    ...over,
  };
}

const wedding = goal({
  id: 'wedding',
  targetDate: '2027-11-27',
  targetAmount: 60000,
  remaining: 60000,
});
const renovation = goal({
  id: 'renovation',
  targetDate: '2028-10-01',
  targetAmount: 50000,
  remaining: 50000,
});
const input: Pick<HouseholdPlanInput, 'goals' | 'budgets'> = {
  goals: [wedding, renovation],
  budgets: [],
};

function together(goals: PlanGoal[]) {
  return computeHouseholdPlan(
    { goals: goals.map((g) => ({ ...g, share: 1 })), budgets: [] },
    { surplus: 0, now: NOW }
  ).goalsMonthly;
}

describe('jointGoalMonthly', () => {
  it('adds up to the joint goals figure the overview shows', () => {
    const slices = jointGoalMonthly(input, NOW);
    const sum = [...slices.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(together(input.goals), 6);
    expect(slices.get('wedding')).toBeGreaterThan(0);
    expect(slices.get('renovation')).toBeGreaterThan(0);
  });

  it('does not depend on the caller split', () => {
    const lopsided = {
      ...input,
      goals: input.goals.map((g) => ({ ...g, share: 0.2 })),
    };
    expect(jointGoalMonthly(lopsided, NOW)).toEqual(
      jointGoalMonthly(input, NOW)
    );
  });

  it('gives an undated goal nothing and keeps the total intact', () => {
    const undated = goal({ id: 'someday', targetAmount: 900, remaining: 900 });
    const goals = [...input.goals, undated];
    const slices = jointGoalMonthly({ goals, budgets: [] }, NOW);
    expect(slices.get('someday')).toBe(0);
    const sum = [...slices.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(together(goals), 6);
  });
});

describe('savingsCoverShare', () => {
  const mine = computeHouseholdPlan(input, { surplus: 0, now: NOW });
  const scheduled = mine.schedule.reduce((sum, e) => sum + e.amount, 0);

  it('is true only once the surplus reaches the whole scheduled share', () => {
    expect(savingsCoverShare(input, scheduled, NOW)).toBe(true);
    expect(savingsCoverShare(input, scheduled - 1, NOW)).toBe(false);
    expect(savingsCoverShare(input, 0, NOW)).toBe(false);
  });

  it('is false when there is nothing scheduled to cover', () => {
    expect(savingsCoverShare({ goals: [], budgets: [] }, 1e9, NOW)).toBe(false);
  });
});
