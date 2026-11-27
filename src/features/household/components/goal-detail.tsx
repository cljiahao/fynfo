'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatSGD } from '@/lib/utils/currency';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import {
  ChevronLeft,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  DEADLINE_SOON_DAYS,
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
import { itemsTotal } from '../lib/goal-items-total';
import {
  goalBasis,
  goalDeadline,
  goalPace,
  goalStatus,
  recentActivity,
  withoutPending,
  type ActivityEntry,
  type GoalDeadline,
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
import { GoalActivity } from './goal-activity';
import { GoalBurnUpChart } from './goal-burn-up-chart';
import { GoalDetailSkeleton } from './goal-detail-skeleton';
import { GoalEditorDialog } from './goal-editor-dialog';
import { GoalItemList } from './goal-item-list';
import { GoalSavingsList } from './goal-savings-list';
import { GoalStatusChip } from './goal-status-chip';
import { GoalSummary } from './goal-summary';
import { ItemBreakdownBar } from './item-breakdown-bar';

const BACK_LINK_CLASS =
  'text-muted-foreground hover:text-foreground -ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-sm';

type GoalTab = 'items' | 'savings';

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
  const [contribute, setContribute] = useState({ open: false, session: 0 });
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [tab, setTab] = useState<GoalTab>(() =>
    source.items.length > 0 ? 'items' : 'savings'
  );
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

  const [now] = useState(() => new Date());
  const status = goalStatus(goal, now);
  const deadline = goalDeadline(goal, now);
  const jointMonthly = useJointGoalMonthly()?.get(goal.id) ?? null;
  const basis = goalBasis(goal);
  const pace = goalPace(goal, now, jointMonthly);
  const hasItems = goal.items.length > 0;
  // Counted on the unfiltered goal: an item in its undo window still occupies a slot.
  const itemLimitReached = source.items.length >= GOAL_ITEM_LIMIT;
  const itemLimitReason = `A goal can have at most ${GOAL_ITEM_LIMIT} budget items`;
  const activity = recentActivity(goal, RECENT_ACTIVITY_LIMIT);

  function openEditor() {
    if (canReveal())
      setEditor((current) => ({ open: true, session: current.session + 1 }));
  }

  function openContribute() {
    if (canReveal())
      setContribute((current) => ({
        open: true,
        session: current.session + 1,
      }));
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
    <div className="space-y-6 lg:space-y-8">
      <header className="space-y-3">
        <BackLink />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold break-words">
              {mask(goal.name)}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {!hidden && <GoalStatusChip status={status} basis={basis} />}
              <DeadlineText deadline={deadline} dateOnly={hidden} />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground pointer-coarse:size-11"
                  disabled={hidden}
                  aria-label="Goal actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    if (canReveal()) setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete goal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <GoalSummary goal={goal} pace={pace} />

      {/* grid-cols-1 is minmax(0,1fr); the implicit auto column would grow to the chart's measured width and push the page wider than the viewport. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-x-8">
        <section className="min-w-0" aria-label="Budget items and savings">
          <Tabs
            value={tab}
            onValueChange={(next) => setTab(next as GoalTab)}
            className="gap-3"
          >
            <TabsList>
              <TabsTrigger value="items">
                Budget items
                {hasItems && (
                  <span className="text-muted-foreground font-normal">
                    ({goal.items.length})
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="savings">Savings</TabsTrigger>
            </TabsList>
            <TabsContent value="items" className="space-y-3">
              {hasItems && (
                <div className="flex justify-end">
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
                </div>
              )}
              {itemLimitReached && (
                <span id="item-limit-reason" className="sr-only">
                  {itemLimitReason}
                </span>
              )}
              {hasItems ? (
                <>
                  <ItemBreakdownBar goal={goal} labels showOverNote={false} />
                  <GoalItemList items={goal.items} memberIds={goal.memberIds} />
                  <p className="text-muted-foreground text-xs tabular-nums">
                    Items total {mask(formatSGD(itemsTotal(goal.items)))} vs
                    target {mask(formatSGD(goal.targetAmount))}
                  </p>
                </>
              ) : (
                <div className="rounded-xl border border-dashed py-8 text-center">
                  <p className="font-medium">No budget items yet</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Split this goal into items to track what is paid.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-4 pointer-coarse:min-h-11"
                    disabled={hidden}
                    onClick={openAddItem}
                  >
                    <Plus className="mr-1 size-3.5" />
                    Add item
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="savings">
              <GoalSavingsList
                goal={goal}
                onRecord={openContribute}
                onEdit={(contribution) => {
                  if (canReveal()) setEditingContribution(contribution);
                }}
              />
            </TabsContent>
          </Tabs>
        </section>

        {/* One grid item, so a tall items list cannot stretch the chart's row and open a gap above the activity. */}
        <div className="min-w-0 space-y-6 lg:space-y-8">
          <section className="space-y-3" aria-labelledby="burn-up-heading">
            <h2 id="burn-up-heading" className="text-base font-semibold">
              {basis === 'paid' && !hidden
                ? 'Payments over time'
                : 'Progress over time'}
            </h2>
            <GoalBurnUpChart goal={goal} />
          </section>

          <GoalActivity entries={activity} onEdit={editEntry} />
        </div>
      </div>

      <GoalEditorDialog
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
        key={contribute.session}
        goal={contribute.open ? goal : null}
        onOpenChange={(open) =>
          setContribute((current) => ({ ...current, open }))
        }
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
        goalMemberIds={goal.memberIds}
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

/** `dateOnly` drops the funded/overdue distinction, which would reveal whether the goal is funded while amounts are hidden. */
function DeadlineText({
  deadline,
  dateOnly,
}: {
  deadline: GoalDeadline;
  dateOnly: boolean;
}) {
  if (deadline.kind === 'none') return null;
  const date = format(parseISO(deadline.date), 'dd MMM yyyy');
  return (
    <p className="text-muted-foreground text-sm">
      Target {date}
      {!dateOnly &&
        deadline.kind === 'upcoming' &&
        ` · ${timeLeft(deadline.days)}`}
      {!dateOnly && deadline.kind === 'overdue' && (
        <>
          {' · '}
          <span className="text-loss-strong">Overdue</span> by{' '}
          {plural(deadline.days, 'day')}
        </>
      )}
    </p>
  );
}

function timeLeft(days: number): string {
  if (days === 0) return 'Due today';
  if (days <= DEADLINE_SOON_DAYS) return `${plural(days, 'day')} left`;
  return `about ${plural(Math.round(days / 30), 'month')} left`;
}
