'use client';

import { Target } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDeleteGoal } from '../hooks/use-household';
import type { HouseholdGoal } from '../types';
import { AddContributionDialog } from './add-contribution-dialog';
import { GoalCard } from './goal-card';

export function GoalList({ goals }: { goals: HouseholdGoal[] }) {
  const deleteGoal = useDeleteGoal();
  const [contributingTo, setContributingTo] = useState<HouseholdGoal | null>(
    null
  );

  const remove = (goal: HouseholdGoal) => {
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
            onDelete={remove}
          />
        ))}
      </div>
      <AddContributionDialog
        goal={contributingTo}
        onOpenChange={(open) => !open && setContributingTo(null)}
      />
    </>
  );
}
