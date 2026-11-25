'use client';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/widgets';
import { ChevronLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import {
  HOUSEHOLD_PATH,
  QUICK_ADD_AMOUNT_ID,
  UNDO_DELAY_MS,
} from '../constants';
import { useHousehold, useSpaces } from '../hooks/use-household';
import { UndoableDeleteProvider } from '../hooks/use-undoable-delete';
import { HouseholdLocked } from './household-locked';
import { HouseholdSetup } from './household-setup';
import { HouseholdSkeleton } from './household-skeleton';
import { SharedSpending } from './shared-spending';

const BACK_LINK_CLASS =
  'text-muted-foreground hover:text-foreground -ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-sm';

function BackLink() {
  return (
    <Link href={HOUSEHOLD_PATH} className={BACK_LINK_CLASS}>
      <ChevronLeft className="size-4" />
      Household
    </Link>
  );
}

export function HouseholdSpendingView() {
  const household = useHousehold();
  const locked = !!household.data && household.data.locked;
  const spaces = useSpaces(!!household.data && !locked);

  if (household.isLoading) return <HouseholdSkeleton />;

  if (household.isError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="font-medium">Couldn&apos;t load your household</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Refresh the page to try again.
          </p>
        </div>
      </div>
    );
  }

  if (!household.data) {
    return (
      <div className="space-y-6">
        <BackLink />
        <PageHeader
          title="Household"
          description="Save toward big purchases together."
        />
        <HouseholdSetup />
      </div>
    );
  }

  const focusQuickAdd = () =>
    document.getElementById(QUICK_ADD_AMOUNT_ID)?.focus();

  return (
    <UndoableDeleteProvider delayMs={UNDO_DELAY_MS}>
      <div className="space-y-6">
        <BackLink />
        <PageHeader
          title="Shared spending"
          description={`Spending you share in ${household.data.name}.`}
          action={
            !locked && (
              <Button onClick={focusQuickAdd}>
                <Plus className="mr-1.5 size-4" />
                Add spending
              </Button>
            )
          }
        />

        {locked && <HouseholdLocked />}

        {!locked && (
          <>
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
          </>
        )}
      </div>
    </UndoableDeleteProvider>
  );
}
