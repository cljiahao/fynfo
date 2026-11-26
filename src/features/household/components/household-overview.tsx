'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/widgets';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  HOUSEHOLD_MEMBER_CAP,
  HOUSEHOLD_SPENDING_PATH,
  UNDO_DELAY_MS,
} from '../constants';
import { useGoals, useHousehold } from '../hooks/use-household';
import { UndoableDeleteProvider } from '../hooks/use-undoable-delete';
import { GoalEditorSheet } from './goal-editor-sheet';
import { GoalList } from './goal-list';
import { HouseholdLocked } from './household-locked';
import { HouseholdPlanSummary } from './household-plan-summary';
import { HouseholdSetup } from './household-setup';
import { HouseholdSkeleton } from './household-skeleton';
import { InviteMemberDialog } from './invite-member-dialog';
import { MemberNameField } from './member-name-field';
import { PlannerSplitEditor } from './planner-split-editor';

interface HouseholdOverviewProps {
  /** The caller's spare savings, computed in their browser; null if unknown. */
  personalSurplus?: number | null;
}

export function HouseholdOverview({
  personalSurplus = null,
}: HouseholdOverviewProps) {
  const { hidden, canReveal } = useAmountVisibility();
  const household = useHousehold();
  // Lock state is authoritative from the session (cookie), not inferred from a
  // failed goals read — so a real DB error doesn't masquerade as "locked".
  const locked = !!household.data && household.data.locked;
  const goals = useGoals(!!household.data && !locked);
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

  const isFull = household.data.memberCount >= HOUSEHOLD_MEMBER_CAP;
  const canInvite = household.data.role === 'owner' && !isFull;

  return (
    <UndoableDeleteProvider delayMs={UNDO_DELAY_MS}>
      <div className="space-y-6">
        <PageHeader
          title={household.data.name}
          description="Shared goals for your household."
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canInvite && (
                <InviteMemberDialog memberCount={household.data.memberCount} />
              )}
              {isFull && (
                <span className="text-muted-foreground text-xs">
                  {household.data.memberCount} of {HOUSEHOLD_MEMBER_CAP} members
                </span>
              )}
              {!isFull && !canInvite && (
                <span className="text-muted-foreground text-xs">
                  Only the owner can invite members
                </span>
              )}
              {!locked && (
                <>
                  <Button variant="outline" asChild>
                    <Link href={HOUSEHOLD_SPENDING_PATH}>Shared spending</Link>
                  </Button>
                  <Button
                    disabled={hidden || !goals.data}
                    onClick={() => {
                      if (canReveal()) setCreateOpen(true);
                    }}
                  >
                    <Plus className="mr-1.5 size-4" />
                    New goal
                  </Button>
                </>
              )}
            </div>
          }
        />

        {!locked && (
          <>
            <MemberNameField
              current={
                household.data.memberNames?.[household.data.userId] ?? ''
              }
            />
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
                <GoalList
                  goals={goals.data}
                  onCreate={() => {
                    if (canReveal()) setCreateOpen(true);
                  }}
                />
                <GoalEditorSheet
                  open={createOpen}
                  onOpenChange={setCreateOpen}
                />
                <details className="rounded-xl border px-4 py-3">
                  <summary className="focus-visible:outline-ring cursor-pointer rounded-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4">
                    Monthly plan
                  </summary>
                  <div className="mt-4 space-y-6">
                    <HouseholdPlanSummary personalSurplus={personalSurplus} />
                    {household.data.memberCount === HOUSEHOLD_MEMBER_CAP && (
                      <PlannerSplitEditor />
                    )}
                  </div>
                </details>
              </>
            )}
          </>
        )}

        {locked && <HouseholdLocked />}
      </div>
    </UndoableDeleteProvider>
  );
}
