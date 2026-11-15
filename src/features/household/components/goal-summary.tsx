'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatSGD } from '@/lib/utils/currency';
import { PERSON_COLORS } from '../constants';
import { breakdownSegments, goalCommitted } from '../lib/goal-stats';
import type { HouseholdGoal } from '../types';

interface GoalSummaryProps {
  goal: HouseholdGoal;
  /** Result of `goalPlanShare`: a monthly amount, 'past', or null when there is nothing to show. */
  pace: number | 'past' | null;
}

function Fact({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

export function GoalSummary({ goal, pace }: GoalSummaryProps) {
  const { hidden, mask } = useAmountVisibility();
  const funded = goal.targetAmount > 0 && goal.contributed >= goal.targetAmount;
  const hasItems = goal.items.length > 0;
  const { overCommitted } = breakdownSegments(goal);

  const self = goal.contributions
    .filter((c) => c.isSelf)
    .reduce((sum, c) => sum + c.amount, 0);
  const partner = goal.contributed - self;
  const selfPct =
    goal.contributed > 0 ? Math.round((self / goal.contributed) * 100) : 0;
  const pct = Math.round(goal.pct);

  // A goal funded past its target scales to what was saved, so the bar is full.
  const barScale = Math.max(goal.targetAmount, goal.contributed);
  const widthOf = (amount: number) =>
    barScale > 0 ? Math.max(0, (amount / barScale) * 100) : 0;
  const youWidth = widthOf(self);
  const partnerWidth = widthOf(partner);

  return (
    <section aria-label="Goal summary">
      <Card className="py-0">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-sm">Saved</p>
                <p className="text-3xl font-semibold tabular-nums">
                  <span className="whitespace-nowrap">
                    {mask(formatSGD(goal.contributed))}
                  </span>{' '}
                  <span className="text-muted-foreground text-sm font-normal whitespace-nowrap">
                    of {mask(formatSGD(goal.targetAmount))}
                  </span>
                </p>
              </div>
              <p className="shrink-0 pb-1 text-sm font-medium whitespace-nowrap tabular-nums">
                {mask(`${pct}%`)}
              </p>
            </div>
            {/* The track stays while amounts are hidden so the height is stable; fills would reveal the masked percentage. */}
            <div className="bg-muted h-3 w-full overflow-hidden rounded-full">
              {!hidden && (
                <svg aria-hidden="true" className="block h-full w-full">
                  <rect
                    x="0"
                    width={`${youWidth}%`}
                    height="100%"
                    className={cn(PERSON_COLORS.you.fill, 'stroke-background')}
                  />
                  <rect
                    x={`${youWidth}%`}
                    width={`${partnerWidth}%`}
                    height="100%"
                    className={cn(
                      PERSON_COLORS.partner.fill,
                      'stroke-background'
                    )}
                  />
                </svg>
              )}
            </div>
            {goal.contributed > 0 && (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
                <li className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      PERSON_COLORS.you.dot
                    )}
                  />
                  {mask(`You ${formatSGD(self)} (${selfPct}%)`)}
                </li>
                <li className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      PERSON_COLORS.partner.dot
                    )}
                  />
                  {mask(`Partner ${formatSGD(partner)} (${100 - selfPct}%)`)}
                </li>
              </ul>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 sm:grid-cols-3">
            <Fact
              label="Remaining"
              hint={!hidden && funded ? 'Target reached' : undefined}
            >
              <p
                className={cn(
                  'text-lg font-semibold whitespace-nowrap tabular-nums',
                  !hidden && funded && 'text-gain'
                )}
              >
                {mask(formatSGD(goal.remaining))}
              </p>
            </Fact>
            {hasItems && (
              <Fact
                label="Paid out"
                hint={`of ${mask(formatSGD(goal.budgeted))} budgeted`}
              >
                <p
                  className={cn(
                    'text-lg font-semibold whitespace-nowrap tabular-nums',
                    !hidden && goal.paid > goal.budgeted && 'text-loss'
                  )}
                >
                  {mask(formatSGD(goal.paid))}
                </p>
              </Fact>
            )}
            <Fact
              label="Monthly share"
              hint={
                typeof pace === 'number' && !hidden ? 'of your plan' : undefined
              }
            >
              {hidden ? (
                <p className="text-lg font-semibold">{mask('')}</p>
              ) : typeof pace === 'number' && pace > 0 ? (
                <p className="text-lg font-semibold whitespace-nowrap tabular-nums">
                  {mask(formatSGD(pace))}/mo
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {pace === 'past'
                    ? 'Past target date'
                    : pace === 0
                      ? 'Nothing to set aside'
                      : '-'}
                </p>
              )}
            </Fact>
          </div>

          {!hidden && overCommitted && (
            <p
              role="status"
              className="bg-warning-subtle text-warning-strong rounded-lg px-3 py-2 text-sm"
            >
              Saved plus items still to pay total{' '}
              <span className="whitespace-nowrap">
                {mask(formatSGD(goal.contributed + goalCommitted(goal)))}
              </span>
              , above the{' '}
              <span className="whitespace-nowrap">
                {mask(formatSGD(goal.targetAmount))}
              </span>{' '}
              target.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
