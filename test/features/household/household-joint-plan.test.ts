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

  it('keeps every slice finite and the total intact with an overdue goal', () => {
    const overdue = goal({
      id: 'overdue',
      targetDate: '2026-01-01',
      targetAmount: 2000,
      remaining: 2000,
    });
    const goals = [...input.goals, overdue];
    const slices = jointGoalMonthly({ goals, budgets: [] }, NOW);
    for (const value of slices.values()) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    const sum = [...slices.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(together(goals), 6);
  });

  it('gives a slice to dated items on a goal that has no target date', () => {
    const itemsOnly = goal({
      id: 'itemsOnly',
      targetAmount: 1200,
      remaining: 1200,
      items: [
        {
          id: 'i1',
          name: 'Deposit',
          effective: 1200,
          paid: 0,
          dueDate: '2027-05-01',
        },
      ],
    });
    const slices = jointGoalMonthly({ goals: [itemsOnly], budgets: [] }, NOW);
    expect(slices.get('itemsOnly')).toBeGreaterThan(0);
    expect(slices.get('itemsOnly')).toBeCloseTo(together([itemsOnly]), 6);
  });

  it('gives every goal zero when nothing is placed', () => {
    const empty = goal({ id: 'empty', targetAmount: 500, remaining: 0 });
    const slices = jointGoalMonthly({ goals: [empty], budgets: [] }, NOW);
    expect(slices.get('empty')).toBe(0);
    expect(jointGoalMonthly({ goals: [], budgets: [] }, NOW).size).toBe(0);
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

  it('measures the caller share, not the whole schedule, with a non-default split', () => {
    const half = {
      ...input,
      goals: input.goals.map((g) => ({ ...g, share: 0.25 })),
    };
    const myShare = computeHouseholdPlan(half, { surplus: 0, now: NOW });
    const myScheduled = myShare.schedule.reduce((sum, e) => sum + e.amount, 0);
    expect(myScheduled).toBeLessThan(scheduled);
    expect(savingsCoverShare(half, myScheduled, NOW)).toBe(true);
    expect(savingsCoverShare(half, myScheduled - 1, NOW)).toBe(false);
  });

  it('is false when there is nothing scheduled to cover', () => {
    expect(savingsCoverShare({ goals: [], budgets: [] }, 1e9, NOW)).toBe(false);
  });
});
