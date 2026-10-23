'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/widgets';
import { Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  useGoals,
  useHousehold,
  useSpaces,
  useUnlockHousehold,
} from '../hooks/use-household';
import { CreateGoalDialog } from './create-goal-dialog';
import { GoalList } from './goal-list';
import { HouseholdSetup } from './household-setup';
import { HouseholdSkeleton } from './household-skeleton';
import { InvitePanel } from './invite-panel';
import { SharedSpending } from './shared-spending';

const VIEWS = [
  { id: 'goals', label: 'Goals' },
  { id: 'spending', label: 'Spending' },
] as const;
type View = (typeof VIEWS)[number]['id'];

export function HouseholdOverview() {
  const { hidden, canReveal } = useAmountVisibility();
  const household = useHousehold();
  // Lock state is authoritative from the session (cookie), not inferred from a
  // failed goals read — so a real DB error doesn't masquerade as "locked".
  const locked = !!household.data && household.data.locked;
  const goals = useGoals(!!household.data && !locked);
  const [view, setView] = useState<View>('goals');
  const spaces = useSpaces(!!household.data && !locked && view === 'spending');
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
        <PageHeader
          title="Household"
          description="Save toward big purchases together."
        />
        <HouseholdSetup />
      </div>
    );
  }

  const isOwner = household.data.role === 'owner';

  const doUnlock = () =>
    unlock.mutate(undefined, {
      onError: () =>
        toast.error('Unlock your personal vault first, then try again.'),
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title={household.data.name}
        description="Shared goals and spending for your household."
        action={
          !locked &&
          view === 'goals' &&
          goals.data && (
            <Button
              disabled={hidden}
              onClick={() => {
                if (canReveal()) setCreateOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-4" />
              New goal
            </Button>
          )
        }
      />

      {!locked && (
        <div
          role="group"
          aria-label="Household views"
          className="flex gap-1 border-b pb-3"
        >
          {VIEWS.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant={view === option.id ? 'secondary' : 'ghost'}
              aria-pressed={view === option.id}
              onClick={() => setView(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}

      {!locked && view === 'spending' && spaces.isLoading && (
        <HouseholdSkeleton />
      )}
      {!locked && view === 'spending' && spaces.isError && (
        <div className="rounded-xl border border-dashed py-14 text-center">
          <p className="font-medium">Couldn&apos;t load shared spending</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Refresh to try again.
          </p>
        </div>
      )}
      {!locked && view === 'spending' && spaces.data && (
        <SharedSpending spaces={spaces.data} />
      )}

      {!locked && view === 'goals' && goals.isLoading && <HouseholdSkeleton />}

      {!locked && view === 'goals' && goals.isError && (
        <div className="rounded-xl border border-dashed py-14 text-center">
          <p className="font-medium">Couldn&apos;t load your goals</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Something went wrong reading this household. Refresh to try again.
          </p>
        </div>
      )}

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

      {!locked && view === 'goals' && goals.data && (
        <>
          {isOwner && <InvitePanel />}
          <GoalList goals={goals.data} />
          <CreateGoalDialog open={createOpen} onOpenChange={setCreateOpen} />
        </>
      )}
    </div>
  );
}
