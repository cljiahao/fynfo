import { monthsUntil } from '@/features/household/lib/goal-stats';
import {
  budgetShare,
  defaultShare,
  goalShare,
  type CommitmentSplit,
} from '@/features/household/lib/household-commitment';
import {
  computeHouseholdPlan,
  type PlanGoal,
} from '@/features/household/lib/household-plan';
import { distributePct } from '@/features/household/split-utils';
import { describe, expect, it } from 'vitest';

const NOW = new Date(2026, 10, 4);

const split: CommitmentSplit = {
  members: { me: 60, partner: 40 },
  goalOverrides: { g1: { me: 25 } },
  budgetOverrides: { b1: { me: 80 } },
};

describe('monthsUntil', () => {
  it('rounds partial months up and floors at 1', () => {
    expect(monthsUntil('2026-12-04', NOW)).toBe(1);
    expect(monthsUntil('2026-12-05', NOW)).toBe(2);
    expect(monthsUntil('2026-11-04', NOW)).toBe(1);
  });

  it('returns null once the date has passed', () => {
    expect(monthsUntil('2026-11-03', NOW)).toBeNull();
  });
});

describe('split shares', () => {
  it('uses the member default, falling back to 50%', () => {
    expect(defaultShare(split, 'me')).toBeCloseTo(0.6);
    expect(defaultShare(split, 'stranger')).toBe(0.5);
  });

  it('prefers a goal or budget override over the default', () => {
    expect(goalShare(split, 'g1', 'me')).toBeCloseTo(0.25);
    expect(goalShare(split, 'other', 'me')).toBeCloseTo(0.5);
    expect(budgetShare(split, 'b1', 'me')).toBeCloseTo(0.8);
    expect(budgetShare(split, 'other', 'me')).toBeCloseTo(0.6);
  });
});

describe('goalShare across goal members', () => {
  const all = ['a', 'b', 'c', 'd'];
  const base: CommitmentSplit = {
    members: Object.fromEntries(all.map((id) => [id, 25])),
    goalOverrides: {},
    budgetOverrides: {},
  };

  it.each([1, 2, 3, 4])(
    'splits evenly across a %i-member goal and sums to 1',
    (count) => {
      const members = all.slice(0, count);
      const shares = members.map((id) => goalShare(base, 'g', id, members));
      expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
      expect(Math.min(...shares)).toBeGreaterThan(0);
    }
  );

  it('charges a household member who is not on the goal nothing', () => {
    expect(goalShare(base, 'g', 'd', ['a', 'b', 'c'])).toBe(0);
  });

  it('treats a goal with no members as the whole household', () => {
    expect(goalShare(base, 'g', 'c', [])).toBeCloseTo(0.25);
  });

  it('applies the override percentage over the goal members', () => {
    const split = { ...base, goalOverrides: { g: { a: 50, b: 30, c: 20 } } };
    const members = ['a', 'b', 'c'];
    expect(goalShare(split, 'g', 'a', members)).toBeCloseTo(0.5);
    expect(goalShare(split, 'g', 'c', members)).toBeCloseTo(0.2);
  });
});

describe('planner deduction for a shared goal', () => {
  const all = ['a', 'b', 'c', 'd'];
  const split: CommitmentSplit = {
    members: Object.fromEntries(all.map((id) => [id, 25])),
    goalOverrides: {},
    budgetOverrides: {},
  };
  const planGoal = (share: number): PlanGoal => ({
    id: 'g',
    name: 'Trip',
    targetDate: null,
    createdAt: '2026-11-01',
    targetAmount: 12000,
    contributed: 0,
    remaining: 12000,
    share,
    items: [
      {
        id: 'i',
        name: 'Flights',
        effective: 12000,
        paid: 0,
        dueDate: '2027-11-04',
      },
    ],
  });
  const monthly = (share: number) =>
    computeHouseholdPlan(
      { goals: [planGoal(share)], budgets: [] },
      { surplus: 0, now: NOW }
    ).monthly;

  it.each([1, 2, 3, 4])(
    'equals the caller percentage of the monthly need on a %i-member goal',
    (count) => {
      const members = all.slice(0, count);
      const pcts = distributePct(members);
      const need = monthly(1);
      expect(need).toBeGreaterThan(0);
      for (const id of members) {
        expect(monthly(goalShare(split, 'g', id, members))).toBeCloseTo(
          (need * pcts[id]) / 100
        );
      }
    }
  );

  it('carries nothing for a member who is not on the goal', () => {
    expect(monthly(goalShare(split, 'g', 'd', ['a', 'b', 'c']))).toBe(0);
  });
});
