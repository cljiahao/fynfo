'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatSGD } from '@/lib/utils/currency';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { Pencil } from 'lucide-react';
import { PERSON_COLORS } from '../constants';
import type { ActivityEntry } from '../lib/goal-stats';

export function activityText(
  entry: ActivityEntry,
  mask: (value: string) => string
): string {
  const who = entry.isSelf ? 'You' : 'Partner';
  const amount = mask(formatSGD(entry.amount));
  return entry.kind === 'contribution'
    ? `${who} added ${amount}`
    : `${who} paid ${amount} to ${mask(entry.itemName ?? '')}`;
}

interface GoalActivityProps {
  entries: ActivityEntry[];
  onEdit: (entry: ActivityEntry) => void;
}

export function GoalActivity({ entries, onEdit }: GoalActivityProps) {
  const { hidden, mask } = useAmountVisibility();

  return (
    <section className="space-y-3" aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="text-base font-semibold">
        Recent activity
      </h2>
      {entries.length === 0 ? (
        <div className="rounded-xl border p-4">
          <p className="text-muted-foreground text-sm">
            No activity yet. Add to the goal or record a payment to see it here.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {entries.map((entry) => {
            const dot = entry.isSelf
              ? PERSON_COLORS.you
              : PERSON_COLORS.partner;
            const text = activityText(entry, mask);
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
                  <span className="min-w-0 break-words">{text}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                    {format(parseISO(entry.date.slice(0, 10)), 'dd MMM yyyy')}
                  </span>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="text-muted-foreground relative after:absolute after:-inset-2.5 after:content-['']"
                    disabled={hidden}
                    aria-label={`Edit ${text}`}
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
    </section>
  );
}
