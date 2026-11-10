'use server';

import {
  budgetShare,
  defaultShare,
  goalShare,
} from '../lib/household-commitment';
import type { HouseholdPlanInput } from '../lib/household-plan';
import { getSpendingBudgets } from './budget-actions';
import { getGoals } from './goal-actions';
import { getHousehold } from './household-actions';
import { getPlannerSplit } from './planner-actions';

function emptyInput(state: 'none' | 'locked'): HouseholdPlanInput {
  return {
    state,
    isDefaultSplit: false,
    callerShares: { default: 0 },
    goals: [],
    budgets: [],
  };
}

/**
 * Household goals, items and budgets with only the caller's own shares, for the
 * browser to turn into a plan. Personal figures never come in or go out, so the
 * partner's view and the caller's savings stay separate. No household is `none`
 * and a locked one is `locked`, so callers render without either.
 */
export async function getHouseholdPlanInput(): Promise<HouseholdPlanInput> {
  const household = await getHousehold();
  if (!household) return emptyInput('none');
  if (household.locked) return emptyInput('locked');

  const [goals, budgets, split] = await Promise.all([
    getGoals(),
    getSpendingBudgets(),
    getPlannerSplit(),
  ]);
  const caller = split.userId;

  return {
    state: 'ready',
    isDefaultSplit: split.isDefault,
    callerShares: { default: defaultShare(split, caller) },
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      targetDate: goal.targetDate,
      createdAt: goal.createdAt,
      targetAmount: goal.targetAmount,
      contributed: goal.contributed,
      remaining: goal.remaining,
      share: goalShare(split, goal.id, caller),
      items: goal.items.map((item) => ({
        id: item.id,
        name: item.name,
        effective: item.quote ?? item.budget,
        paid: item.paid,
        dueDate: item.dueDate,
      })),
    })),
    budgets: budgets.map((budget) => ({
      id: budget.id,
      monthlyAmount: budget.monthlyAmount,
      share: budgetShare(split, budget.id, caller),
    })),
  };
}
