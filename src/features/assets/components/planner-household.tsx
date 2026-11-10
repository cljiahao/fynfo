'use client';

import {
  HouseholdRecommendations,
  HouseholdYearTable,
  type HouseholdPlan,
  type HouseholdPlanInput,
  type HouseholdRecommendation,
} from '@/features/household';
import { useAmountVisibility } from '@/features/privacy';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { formatSGD } from '@/lib/utils/currency';
import Link from 'next/link';

export type HouseholdQueryStatus = 'loading' | 'error' | 'ready';

function goalHref(goalId: string): string {
  return `${PAGE_ROUTES.HOUSEHOLD}/goals/${goalId}`;
}

interface HouseholdBreakdownProps {
  input: HouseholdPlanInput;
  plan: HouseholdPlan;
  recommendations: HouseholdRecommendation[];
  now: Date;
}

/** Per-goal monthly figures, budgets, the per-year table and plan notes behind the Household row. */
export function HouseholdBreakdown({
  input,
  plan,
  recommendations,
  now,
}: HouseholdBreakdownProps) {
  const { mask } = useAmountVisibility();
  const goalNames = new Map(input.goals.map((goal) => [goal.id, goal.name]));
  const goalLines = plan.perGoal.filter((goal) => goal.monthly > 0);

  return (
    <div className="space-y-3">
      <p className="font-medium">
        Set aside {mask(formatSGD(plan.monthly))} this month
      </p>
      <ul className="space-y-0.5">
        {goalLines.map((goal) => (
          <li key={goal.goalId} className="flex justify-between gap-2">
            <Link href={goalHref(goal.goalId)} className="underline">
              {goalNames.get(goal.goalId) ?? 'Goal'}
            </Link>
            <span className="tabular-nums">
              {mask(formatSGD(goal.monthly))} a month
            </span>
          </li>
        ))}
        {plan.budgetsMonthly > 0 && (
          <li className="flex justify-between gap-2">
            <span>Spending budgets</span>
            <span className="tabular-nums">
              {mask(formatSGD(plan.budgetsMonthly))} a month
            </span>
          </li>
        )}
        {goalLines.length === 0 && plan.budgetsMonthly === 0 && (
          <li className="text-muted-foreground">Nothing to set aside.</li>
        )}
      </ul>
      <p className="text-muted-foreground">
        Don&apos;t also log your share of a household goal or budget as a
        personal expense; it would be counted twice.
      </p>
      <HouseholdYearTable schedule={plan.schedule} goals={input.goals} />
      <HouseholdRecommendations recommendations={recommendations} now={now} />
    </div>
  );
}

interface HouseholdNoteProps {
  status: HouseholdQueryStatus;
  input: HouseholdPlanInput | undefined;
}

/** Why the household may be missing from the plan; nothing for "no household". */
export function HouseholdNote({ status, input }: HouseholdNoteProps) {
  if (status === 'loading')
    return (
      <p className="text-muted-foreground text-xs">
        Loading household commitments. Household not included yet.
      </p>
    );
  if (status === 'error' || !input)
    return (
      <p className="text-muted-foreground text-xs">
        Household commitments could not be loaded, so they are not included.
      </p>
    );
  if (input.state === 'locked')
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
  if (input.state === 'ready' && input.isDefaultSplit)
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
