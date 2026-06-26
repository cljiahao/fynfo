'use client';

import { Button } from '@/components/ui/button';
import { Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  useGoals,
  useHousehold,
  useUnlockHousehold,
} from '../hooks/use-household';
import { CreateGoalDialog } from './create-goal-dialog';
import { GoalList } from './goal-list';
import { HouseholdSetup } from './household-setup';
import { HouseholdSkeleton } from './household-skeleton';
import { InvitePanel } from './invite-panel';

export function HouseholdOverview() {
  const household = useHousehold();
  const hasHousehold = !!household.data;
  const goals = useGoals(hasHousehold);
  const unlock = useUnlockHousehold();
  const [createOpen, setCreateOpen] = useState(false);

  if (household.isLoading) return <HouseholdSkeleton />;

  if (household.isError) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center">
        <p className="font-medium">Couldn&apos;t load your household</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Refresh the page to try again.
        </p>
      </div>
    );
  }

  if (!household.data) {
    return (
      <div className="space-y-6">
        <Header subtitle="Save toward big purchases together." />
        <HouseholdSetup />
      </div>
    );
  }

  const locked = goals.isError;
  const isOwner = household.data.role === 'owner';

  const doUnlock = () =>
    unlock.mutate(undefined, {
      onError: () =>
        toast.error('Unlock your personal vault first, then try again.'),
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Header
          title={household.data.name}
          subtitle="Shared goals for your household."
        />
        {goals.data && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 size-4" />
            New goal
          </Button>
        )}
      </div>

      {goals.isLoading && !locked && <HouseholdSkeleton />}

      {locked && (
        <div className="rounded-xl border py-14 text-center">
          <div className="bg-muted flex-center mx-auto size-10 rounded-full">
            <Lock className="size-5" />
          </div>
          <p className="mt-3 font-medium">Household locked</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            Unlock to view and edit shared goals. This uses the PIN you already
            entered for your personal vault — no extra password.
          </p>
          <Button
            className="mt-4"
            onClick={doUnlock}
            disabled={unlock.isPending}
          >
            Unlock household
          </Button>
        </div>
      )}

      {goals.data && (
        <>
          {isOwner && <InvitePanel />}
          <GoalList goals={goals.data} />
          <CreateGoalDialog open={createOpen} onOpenChange={setCreateOpen} />
        </>
      )}
    </div>
  );
}

function Header({ title, subtitle }: { title?: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">
        {title ?? 'Household'}
      </h1>
      <p className="text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}
