'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatSGD } from '@/lib/utils/currency';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { Pencil, Plus } from 'lucide-react';
import { PERSON_COLORS } from '../constants';
import type { GoalContribution, HouseholdGoal } from '../types';

interface GoalSavingsListProps {
  goal: HouseholdGoal;
  onRecord: () => void;
  onEdit: (contribution: GoalContribution) => void;
}

export function GoalSavingsList({
  goal,
  onRecord,
  onEdit,
}: GoalSavingsListProps) {
  const { hidden, mask } = useAmountVisibility();
  const entries = [...goal.contributions].sort(
    (a, b) => Date.parse(b.date) - Date.parse(a.date)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm tabular-nums">
          {mask(formatSGD(goal.contributed))}
          <span className="text-muted-foreground">
            {' '}
            saved of {mask(formatSGD(goal.targetAmount))}
          </span>
        </p>
        <Button
          type="button"
          size="sm"
          className="pointer-coarse:min-h-11"
          disabled={hidden}
          onClick={onRecord}
        >
          <Plus className="mr-1 size-3.5" />
          Record saving
        </Button>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed py-8 text-center">
          <p className="font-medium">No savings recorded yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Record a saving to start building towards this goal.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {entries.map((entry) => {
            const dot = entry.isSelf
              ? PERSON_COLORS.you
              : PERSON_COLORS.partner;
            const who = entry.isSelf ? 'You' : 'Partner';
            const day = format(
              parseISO(entry.date.slice(0, 10)),
              'dd MMM yyyy'
            );
            const amount = mask(formatSGD(entry.amount));
            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm sm:px-4"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn('size-2 shrink-0 rounded-full', dot.dot)}
                  />
                  <span className="min-w-0 break-words">
                    {who} saved {amount}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                    {day}
                  </span>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="text-muted-foreground relative after:absolute after:-inset-2.5 after:content-[''] pointer-coarse:size-11 pointer-coarse:after:hidden"
                    disabled={hidden}
                    aria-label={`Edit saving of ${amount} on ${day}`}
                    onClick={() => onEdit(entry)}
                  >
                    <Pencil className="size-3" />
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
