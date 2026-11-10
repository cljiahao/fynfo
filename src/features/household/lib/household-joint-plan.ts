import {
  computeHouseholdPlan,
  type HouseholdPlanInput,
} from './household-plan';

/** The plan as the whole household sees it: every goal and budget at 100%. */
export function sharedInput(
  input: Pick<HouseholdPlanInput, 'goals' | 'budgets'>
) {
  return {
    goals: input.goals.map((goal) => ({ ...goal, share: 1 })),
    budgets: input.budgets.map((budget) => ({ ...budget, share: 1 })),
  };
}

/**
 * Each goal's slice of the joint monthly goals figure, so the cards add up to
 * the "Together" line. The plan's own per-goal figure is a standalone pace and
 * would overlap between goals; slicing by what each goal still has to place
 * keeps the total equal to the binding deadline's figure.
 */
export function jointGoalMonthly(
  input: Pick<HouseholdPlanInput, 'goals' | 'budgets'>,
  now: Date
): Map<string, number> {
  const joint = sharedInput(input);
  const plan = computeHouseholdPlan(
    { goals: joint.goals, budgets: [] },
    { surplus: 0, now }
  );
  const placed = plan.perGoal.reduce((sum, g) => sum + g.scheduleTotal, 0);
  const slices = new Map<string, number>();
  for (const goal of plan.perGoal) {
    slices.set(
      goal.goalId,
      placed > 0 ? (plan.goalsMonthly * goal.scheduleTotal) / placed : 0
    );
  }
  return slices;
}

/**
 * True when the caller's own spare savings already pay their whole share of
 * the goals schedule. Only ever used for a note; no joint figure depends on it.
 */
export function savingsCoverShare(
  input: Pick<HouseholdPlanInput, 'goals' | 'budgets'>,
  surplus: number,
  now: Date
): boolean {
  const without = computeHouseholdPlan(input, { surplus: 0, now });
  if (without.goalsMonthly <= 0) return false;
  return computeHouseholdPlan(input, { surplus, now }).goalsMonthly <= 0;
}
