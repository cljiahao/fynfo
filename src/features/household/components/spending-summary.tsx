'use client';

import { useAmountVisibility } from '@/features/privacy';

import { formatSGD } from '@/lib/utils/currency';
import { summarizeSpending } from '../lib/shared-spending';
import type { SharedSpendingEntry } from '../types';

/** Total, who paid, even-split settle-up and top categories for a set of entries. */
export function SpendingSummary({
  entries,
  emptyLabel,
}: {
  entries: SharedSpendingEntry[];
  emptyLabel: string;
}) {
  const { mask } = useAmountVisibility();
  if (entries.length === 0)
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;

  const summary = summarizeSpending(entries);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums">
          {mask(formatSGD(summary.total))}
        </span>
        <span className="text-muted-foreground flex gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="bg-primary size-2 rounded-full" />
            You {mask(formatSGD(summary.youPaid))}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-gain size-2 rounded-full" />
            Partner {mask(formatSGD(summary.partnerPaid))}
          </span>
        </span>
      </div>
      <p className="text-sm">
        {summary.settle === null
          ? 'Split evenly — nothing to settle.'
          : summary.settle.owedBy === 'partner'
            ? `Partner owes you ${mask(formatSGD(summary.settle.amount))} to split evenly.`
            : `You owe partner ${mask(formatSGD(summary.settle.amount))} to split evenly.`}
      </p>
      <ul className="space-y-1 text-sm">
        {summary.byCategory.slice(0, 5).map((row) => (
          <li key={row.category} className="flex justify-between gap-2">
            <span className="truncate">{mask(row.category)}</span>
            <span className="tabular-nums">{mask(formatSGD(row.total))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
