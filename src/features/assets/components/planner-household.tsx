'use client';

import type { PlannerCommitment } from '@/features/household';
import { useAmountVisibility } from '@/features/privacy';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { formatSGD } from '@/lib/utils/currency';
import Link from 'next/link';

export type HouseholdQueryStatus = 'loading' | 'error' | 'ready';

const EXCLUDED_REASON: Record<'no-date' | 'funded', string> = {
  'no-date': 'no target date',
  funded: 'already funded',
};

function goalHref(goalId: string): string {
  return `${PAGE_ROUTES.HOUSEHOLD}/goals/${goalId}`;
}

/** Per-goal reserve, monthly deduction and excluded goals behind the Household row. */
export function HouseholdBreakdown({
  commitment,
}: {
  commitment: PlannerCommitment;
}) {
  const { mask } = useAmountVisibility();
  const reserve = commitment.goals.filter((g) => g.bucket === 'reserve');
  const pace = commitment.goals.filter((g) => g.bucket === 'pace');
  const budgetShare = commitment.budgets.monthlyShare;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="font-medium">
          Reserve (due within the horizon):{' '}
          {mask(formatSGD(commitment.reserve))}
        </p>
        {reserve.length === 0 ? (
          <p className="text-muted-foreground">No goals due yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {reserve.map((goal) => (
              <li key={goal.goalId} className="flex justify-between gap-2">
                <Link href={goalHref(goal.goalId)} className="underline">
                  {goal.name}
                </Link>
                <span className="tabular-nums">
                  {mask(formatSGD(goal.amount))} ({Math.round(goal.share * 100)}
                  %)
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-1">
        <p className="font-medium">
          Monthly: {mask(formatSGD(commitment.monthlyDeduction))}
        </p>
        <ul className="space-y-0.5">
          {budgetShare > 0 && (
            <li className="flex justify-between gap-2">
              <span>
                Spending budgets ({Math.round(commitment.budgets.share * 100)}%
                of {mask(formatSGD(commitment.budgets.monthlyTotal))})
              </span>
              <span className="tabular-nums">
                {mask(formatSGD(budgetShare))}
              </span>
            </li>
          )}
          {pace.map((goal) => (
            <li key={goal.goalId} className="flex justify-between gap-2">
              <Link href={goalHref(goal.goalId)} className="underline">
                {goal.name}
              </Link>
              <span className="tabular-nums">
                {mask(formatSGD(goal.amount))} a month
              </span>
            </li>
          ))}
          {budgetShare === 0 && pace.length === 0 && (
            <li className="text-muted-foreground">Nothing monthly.</li>
          )}
        </ul>
      </div>
      <p className="text-muted-foreground">
        Don&apos;t also log your share of a household goal or budget as a
        personal expense; it would be counted twice.
      </p>
      {commitment.excluded.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium">Not counted</p>
          <ul className="space-y-0.5">
            {commitment.excluded.map((goal) => (
              <li key={goal.goalId} className="flex justify-between gap-2">
                <Link href={goalHref(goal.goalId)} className="underline">
                  {goal.name}
                </Link>
                <span className="text-muted-foreground">
                  {EXCLUDED_REASON[goal.reason]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface HouseholdNoteProps {
  status: HouseholdQueryStatus;
  commitment: PlannerCommitment | undefined;
}

/** Why the household may be missing from the plan; nothing for "no household". */
export function HouseholdNote({ status, commitment }: HouseholdNoteProps) {
  if (status === 'loading')
    return (
      <p className="text-muted-foreground text-xs">
        Loading household commitments. Household not included yet.
      </p>
    );
  if (status === 'error' || !commitment)
    return (
      <p className="text-muted-foreground text-xs">
        Household commitments could not be loaded, so they are not included.
      </p>
    );
  if (commitment.state === 'locked')
    return (
      <p className="text-xs">
        <Link href={PAGE_ROUTES.HOUSEHOLD} className="underline">
          Unlock your household to include shared commitments.
        </Link>{' '}
        <span className="text-muted-foreground">
          Household not included, so the investment figure is not final.
        </span>
      </p>
    );
  if (commitment.state === 'ready' && commitment.isDefaultSplit)
    return (
      <p className="text-muted-foreground text-xs">
        Using a 50/50 household split.{' '}
        <Link href={PAGE_ROUTES.HOUSEHOLD} className="underline">
          Set your agreed split
        </Link>
        .
      </p>
    );
  return null;
}
