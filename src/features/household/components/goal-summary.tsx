'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatSGD } from '@/lib/utils/currency';
import { PERSON_COLORS } from '../constants';
import {
  breakdownSegments,
  goalBasis,
  goalCommitted,
  plannedTotal,
} from '../lib/goal-stats';
import type { HouseholdGoal } from '../types';

interface GoalSummaryProps {
  goal: HouseholdGoal;
  /** Result of `goalPace`: a monthly amount, 'past', or null when there is nothing to show. */
  pace: number | 'past' | null;
}

function Fact({
  label,
  hint,
  hintClassName,
  note,
  children,
}: {
  label: string;
  hint?: string;
  hintClassName?: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      {children}
      {hint && (
        <p className={cn('text-muted-foreground text-xs', hintClassName)}>
          {hint}
        </p>
      )}
      {note && <p className="text-muted-foreground text-xs">{note}</p>}
    </div>
  );
}

const toCents = (amount: number) => Math.round(amount * 100);

export function GoalSummary({ goal, pace }: GoalSummaryProps) {
  const { hidden, mask } = useAmountVisibility();
  const funded = goal.targetAmount > 0 && goal.contributed >= goal.targetAmount;
  const hasItems = goal.items.length > 0;
  const { overCommitted } = breakdownSegments(goal);

  // Hidden amounts must not reveal which basis the goal is on, so the card
  // falls back to the saved layout and neutral labels while masked.
  const paidBasis = goalBasis(goal) === 'paid' && !hidden;
  const planned = plannedTotal(goal);
  const leftToPay = goalCommitted(goal);

  const total = paidBasis ? goal.paid : goal.contributed;
  const entries = paidBasis
    ? goal.items.flatMap((item) => item.payments)
    : goal.contributions;
  const self = entries
    .filter((entry) => entry.isSelf)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const partner = total - self;
  const selfPct = total > 0 ? Math.round((self / total) * 100) : 0;
  const pct = paidBasis
    ? Math.min(100, Math.round((goal.paid / planned) * 100))
    : Math.round(goal.pct);

  // A goal funded past its target scales to what was saved, so the bar is full.
  const barScale = paidBasis
    ? Math.max(planned, goal.paid)
    : Math.max(goal.targetAmount, goal.contributed);
  const widthOf = (amount: number) =>
    barScale > 0 ? Math.max(0, (amount / barScale) * 100) : 0;
  const youWidth = widthOf(self);
  const partnerWidth = widthOf(partner);
  const legendVerb = paidBasis ? ' paid' : '';
  // Always present while hidden, so its absence cannot show that nothing was recorded.
  const showLegend = hidden || total > 0;
  const paidAheadOfSaved =
    !paidBasis && toCents(goal.paid) > toCents(goal.contributed);

  return (
    <section aria-label="Goal summary">
      <Card className="py-0">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-sm">
                  {hidden ? 'Progress' : paidBasis ? 'Paid' : 'Saved'}
                </p>
                <p className="text-3xl font-semibold tabular-nums">
                  <span className="whitespace-nowrap">
                    {mask(formatSGD(total))}
                  </span>{' '}
                  <span className="text-muted-foreground text-sm font-normal whitespace-nowrap">
                    of{' '}
                    {mask(formatSGD(paidBasis ? planned : goal.targetAmount))}
                    {paidBasis && ' budgeted'}
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
            {showLegend && (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
                <li className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      PERSON_COLORS.you.dot
                    )}
                  />
                  {mask(`You${legendVerb} ${formatSGD(self)} (${selfPct}%)`)}
                </li>
                <li className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      PERSON_COLORS.partner.dot
                    )}
                  />
                  {mask(
                    `Partner${legendVerb} ${formatSGD(partner)} (${100 - selfPct}%)`
                  )}
                </li>
              </ul>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 sm:grid-cols-3">
            {paidBasis ? (
              <>
                <Fact
                  label="Left to pay"
                  hint={
                    goal.paid > planned
                      ? `Over budget by ${mask(formatSGD(goal.paid - planned))}`
                      : leftToPay === 0
                        ? 'All paid'
                        : undefined
                  }
                  hintClassName={goal.paid > planned ? 'text-loss' : undefined}
                >
                  <p
                    className={cn(
                      'text-lg font-semibold whitespace-nowrap tabular-nums',
                      leftToPay === 0 && 'text-gain'
                    )}
                  >
                    {mask(formatSGD(leftToPay))}
                  </p>
                </Fact>
                <Fact
                  label="Saved"
                  hint={`of ${mask(formatSGD(goal.targetAmount))} target`}
                >
                  <p className="text-lg font-semibold whitespace-nowrap tabular-nums">
                    {mask(formatSGD(goal.contributed))}
                  </p>
                </Fact>
              </>
            ) : (
              <>
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
                    note={
                      !hidden && paidAheadOfSaved
                        ? `${mask(formatSGD(goal.paid - goal.contributed))} more than saved`
                        : undefined
                    }
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
              </>
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
