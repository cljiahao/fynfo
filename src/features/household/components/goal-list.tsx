'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus, Target } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDeleteGoal } from '../hooks/use-household';
import type { HouseholdGoal } from '../types';
import { AddContributionDialog } from './add-contribution-dialog';
import { ConfirmDeleteDialog } from './confirm-delete-dialog';
import { CreateGoalDialog } from './create-goal-dialog';
import { GoalCard } from './goal-card';

interface GoalListProps {
  goals: HouseholdGoal[];
  className?: string;
  /** Opens the page-level create dialog; without it the list owns its own. */
  onCreate?: () => void;
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function GoalList({ goals, className, onCreate }: GoalListProps) {
  const { canReveal, mask } = useAmountVisibility();
  const deleteGoal = useDeleteGoal();
  const [contributingTo, setContributingTo] = useState<HouseholdGoal | null>(
    null
  );
  const [editing, setEditing] = useState<HouseholdGoal | null>(null);
  const [deleting, setDeleting] = useState<HouseholdGoal | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const requestRemove = (goal: HouseholdGoal) => {
    if (!canReveal()) return;
    setDeleting(goal);
  };

  const confirmRemove = () => {
    if (!deleting || !canReveal()) return;
    deleteGoal.mutate(deleting.id, {
      onSuccess: () => toast.success('Goal deleted'),
      onError: () => toast.error('Could not delete the goal'),
    });
  };

  const confirmDialog = (
    <ConfirmDeleteDialog
      open={deleting !== null}
      onOpenChange={(open) => !open && setDeleting(null)}
      title={deleting ? `Delete ${mask(deleting.name)}?` : 'Delete goal?'}
      description={
        deleting
          ? `This also deletes ${plural(deleting.contributions.length, 'contribution')} and ${plural(deleting.items.length, 'budget item')}. It cannot be undone.`
          : ''
      }
      confirmLabel="Delete goal"
      onConfirm={confirmRemove}
      pending={deleteGoal.isPending}
    />
  );

  if (goals.length === 0) {
    return (
      <>
        <div
          className={cn(
            'rounded-xl border border-dashed py-16 text-center',
            className
          )}
        >
          <Target className="text-muted-foreground/60 mx-auto size-8" />
          <p className="mt-3 font-medium">No goals yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Create your first shared goal to start saving together.
          </p>
          <Button
            className="mt-4"
            onClick={onCreate ?? (() => setCreateOpen(true))}
          >
            <Plus className="mr-1 size-4" />
            New goal
          </Button>
        </div>
        {!onCreate && (
          <CreateGoalDialog open={createOpen} onOpenChange={setCreateOpen} />
        )}
      </>
    );
  }

  return (
    <>
      <div className={cn('grid gap-4 sm:grid-cols-2', className)}>
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            className={goals.length === 1 ? 'sm:col-span-2' : undefined}
            onContribute={setContributingTo}
            onEdit={setEditing}
            onDelete={requestRemove}
          />
        ))}
      </div>
      <CreateGoalDialog
        key={editing?.id}
        goal={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <AddContributionDialog
        goal={contributingTo}
        onOpenChange={(open) => !open && setContributingTo(null)}
      />
      {confirmDialog}
    </>
  );
}
