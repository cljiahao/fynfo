'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/widgets';
import { Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  HOUSEHOLD_MEMBER_CAP,
  QUICK_ADD_AMOUNT_ID,
  UNDO_DELAY_MS,
} from '../constants';
import {
  useGoals,
  useHousehold,
  useSpaces,
  useUnlockHousehold,
} from '../hooks/use-household';
import { UndoableDeleteProvider } from '../hooks/use-undoable-delete';
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

  const showInvite =
    household.data.role === 'owner' &&
    household.data.memberCount < HOUSEHOLD_MEMBER_CAP;

  const focusQuickAdd = () =>
    document.getElementById(QUICK_ADD_AMOUNT_ID)?.focus();

  const doUnlock = () =>
    unlock.mutate(undefined, {
      onError: () =>
        toast.error('Unlock your personal vault first, then try again.'),
    });

  return (
    <UndoableDeleteProvider delayMs={UNDO_DELAY_MS}>
      <div className="space-y-6">
        <PageHeader
          title={household.data.name}
          description="Shared goals and spending for your household."
          action={
            !locked &&
            (view === 'goals' ? (
              <Button
                disabled={hidden || !goals.data}
                onClick={() => {
                  if (canReveal()) setCreateOpen(true);
                }}
              >
                <Plus className="mr-1.5 size-4" />
                New goal
              </Button>
            ) : (
              <Button onClick={focusQuickAdd}>
                <Plus className="mr-1.5 size-4" />
                Add spending
              </Button>
            ))
          }
        />

        {!locked && (
          <Tabs value={view} onValueChange={(next) => setView(next as View)}>
            <TabsList>
              {VIEWS.map((option) => (
                <TabsTrigger
                  key={option.id}
                  value={option.id}
                  className="data-[state=active]:bg-card dark:data-[state=active]:bg-card"
                >
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="goals" className="space-y-6">
              {goals.isLoading && <HouseholdSkeleton />}
              {goals.isError && (
                <div className="rounded-xl border border-dashed py-14 text-center">
                  <p className="font-medium">Couldn&apos;t load your goals</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Something went wrong reading this household. Refresh to try
                    again.
                  </p>
                </div>
              )}
              {goals.data && (
                <>
                  {showInvite && <InvitePanel />}
                  <GoalList
                    goals={goals.data}
                    onCreate={() => {
                      if (canReveal()) setCreateOpen(true);
                    }}
                  />
                  <CreateGoalDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="spending" className="space-y-6">
              {spaces.isLoading && <HouseholdSkeleton />}
              {spaces.isError && (
                <div className="rounded-xl border border-dashed py-14 text-center">
                  <p className="font-medium">
                    Couldn&apos;t load shared spending
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Refresh to try again.
                  </p>
                </div>
              )}
              {spaces.data && <SharedSpending spaces={spaces.data} />}
            </TabsContent>
          </Tabs>
        )}

        {locked && (
          <div className="rounded-xl border py-14 text-center">
            <div className="bg-muted flex-center mx-auto size-10 rounded-full">
              <Lock className="size-5" />
            </div>
            <p className="mt-3 font-medium">Household locked</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
              Unlock to view and edit shared goals. This uses the PIN you
              already entered for your personal vault — no extra password.
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
      </div>
    </UndoableDeleteProvider>
  );
}
