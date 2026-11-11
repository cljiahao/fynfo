import { monthsUntil } from './goal-stats';
import type { HouseholdPlan } from './household-plan';

export interface HouseholdGoalsSeries {
  /** Goal set-aside in each month after `now`; index 0 is the first month. */
  monthly: number[];
  /** Average monthly set-aside per 12-month block; a partial block averages in zeros. */
  byYear: number[];
}

const EMPTY: HouseholdGoalsSeries = { monthly: [], byYear: [] };

/**
 * Walks the plan's schedule to show how the goal set-aside falls as deadlines
 * are met. Segment 1 is the plan's own pace; each later segment re-applies the
 * tightest-deadline rule to the entries that remain. It takes the plan as
 * given because re-running the planner at a later date would count overdue
 * entries as one month and apply the surplus offset again.
 */
export function householdGoalsSeries(
  plan: Pick<HouseholdPlan, 'schedule' | 'goalsMonthly' | 'bindingMonths'>,
  now: Date,
  capMonths = 720
): HouseholdGoalsSeries {
  if (
    plan.schedule.length === 0 ||
    !(plan.goalsMonthly > 0) ||
    plan.bindingMonths === null
  ) {
    return EMPTY;
  }

  let remaining = plan.schedule.map((entry) => ({
    months: monthsUntil(entry.date, now) ?? 1,
    amount: entry.amount,
  }));
  const monthly: number[] = [];
  let pace = plan.goalsMonthly;
  let segmentEnd: number = plan.bindingMonths;

  while (monthly.length < capMonths) {
    while (monthly.length < segmentEnd && monthly.length < capMonths) {
      monthly.push(pace);
    }
    remaining = remaining.filter((entry) => entry.months > segmentEnd);
    if (remaining.length === 0) break;

    const elapsed = segmentEnd;
    let cumulative = 0;
    pace = 0;
    remaining.forEach((entry, i) => {
      cumulative += entry.amount;
      const next = remaining[i + 1];
      if (next && next.months === entry.months) return;
      const need = cumulative / (entry.months - elapsed);
      if (need > pace) {
        pace = need;
        segmentEnd = entry.months;
      }
    });
    if (!(pace > 0)) break;
  }

  const byYear: number[] = [];
  for (let start = 0; start < monthly.length; start += 12) {
    const sum = monthly.slice(start, start + 12).reduce((a, b) => a + b, 0);
    byYear.push(sum / 12);
  }
  return { monthly, byYear };
}
