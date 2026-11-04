'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { ProgressBar, StatCard } from '@/components/widgets';
import { formatSGD } from '@/lib/utils/currency';
import { format } from 'date-fns';
import { ChevronLeft, Lock, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  HOUSEHOLD_PATH,
  PERSON_COLORS,
  RECENT_ACTIVITY_LIMIT,
  UNDO_DELAY_MS,
} from '../constants';
import { useGoals, useHousehold } from '../hooks/use-household';
import {
  UndoableDeleteProvider,
  useUndoableDelete,
} from '../hooks/use-undoable-delete';
import {
  monthlyPaceNeeded,
  recentActivity,
  withoutPending,
  type ActivityEntry,
} from '../lib/goal-stats';
import type { HouseholdGoal } from '../types';
import { AddItemDialog } from './add-item-dialog';
import { GoalContributionsChart } from './goal-contributions-chart';
import { GoalDetailSkeleton } from './goal-detail-skeleton';
import { GoalItemList } from './goal-item-list';
import { GoalItemsChart } from './goal-items-chart';

const BACK_LINK_CLASS =
  'text-muted-foreground hover:text-foreground -ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-sm';

function BackLink() {
  return (
    <Link href={HOUSEHOLD_PATH} className={BACK_LINK_CLASS}>
      <ChevronLeft className="size-4" />
      Goals
    </Link>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed py-14 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 text-sm">{body}</p>
    </div>
  );
}

export function GoalDetail({ goalId }: { goalId: string }) {
  const household = useHousehold();
  // Lock state comes from the session, as on the overview page, so a real read
  // error is not mistaken for a locked household.
  const locked = !!household.data && household.data.locked;
  const goals = useGoals(!!household.data && !locked);

  if (household.isLoading) return <GoalDetailSkeleton />;

  if (household.isError) {
    return (
      <Notice
        title="Couldn't load your household"
        body="Refresh the page to try again."
      />
    );
  }

  if (!household.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Notice
          title="No household yet"
          body="Set one up on the Household page."
        />
      </div>
    );
  }

  if (locked) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-xl border py-14 text-center">
          <div className="bg-muted flex-center mx-auto size-10 rounded-full">
            <Lock className="size-5" />
          </div>
          <p className="mt-3 font-medium">Household locked</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            Unlock it on the Household page to view this goal.
          </p>
          <Button asChild className="mt-4">
            <Link href={HOUSEHOLD_PATH}>Go to Household</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (goals.isLoading || (!goals.data && !goals.isError)) {
    return <GoalDetailSkeleton />;
  }

  if (goals.isError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Notice
          title="Couldn't load your goals"
          body="Something went wrong reading this household. Refresh to try again."
        />
      </div>
    );
  }

  const goal = goals.data?.find((candidate) => candidate.id === goalId);
  if (!goal) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Notice
          title="Goal not found"
          body="It may have been deleted, or it belongs to another household."
        />
      </div>
    );
  }

  return (
    <UndoableDeleteProvider delayMs={UNDO_DELAY_MS}>
      <GoalDetailBody goal={goal} />
    </UndoableDeleteProvider>
  );
}

function GoalDetailBody({ goal: source }: { goal: HouseholdGoal }) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const { pendingIds } = useUndoableDelete();
  const [addOpen, setAddOpen] = useState(false);
  // Totals follow the rows still shown so they stay consistent while a
  // deletion is in its undo window.
  const goal = withoutPending(source, pendingIds);

  const self = goal.contributions
    .filter((c) => c.isSelf)
    .reduce((sum, c) => sum + c.amount, 0);
  const partner = goal.contributed - self;
  const selfPct = pctOf(self, goal.targetAmount);
  const partnerPct = Math.min(100 - selfPct, pctOf(partner, goal.targetAmount));
  const funded = goal.targetAmount > 0 && goal.contributed >= goal.targetAmount;
  const pace = monthlyPaceNeeded(goal, new Date());
  const hasItems = goal.items.length > 0;
  const activity = recentActivity(goal, RECENT_ACTIVITY_LIMIT);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <BackLink />
        <div>
          <h1 className="text-2xl font-semibold break-words">
            {mask(goal.name)}
          </h1>
          {goal.targetDate && (
            <p className="text-muted-foreground text-sm">
              by {format(new Date(goal.targetDate), 'dd MMM yyyy')}
            </p>
          )}
        </div>
        {/* The track stays while amounts are hidden so the header height is
            stable; the fill would reveal the masked percentage. */}
        <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
          {!hidden && (
            <ProgressBar
              segments={[
                { pct: selfPct, className: PERSON_COLORS.you.fill },
                { pct: partnerPct, className: PERSON_COLORS.partner.fill },
              ]}
            />
          )}
        </div>
        <p className="text-muted-foreground text-sm tabular-nums">
          You {mask(formatSGD(self))} · Partner {mask(formatSGD(partner))}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Contributed"
          value={mask(formatSGD(goal.contributed))}
          hint={`of ${mask(formatSGD(goal.targetAmount))}`}
        />
        <StatCard
          label="Remaining"
          value={mask(formatSGD(goal.remaining))}
          tone={!hidden && funded ? 'gain' : 'default'}
        />
        {hasItems && (
          <StatCard
            label="Paid"
            value={mask(formatSGD(goal.paid))}
            tone={!hidden && goal.paid > goal.budgeted ? 'loss' : 'default'}
            hint={`of ${mask(formatSGD(goal.budgeted))} budgeted`}
          />
        )}
        <StatCard
          label="Monthly pace"
          value={
            pace === null
              ? '-'
              : pace === 'past'
                ? 'Past target date'
                : `${mask(formatSGD(pace))}/mo`
          }
        />
      </div>

      <section className="space-y-3" aria-labelledby="contributions-heading">
        <h2 id="contributions-heading" className="font-semibold">
          Contributions over time
        </h2>
        {goal.contributions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No contributions yet.</p>
        ) : (
          <GoalContributionsChart goal={goal} />
        )}
      </section>

      {hasItems && (
        <section className="space-y-3" aria-labelledby="budget-chart-heading">
          <h2 id="budget-chart-heading" className="font-semibold">
            Budget vs paid
          </h2>
          <GoalItemsChart goal={goal} />
        </section>
      )}

      <section className="space-y-3" aria-labelledby="items-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="items-heading" className="font-semibold">
            Budget items
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="pointer-coarse:min-h-11"
            disabled={hidden}
            onClick={() => {
              if (canReveal()) setAddOpen(true);
            }}
          >
            <Plus className="mr-1 size-3.5" />
            Add item
          </Button>
        </div>
        {!hidden && goal.budgeted > goal.targetAmount && (
          <p role="status" className="text-warning text-xs">
            Items total {formatSGD(goal.budgeted)}, above the{' '}
            {formatSGD(goal.targetAmount)} target.
          </p>
        )}
        {hasItems ? (
          <GoalItemList items={goal.items} />
        ) : (
          <p className="text-muted-foreground text-sm">
            Split this goal into budget items to track what is paid.
          </p>
        )}
        <AddItemDialog goal={goal} open={addOpen} onOpenChange={setAddOpen} />
      </section>

      <section className="space-y-3" aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="font-semibold">
          Recent activity
        </h2>
        {activity.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activity.map((entry) => (
              <li
                key={entry.id}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="min-w-0 break-words">
                  {activityText(entry, mask)}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {format(new Date(entry.date), 'dd MMM yyyy')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function pctOf(amount: number, target: number) {
  return target > 0 ? Math.max(0, Math.min(100, (amount / target) * 100)) : 0;
}

function activityText(
  entry: ActivityEntry,
  mask: (value: string) => string
): string {
  const who = entry.isSelf ? 'You' : 'Partner';
  const amount = mask(formatSGD(entry.amount));
  return entry.kind === 'contribution'
    ? `${who} added ${amount}`
    : `${who} paid ${amount} to ${mask(entry.itemName ?? '')}`;
}
