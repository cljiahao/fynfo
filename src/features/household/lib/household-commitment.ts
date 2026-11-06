import { monthsUntil } from './goal-stats';

type PctMap = Record<string, number>;

export interface CommitmentSplit {
  members: PctMap;
  goalOverrides: Record<string, PctMap>;
  budgetOverrides: Record<string, PctMap>;
}

export interface CommitmentGoal {
  id: string;
  remaining: number;
  targetDate: string | null;
}

export interface CommitmentBudget {
  id: string;
  monthlyAmount: number;
}

export interface CommitmentInput {
  goals: CommitmentGoal[];
  budgets: CommitmentBudget[];
  split: CommitmentSplit;
  callerUserId: string;
  horizonMonths: number;
  now: Date;
}

export type GoalBucket = 'reserve' | 'pace' | 'excluded';
export type ExcludedReason = 'no-date' | 'funded';

export interface CommitmentGoalLine {
  goalId: string;
  bucket: GoalBucket;
  /** Caller's share: a one-off reserve, a monthly pace, or 0 when excluded. */
  amount: number;
  share: number;
  remaining: number;
  reason?: ExcludedReason;
}

export interface HouseholdCommitment {
  reserve: number;
  monthlyDeduction: number;
  goals: CommitmentGoalLine[];
  budgets: { monthlyTotal: number; share: number; monthlyShare: number };
  excluded: { goalId: string; reason: ExcludedReason }[];
}

const DEFAULT_PCT = 50;

function pctToFraction(map: PctMap | undefined, userId: string): number | null {
  const pct = map?.[userId];
  return typeof pct === 'number' ? pct / 100 : null;
}

/** Caller's fraction of the household default split. */
export function defaultShare(split: CommitmentSplit, userId: string): number {
  return pctToFraction(split.members, userId) ?? DEFAULT_PCT / 100;
}

/** Caller's fraction of one goal: its override when present, else the default. */
export function goalShare(
  split: CommitmentSplit,
  goalId: string,
  userId: string
): number {
  return (
    pctToFraction(split.goalOverrides[goalId], userId) ??
    defaultShare(split, userId)
  );
}

/** Caller's fraction of one budget: its override when present, else the default. */
export function budgetShare(
  split: CommitmentSplit,
  budgetId: string,
  userId: string
): number {
  return (
    pctToFraction(split.budgetOverrides[budgetId], userId) ??
    defaultShare(split, userId)
  );
}

/**
 * Splits the caller's household obligations into a reserve (goals due within
 * the horizon or overdue) and a monthly deduction (longer-dated goals paced
 * over their remaining months, plus the caller's share of spending budgets).
 * Goals and budgets where the caller's share is 0% are left out entirely.
 * Each goal lands in exactly one bucket so nothing is counted twice.
 */
export function computeHouseholdCommitment(
  input: CommitmentInput
): HouseholdCommitment {
  const { goals, budgets, split, callerUserId, horizonMonths, now } = input;

  let reserve = 0;
  let monthlyDeduction = 0;
  const lines: CommitmentGoalLine[] = [];
  const excluded: HouseholdCommitment['excluded'] = [];

  for (const goal of goals) {
    const share = goalShare(split, goal.id, callerUserId);
    if (share === 0) continue;
    const remaining = Math.max(0, goal.remaining);
    const { targetDate } = goal;

    if (targetDate === null || remaining <= 0) {
      const reason: ExcludedReason = targetDate === null ? 'no-date' : 'funded';
      excluded.push({ goalId: goal.id, reason });
      lines.push({
        goalId: goal.id,
        bucket: 'excluded',
        amount: 0,
        share,
        remaining,
        reason,
      });
      continue;
    }

    const months = monthsUntil(targetDate, now);
    if (months === null || months <= horizonMonths) {
      const amount = share * remaining;
      reserve += amount;
      lines.push({
        goalId: goal.id,
        bucket: 'reserve',
        amount,
        share,
        remaining,
      });
    } else {
      const amount = (share * remaining) / months;
      monthlyDeduction += amount;
      lines.push({
        goalId: goal.id,
        bucket: 'pace',
        amount,
        share,
        remaining,
      });
    }
  }

  const monthlyTotal = budgets.reduce((sum, b) => sum + b.monthlyAmount, 0);
  const budgetMonthly = budgets.reduce(
    (sum, b) => sum + budgetShare(split, b.id, callerUserId) * b.monthlyAmount,
    0
  );
  monthlyDeduction += budgetMonthly;
  const aggregateShare =
    monthlyTotal > 0
      ? budgetMonthly / monthlyTotal
      : defaultShare(split, callerUserId);

  return {
    reserve,
    monthlyDeduction,
    goals: lines,
    budgets: {
      monthlyTotal,
      share: aggregateShare,
      monthlyShare: budgetMonthly,
    },
    excluded,
  };
}
