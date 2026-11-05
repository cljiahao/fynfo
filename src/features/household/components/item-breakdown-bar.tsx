'use client';

import { ProgressBar } from '@/components/widgets';
import { useAmountVisibility } from '@/features/privacy';

import { cn } from '@/lib/utils';
import { formatSGD } from '@/lib/utils/currency';
import {
  ITEM_BAR_FILLS,
  ITEM_BAR_OTHER_FILL,
  ITEM_BAR_OVER_FILL,
  NO_ITEMS_SUMMARY,
  PERSON_COLORS,
} from '../constants';
import { breakdownSegments, type BreakdownSegment } from '../lib/goal-stats';
import type { HouseholdGoal } from '../types';

interface ItemBreakdownBarProps {
  goal: Pick<HouseholdGoal, 'items' | 'targetAmount' | 'contributed'>;
  /** Legend with names and amounts under the bar; the goal card omits it. */
  labels?: boolean;
  className?: string;
}

function fillsFor(segment: BreakdownSegment, index: number) {
  return segment.names ? ITEM_BAR_OTHER_FILL : ITEM_BAR_FILLS[index];
}

export function ItemBreakdownBar({
  goal,
  labels = false,
  className,
}: ItemBreakdownBarProps) {
  const { hidden, mask } = useAmountVisibility();
  const breakdown = breakdownSegments(goal);

  if (breakdown.segments.length === 0) {
    const pct =
      goal.targetAmount > 0
        ? Math.max(
            0,
            Math.min(100, (goal.contributed / goal.targetAmount) * 100)
          )
        : 0;
    return (
      <div className={cn('space-y-1.5', className)}>
        {/* The track stays while amounts are hidden so the height is stable; the fill would reveal the masked percentage. */}
        <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
          {!hidden && (
            <ProgressBar
              segments={[{ pct, className: PERSON_COLORS.you.fill }]}
            />
          )}
        </div>
        <p className="text-muted-foreground text-xs">{NO_ITEMS_SUMMARY}</p>
      </div>
    );
  }

  const { segments, scale, overCommitted } = breakdown;
  const widthOf = (amount: number) => (scale > 0 ? (amount / scale) * 100 : 0);
  const placed = segments.reduce<
    { segment: BreakdownSegment; x: number; width: number }[]
  >((acc, segment) => {
    const x = acc.reduce((sum, item) => sum + item.width, 0);
    return [...acc, { segment, x, width: widthOf(segment.effective) }];
  }, []);

  return (
    <div className={cn('space-y-2', className)}>
      {/* The track stays while amounts are hidden so the height is stable; segment sizes would reveal the masked amounts. */}
      <div
        className={cn(
          'bg-muted h-2.5 w-full overflow-hidden rounded-full',
          !hidden && overCommitted && 'ring-destructive/60 ring-1'
        )}
      >
        {!hidden && (
          <svg aria-hidden="true" className="block h-full w-full">
            {placed.map(({ segment, x, width }, index) => {
              const fills = fillsFor(segment, index);
              const paidWidth =
                segment.effective > 0
                  ? (width * segment.paid) / segment.effective
                  : 0;
              return (
                <g key={segment.id}>
                  <title>
                    {`${segment.names ? `Other: ${segment.names.join(', ')}` : segment.name}: ${formatSGD(segment.paid)} of ${formatSGD(segment.effective)}`}
                  </title>
                  <rect
                    x={`${x}%`}
                    width={`${width}%`}
                    height="100%"
                    className={cn(
                      overCommitted ? ITEM_BAR_OVER_FILL : fills.base,
                      'stroke-background'
                    )}
                  />
                  <rect
                    x={`${x}%`}
                    width={`${paidWidth}%`}
                    height="100%"
                    className={cn(fills.paid, 'stroke-background')}
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>
      {labels && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {segments.map((segment, index) => {
            const fills = fillsFor(segment, index);
            const label = segment.names ? 'Other' : segment.name;
            return (
              <li
                key={segment.id}
                className="flex min-w-0 items-center gap-1.5"
                title={
                  segment.names ? mask(segment.names.join(', ')) : undefined
                }
              >
                <span
                  className={cn('size-2 shrink-0 rounded-full', fills.dot)}
                />
                <span className="truncate">{mask(label)}</span>
                <span className="text-muted-foreground tabular-nums">
                  {mask(formatSGD(segment.effective))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {labels && !hidden && overCommitted && (
        <p className="text-destructive text-xs">
          Saved plus what is still to pay is above the target.
        </p>
      )}
    </div>
  );
}
