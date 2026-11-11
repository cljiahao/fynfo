import { householdGoalsSeries } from '@/features/household/lib/household-goal-series';
import {
  computeHouseholdPlan,
  type PlanBudget,
  type PlanGoal,
} from '@/features/household/lib/household-plan';
import { describe, expect, it } from 'vitest';

const NOW = new Date(2026, 0, 15);

function dated(id: string, date: string, amount: number): PlanGoal {
  return {
    id,
    name: id,
    targetDate: date,
    createdAt: '2026-01-01',
    targetAmount: amount,
    contributed: 0,
    remaining: amount,
    share: 1,
    items: [],
  };
}

function undated(id: string, amount: number): PlanGoal {
  return { ...dated(id, '2026-01-01', amount), targetDate: null };
}

function planOf(goals: PlanGoal[], surplus = 0, budgets: PlanBudget[] = []) {
  return computeHouseholdPlan({ goals, budgets }, { surplus, now: NOW });
}

const A = () => dated('A', '2026-04-15', 600);
const B = () => dated('B', '2026-07-15', 300);
const C = () => dated('C', '2028-01-15', 900);

const repeat = (value: number, times: number) => Array(times).fill(value);

describe('householdGoalsSeries', () => {
  it('walks the three-entry hand example', () => {
    const plan = planOf([A(), B(), C()]);
    expect(plan.goalsMonthly).toBe(200);
    expect(plan.bindingMonths).toBe(3);

    const { monthly, byYear } = householdGoalsSeries(plan, NOW);
    expect(monthly).toEqual([
      ...repeat(200, 3),
      ...repeat(100, 3),
      ...repeat(50, 18),
    ]);
    expect(byYear).toEqual([100, 50]);
  });

  it('starts at the plan pace for the plan binding months', () => {
    const plan = planOf([A(), B(), C()]);
    const { monthly } = householdGoalsSeries(plan, NOW);
    expect(monthly[0]).toBe(plan.goalsMonthly);
    expect(monthly.slice(0, plan.bindingMonths ?? 0)).toEqual(
      repeat(plan.goalsMonthly, 3)
    );
    expect(monthly[3]).toBeLessThan(plan.goalsMonthly);
  });

  it('follows the post-offset schedule when a surplus is applied once', () => {
    // Surplus 300 trims A to 300: 300/3 = 100, 600/6 = 100, 1,500/24 = 62.5.
    const plan = planOf([A(), B(), C()], 300);
    expect(plan.goalsMonthly).toBe(100);
    expect(plan.bindingMonths).toBe(3);

    const { monthly, byYear } = householdGoalsSeries(plan, NOW);
    expect(monthly).toEqual([...repeat(100, 6), ...repeat(50, 18)]);
    expect(monthly[0]).toBe(plan.goalsMonthly);
    expect(monthly.reduce((a, b) => a + b, 0)).toBe(1500);
    expect(byYear).toEqual([75, 50]);
  });

  it('sums to the schedule total and never rises', () => {
    const plan = planOf([A(), B(), C()]);
    const { monthly } = householdGoalsSeries(plan, NOW);
    expect(monthly.reduce((a, b) => a + b, 0)).toBe(1800);
    monthly.forEach((value, i) => {
      if (i > 0) expect(value).toBeLessThanOrEqual(monthly[i - 1]);
    });
  });

  it('counts overdue and this-month entries as one month', () => {
    // 100 overdue and 50 due now both land in month 1: 150/1; 750/6 = 125 is lower.
    const plan = planOf([
      dated('late', '2025-12-01', 100),
      dated('now', '2026-01-15', 50),
      dated('later', '2026-07-15', 600),
    ]);
    expect(plan.goalsMonthly).toBe(150);
    expect(plan.bindingMonths).toBe(1);

    const { monthly } = householdGoalsSeries(plan, NOW);
    expect(monthly).toEqual([150, ...repeat(120, 5)]);
  });

  it('treats two entries on one date as one deadline', () => {
    // 600 due in month 3 is 200 a month (not 100 for the first entry alone);
    // then 300 over the remaining 6 months is 50.
    const plan = planOf([
      dated('x', '2026-04-15', 300),
      dated('y', '2026-04-15', 300),
      dated('z', '2026-10-15', 300),
    ]);
    expect(plan.goalsMonthly).toBe(200);
    expect(plan.bindingMonths).toBe(3);

    const { monthly } = householdGoalsSeries(plan, NOW);
    expect(monthly).toEqual([...repeat(200, 3), ...repeat(50, 6)]);
  });

  it('returns empty arrays for an empty schedule', () => {
    const plan = planOf([]);
    expect(householdGoalsSeries(plan, NOW)).toEqual({
      monthly: [],
      byYear: [],
    });
  });

  it('returns empty arrays when the pace is 0 or the binding months are null', () => {
    const base = planOf([A()]);
    expect(householdGoalsSeries({ ...base, goalsMonthly: 0 }, NOW)).toEqual({
      monthly: [],
      byYear: [],
    });
    expect(householdGoalsSeries({ ...base, bindingMonths: null }, NOW)).toEqual(
      { monthly: [], byYear: [] }
    );
  });

  it('ignores undated goals', () => {
    const withUndated = planOf([A(), undated('open', 5000)]);
    expect(householdGoalsSeries(withUndated, NOW)).toEqual(
      householdGoalsSeries(planOf([A()]), NOW)
    );
    expect(householdGoalsSeries(withUndated, NOW).monthly).toEqual(
      repeat(200, 3)
    );
  });

  it('leaves budgets out of the series', () => {
    const budgets: PlanBudget[] = [{ id: 'b', monthlyAmount: 400, share: 1 }];
    const withBudgets = planOf([A(), B(), C()], 0, budgets);
    expect(withBudgets.budgetsMonthly).toBe(400);
    expect(householdGoalsSeries(withBudgets, NOW)).toEqual(
      householdGoalsSeries(planOf([A(), B(), C()]), NOW)
    );
  });

  it('truncates a far-dated entry at capMonths', () => {
    // 1,200 over 120 months is 10 a month; a 24-month cap keeps 24 of them.
    const plan = planOf([dated('far', '2036-01-15', 1200)]);
    expect(plan.goalsMonthly).toBe(10);
    expect(plan.bindingMonths).toBe(120);

    const { monthly, byYear } = householdGoalsSeries(plan, NOW, 24);
    expect(monthly).toEqual(repeat(10, 24));
    expect(byYear).toEqual([10, 10]);
    expect(householdGoalsSeries(plan, NOW).monthly).toHaveLength(120);
  });

  it('averages a partial last year with zeros', () => {
    const plan = planOf([dated('half', '2026-07-15', 600)]);
    expect(householdGoalsSeries(plan, NOW).byYear).toEqual([50]);
  });
});
