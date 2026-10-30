'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Target } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDeleteGoal } from '../hooks/use-household';
import type { HouseholdGoal } from '../types';
import { AddContributionDialog } from './add-contribution-dialog';
import { CreateGoalDialog } from './create-goal-dialog';
import { GoalCard } from './goal-card';

export function GoalList({ goals }: { goals: HouseholdGoal[] }) {
  const { canReveal } = useAmountVisibility();
  const deleteGoal = useDeleteGoal();
  const [contributingTo, setContributingTo] = useState<HouseholdGoal | null>(
    null
  );

  const [editing, setEditing] = useState<HouseholdGoal | null>(null);

  const remove = (goal: HouseholdGoal) => {
    if (!canReveal()) return;
    deleteGoal.mutate(goal.id, {
      onSuccess: () => toast.success('Goal deleted'),
      onError: () => toast.error('Could not delete the goal'),
    });
  };

  if (goals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center">
        <Target className="text-muted-foreground/60 mx-auto size-8" />
        <p className="mt-3 font-medium">No goals yet</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Create your first shared goal to start saving together.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onContribute={setContributingTo}
            onEdit={setEditing}
            onDelete={remove}
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
    </>
  );
}
