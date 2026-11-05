import { monthsUntil } from './goal-stats';

type PctMap = Record<string, number>;

export interface CommitmentSplit {
  members: PctMap;
  goalOverrides: Record<string, PctMap>;
}

export interface CommitmentGoal {
  id: string;
  remaining: number;
  targetDate: string | null;
}

export interface CommitmentInput {
  goals: CommitmentGoal[];
  /** Monthly amount of each household spending budget. */
  budgets: number[];
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

function excludedReason(goal: CommitmentGoal): ExcludedReason | null {
  if (!goal.targetDate) return 'no-date';
  if (goal.remaining <= 0) return 'funded';
  return null;
}

/**
 * Splits the caller's household obligations into a reserve (goals due within
 * the horizon or overdue) and a monthly deduction (longer-dated goals paced
 * over their remaining months, plus the caller's share of spending budgets).
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
    const remaining = Math.max(0, goal.remaining);
    const reason = excludedReason(goal);

    if (reason !== null || goal.targetDate === null) {
      const why = reason ?? 'no-date';
      excluded.push({ goalId: goal.id, reason: why });
      lines.push({
        goalId: goal.id,
        bucket: 'excluded',
        amount: 0,
        share,
        remaining,
        reason: why,
      });
      continue;
    }

    const months = monthsUntil(goal.targetDate, now);
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

  const budgetShare = defaultShare(split, callerUserId);
  const monthlyTotal = budgets.reduce((sum, b) => sum + b, 0);
  const budgetMonthly = budgetShare * monthlyTotal;
  monthlyDeduction += budgetMonthly;

  return {
    reserve,
    monthlyDeduction,
    goals: lines,
    budgets: { monthlyTotal, share: budgetShare, monthlyShare: budgetMonthly },
    excluded,
  };
}
