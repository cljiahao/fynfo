import { getSplitAllocationError, type ExpenseData } from '@/features/expenses';
import { YYYY_MM } from '@/lib/zod-utils';
import { z } from 'zod';
import type { buildMonthlyReview } from './monthly-review';

export type PlanningInput =
  | { status: 'unset' }
  | { status: 'invalid' }
  | { status: 'valid'; value: number };

/** Parse decimal text without floating-point multiplication or silent rounding. */
export function parsePlanningAmount(raw: string): PlanningInput {
  const text = raw.trim();
  if (!text) return { status: 'unset' };
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return { status: 'invalid' };
  const [whole, fraction = ''] = text.split('.');
  const significantWhole = whole.replace(/^0+/, '') || '0';
  if (significantWhole.length > 14) return { status: 'invalid' };
  const cents = Number(
    BigInt(significantWhole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'))
  );
  return Number.isSafeInteger(cents)
    ? { status: 'valid', value: cents }
    : { status: 'invalid' };
}

export function parseContributionCount(raw: string): PlanningInput {
  const text = raw.trim();
  if (!text) return { status: 'unset' };
  if (!/^\d+$/.test(text)) return { status: 'invalid' };
  const count = Number(text);
  return Number.isInteger(count) && count >= 1 && count <= 12
    ? { status: 'valid', value: count }
    : { status: 'invalid' };
}

type SpendingIssue =
  | 'month'
  | 'date'
  | 'amount'
  | 'splits'
  | 'overflow'
  | 'review';
export type BudgetSpending =
  | { status: 'invalid'; issue: SpendingIssue; message?: string }
  | { status: 'not-recorded' }
  | { status: 'recorded'; cents: number; expenseCount: number };

function safeNonnegativeCents(amount: number): boolean {
  return (
    Number.isFinite(amount) &&
    amount >= 0 &&
    Number.isSafeInteger(Math.round(amount * 100))
  );
}

const CALENDAR_DATE = z.iso.date();
function hasRecordedDate(date: string): boolean {
  return (
    typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(date) &&
    CALENDAR_DATE.safeParse(date.slice(0, 10)).success &&
    Number.isFinite(Date.parse(date))
  );
}

/** Qualify the existing review result; do not invent completeness or a second ledger. */
export function qualifyBudgetSpending(
  month: string,
  expenses: readonly ExpenseData[],
  review: Pick<
    ReturnType<typeof buildMonthlyReview>,
    'personalSpending' | 'expenseCount' | 'sources'
  >
): BudgetSpending {
  if (!YYYY_MM.safeParse(month).success)
    return { status: 'invalid', issue: 'month' };
  // An unassignable date cannot honestly be excluded from this month's inventory.
  if (expenses.some((expense) => !hasRecordedDate(expense.date)))
    return { status: 'invalid', issue: 'date' };
  const matching = expenses.filter(
    (expense) => expense.date.slice(0, 7) === month
  );
  if (review.expenseCount !== matching.length)
    return { status: 'invalid', issue: 'review' };
  if (!matching.length) return { status: 'not-recorded' };
  let grossCents = 0;
  for (const expense of matching) {
    if (!safeNonnegativeCents(expense.amount) || expense.amount <= 0)
      return { status: 'invalid', issue: 'amount' };
    if (expense.splitType !== 'self' && expense.splitType !== 'shared')
      return { status: 'invalid', issue: 'splits' };
    const splitError =
      expense.splitType === 'shared'
        ? getSplitAllocationError(expense.amount, expense.splits)
        : null;
    if (splitError !== null)
      return { status: 'invalid', issue: 'splits', message: splitError };
    grossCents += Math.round(expense.amount * 100);
    if (!Number.isSafeInteger(grossCents))
      return { status: 'invalid', issue: 'overflow' };
  }
  if (review.sources.expenses.length !== matching.length)
    return { status: 'invalid', issue: 'review' };
  let personalCents = 0;
  for (const source of review.sources.expenses) {
    if (
      source.personalCents === null ||
      !Number.isSafeInteger(source.personalCents) ||
      source.personalCents < 0
    )
      return { status: 'invalid', issue: 'review' };
    personalCents += source.personalCents;
    if (!Number.isSafeInteger(personalCents))
      return { status: 'invalid', issue: 'overflow' };
  }
  if (
    personalCents > grossCents ||
    review.personalSpending !== personalCents / 100
  )
    return { status: 'invalid', issue: 'review' };
  return {
    status: 'recorded',
    cents: personalCents,
    expenseCount: matching.length,
  };
}

export function compareBudget(limitCents: number, spending: BudgetSpending) {
  if (!Number.isSafeInteger(limitCents) || limitCents < 0)
    return { status: 'invalid-limit' as const };
  if (spending.status !== 'recorded') return { status: 'unavailable' as const };
  if (!Number.isSafeInteger(spending.cents) || spending.cents < 0)
    return { status: 'unavailable' as const };
  const remainingCents = limitCents - spending.cents;
  return {
    status:
      remainingCents < 0 ? ('over-limit' as const) : ('within-limit' as const),
    remainingCents,
  };
}

export function calculateReserve(
  targetCents: number,
  reservedCents: number,
  contributionCount: number
) {
  if (
    !Number.isSafeInteger(targetCents) ||
    targetCents < 0 ||
    !Number.isSafeInteger(reservedCents) ||
    reservedCents < 0 ||
    !Number.isInteger(contributionCount) ||
    contributionCount < 1 ||
    contributionCount > 12
  )
    return { status: 'invalid' as const };
  const remainingCents = Math.max(targetCents - reservedCents, 0);
  const regularContributionCents = Number(
    (BigInt(remainingCents) + BigInt(contributionCount) - BigInt(1)) /
      BigInt(contributionCount)
  );
  let unallocatedCents = remainingCents;
  const contributionsCents = Array.from({ length: contributionCount }, () => {
    const amount = Math.min(regularContributionCents, unallocatedCents);
    unallocatedCents -= amount;
    return amount;
  });
  return {
    status:
      remainingCents === 0 ? ('covered' as const) : ('remaining' as const),
    remainingCents,
    regularContributionCents,
    contributionsCents,
    finalContributionCents: contributionsCents[contributionCount - 1],
  };
}
