'use client';

import { useAmountVisibility } from '@/features/privacy';

import { formatSGD } from '@/lib/utils/currency';
import { MEMBER_COLORS } from '../constants';
import { useHousehold } from '../hooks/use-household';
import { summarizeSpending } from '../lib/shared-spending';
import { buildMemberLabels } from '../member-labels';
import type { SharedSpendingEntry } from '../types';

/** Total, who paid, equal-share settle-up and top categories for a set of entries. */
export function SpendingSummary({
  entries,
  emptyLabel,
  showCategories = true,
}: {
  entries: SharedSpendingEntry[];
  emptyLabel: string;
  /** Off where the category bars already list every category. */
  showCategories?: boolean;
}) {
  const { mask } = useAmountVisibility();
  const { data: household } = useHousehold();
  if (entries.length === 0)
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;

  // The caller is read off the entries so labels hold before the roster loads.
  const selfId =
    household?.userId ?? entries.find((entry) => entry.isSelf)?.userId;
  const roster = [
    ...new Set([
      ...(household?.memberIds ?? []),
      ...entries.map((entry) => entry.userId),
    ]),
  ];
  const { label, colorIndex } = buildMemberLabels(roster, selfId);
  const summary = summarizeSpending(entries, roster);
  const owes = (name: string) => (name === 'You' ? 'You owe' : `${name} owes`);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums">
          {mask(formatSGD(summary.total))}
        </span>
        <span className="text-muted-foreground flex flex-wrap gap-3 text-xs">
          {summary.members.map((member) => (
            <span key={member.userId} className="flex items-center gap-1.5">
              <span
                className={`${MEMBER_COLORS[colorIndex(member.userId)].dot} size-2 rounded-full`}
                aria-hidden="true"
              />
              {label(member.userId)} {mask(formatSGD(member.paid))}
            </span>
          ))}
        </span>
      </div>
      <div className="space-y-0.5">
        {summary.settlements.length === 0 ? (
          <p className="text-sm font-medium">Nothing to settle</p>
        ) : (
          summary.settlements.map((transfer) => (
            <p
              key={`${transfer.from}-${transfer.to}`}
              className="text-sm font-medium"
            >
              {owes(label(transfer.from))}{' '}
              {transfer.to === selfId ? 'you' : label(transfer.to)}{' '}
              {mask(formatSGD(transfer.amount))}
            </p>
          ))
        )}
        <p className="text-muted-foreground text-xs">
          Everything shared is split equally between members. Whoever paid more
          than their share is owed the difference.
        </p>
      </div>
      {showCategories && (
        <ul className="space-y-1 text-sm">
          {summary.byCategory.slice(0, 5).map((row) => (
            <li key={row.category} className="flex justify-between gap-2">
              <span className="truncate">{mask(row.category)}</span>
              <span className="tabular-nums">{mask(formatSGD(row.total))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
