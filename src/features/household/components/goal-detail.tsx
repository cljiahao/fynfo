'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/widgets';
import { formatSGD } from '@/lib/utils/currency';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { ChevronLeft, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  GOAL_ITEM_LIMIT,
  HOUSEHOLD_PATH,
  RECENT_ACTIVITY_LIMIT,
  UNDO_DELAY_MS,
} from '../constants';
import { useDeleteGoal, useGoals, useHousehold } from '../hooks/use-household';
import { useJointGoalMonthly } from '../hooks/use-joint-goal-monthly';
import {
  UndoableDeleteProvider,
  useUndoableDelete,
} from '../hooks/use-undoable-delete';
import {
  breakdownSegments,
  goalCommitted,
  goalPlanShare,
  recentActivity,
  withoutPending,
  type ActivityEntry,
} from '../lib/goal-stats';
import type {
  GoalContribution,
  GoalItemPayment,
  HouseholdGoal,
} from '../types';
import { AddContributionDialog } from './add-contribution-dialog';
import { AddGoalItemDialog } from './add-goal-item-dialog';
import { ConfirmDeleteDialog } from './confirm-delete-dialog';
import { EditPaymentDialog } from './edit-payment-dialog';
import { GoalBurnUpChart } from './goal-burn-up-chart';
import { GoalDetailSkeleton } from './goal-detail-skeleton';
import { GoalEditorSheet } from './goal-editor-sheet';
import { GoalItemList } from './goal-item-list';
import { ItemBreakdownBar } from './item-breakdown-bar';

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
  const router = useRouter();
  const deleteGoal = useDeleteGoal();
  // Remounting the sheet per open re-seeds its draft from the current goal.
  const [editor, setEditor] = useState({ open: false, session: 0 });
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingContribution, setEditingContribution] =
    useState<GoalContribution | null>(null);
  const [editingPayment, setEditingPayment] = useState<{
    payment: GoalItemPayment;
    itemName: string;
  } | null>(null);
  // Totals follow the rows still shown so they stay consistent while a
  // deletion is in its undo window.
  const goal = withoutPending(source, pendingIds);

  const self = goal.contributions
    .filter((c) => c.isSelf)
    .reduce((sum, c) => sum + c.amount, 0);
  const selfPct =
    goal.contributed > 0 ? Math.round((self / goal.contributed) * 100) : 0;
  const funded = goal.targetAmount > 0 && goal.contributed >= goal.targetAmount;
  const jointMonthly = useJointGoalMonthly()?.get(goal.id) ?? null;
  const pace = goalPlanShare(goal, new Date(), jointMonthly);
  const hasItems = goal.items.length > 0;
  // Counted on the unfiltered goal: an item in its undo window still occupies a slot.
  const itemLimitReached = source.items.length >= GOAL_ITEM_LIMIT;
  const itemLimitReason = `A goal can have at most ${GOAL_ITEM_LIMIT} budget items`;
  const { overCommitted } = breakdownSegments(goal);
  const activity = recentActivity(goal, RECENT_ACTIVITY_LIMIT);

  function openEditor() {
    if (canReveal())
      setEditor((current) => ({ open: true, session: current.session + 1 }));
  }

  function openAddItem() {
    if (canReveal()) setAddItemOpen(true);
  }

  function editEntry(entry: ActivityEntry) {
    if (!canReveal()) return;
    if (entry.kind === 'contribution') {
      const found = goal.contributions.find((c) => c.id === entry.id);
      if (found) setEditingContribution(found);
      return;
    }
    for (const item of goal.items) {
      const found = item.payments.find((p) => p.id === entry.id);
      if (found) {
        setEditingPayment({ payment: found, itemName: item.name });
        break;
      }
    }
  }

  function confirmDelete() {
    deleteGoal.mutate(source.id, {
      onSuccess: () => {
        toast.success('Goal deleted');
        router.push(HOUSEHOLD_PATH);
      },
      onError: () => toast.error('Could not delete the goal'),
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <BackLink />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold break-words">
              {mask(goal.name)}
            </h1>
            {goal.targetDate && (
              <p className="text-muted-foreground text-sm">
                by{' '}
                {format(parseISO(goal.targetDate.slice(0, 10)), 'dd MMM yyyy')}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="pointer-coarse:min-h-11"
              disabled={hidden}
              onClick={openEditor}
            >
              <Pencil className="mr-1 size-3.5" />
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive pointer-coarse:min-h-11"
              disabled={hidden}
              onClick={() => {
                if (canReveal()) setDeleteOpen(true);
              }}
            >
              <Trash2 className="mr-1 size-3.5" />
              Delete
            </Button>
          </div>
        </div>
        <ItemBreakdownBar goal={goal} labels />
      </header>

      <div className="space-y-2">
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
            label="Share of monthly plan"
            value={
              hidden
                ? mask('')
                : pace === null
                  ? '-'
                  : pace === 'past'
                    ? 'Past target date'
                    : pace === 0
                      ? 'Nothing to set aside'
                      : `${mask(formatSGD(pace))}/mo`
            }
          />
        </div>
        {goal.contributed > 0 && (
          <p className="text-muted-foreground text-sm tabular-nums">
            {mask(`You ${selfPct}% / Partner ${100 - selfPct}%`)}
          </p>
        )}
      </div>

      <section className="space-y-3" aria-labelledby="burn-up-heading">
        <h2 id="burn-up-heading" className="font-semibold">
          Saved vs needed pace
        </h2>
        <GoalBurnUpChart goal={goal} />
      </section>

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
            disabled={hidden || itemLimitReached}
            title={itemLimitReached ? itemLimitReason : undefined}
            aria-describedby={
              itemLimitReached ? 'item-limit-reason' : undefined
            }
            onClick={openAddItem}
          >
            <Plus className="mr-1 size-3.5" />
            Add item
          </Button>
          {itemLimitReached && (
            <span id="item-limit-reason" className="sr-only">
              {itemLimitReason}
            </span>
          )}
        </div>
        {!hidden && overCommitted && (
          <p role="status" className="text-warning text-xs">
            Saved plus items still to pay total{' '}
            {mask(formatSGD(goal.contributed + goalCommitted(goal)))}, above the{' '}
            {mask(formatSGD(goal.targetAmount))} target.
          </p>
        )}
        {hasItems ? (
          <GoalItemList items={goal.items} />
        ) : (
          <p className="text-muted-foreground text-sm">
            Split this goal into budget items to track what is paid.
          </p>
        )}
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
                className="flex items-center justify-between gap-3"
              >
                <span className="min-w-0 break-words">
                  {activityText(entry, mask)}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-muted-foreground text-xs">
                    {format(parseISO(entry.date.slice(0, 10)), 'dd MMM yyyy')}
                  </span>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="text-muted-foreground relative after:absolute after:-inset-2.5 after:content-['']"
                    disabled={hidden}
                    aria-label={`Edit ${activityText(entry, mask)}`}
                    onClick={() => editEntry(entry)}
                  >
                    <Pencil className="size-3" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <GoalEditorSheet
        key={editor.session}
        goal={goal}
        open={editor.open}
        onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}
      />
      <AddGoalItemDialog
        key={addItemOpen ? 'open' : 'closed'}
        goal={source}
        open={addItemOpen}
        onOpenChange={setAddItemOpen}
      />
      <AddContributionDialog
        key={editingContribution?.id}
        goal={editingContribution ? goal : null}
        contribution={editingContribution}
        onOpenChange={(open) => !open && setEditingContribution(null)}
      />
      <EditPaymentDialog
        key={editingPayment?.payment.id}
        payment={editingPayment?.payment ?? null}
        itemName={editingPayment?.itemName ?? ''}
        onOpenChange={(open) => !open && setEditingPayment(null)}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${mask(goal.name)}?`}
        description={`This also deletes ${plural(goal.contributions.length, 'contribution')} and ${plural(goal.items.length, 'budget item')}. It cannot be undone.`}
        confirmLabel="Delete goal"
        onConfirm={confirmDelete}
        pending={deleteGoal.isPending}
      />
    </div>
  );
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
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
