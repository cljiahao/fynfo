'use client';

import { useAmountVisibility } from '@/features/privacy';
import { formatSGD } from '@/lib/utils/currency';
import { useState, type ReactNode } from 'react';
import { PlannerDonut } from './planner-donut';

export interface FlowSegment {
  key: string;
  label: string;
  /** Legend text when it should differ from the donut label. */
  rowLabel?: string;
  amount: number;
  /** Share of net take-home, as a fraction. */
  pct: number;
  color: string;
  /** Extra rows revealed when the legend line is expanded. */
  details?: ReactNode;
}

interface PlannerFlowProps {
  net: number;
  segments: FlowSegment[];
  stateLine: string;
}

/**
 * Take-home split: a donut of expenses, insurance, giving, household, savings
 * and investment, with the amounts in a legend below.
 */
export function PlannerFlow({ net, segments, stateLine }: PlannerFlowProps) {
  const { mask } = useAmountVisibility();
  const visible = segments.filter((segment) => segment.amount > 0);
  const total = visible.reduce((sum, segment) => sum + segment.amount, 0);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-xs">Net (after CPF)</span>
        <span className="text-sm font-semibold tabular-nums">
          {mask(formatSGD(net))}
        </span>
      </div>
      <PlannerDonut
        slices={visible}
        total={total}
        ariaLabel={`How your monthly take-home is allocated: ${visible
          .map(
            (segment) => `${segment.label} ${(segment.pct * 100).toFixed(1)}%`
          )
          .join(', ')}`}
      />
      <p className="text-sm font-medium" data-testid="planner-state-line">
        {stateLine}
      </p>
      <ul className="divide-border divide-y text-sm">
        {segments.map((segment) => {
          const expandable = segment.details !== undefined;
          const expanded = open === segment.key;
          const row = (
            <>
              <svg aria-hidden className="size-2.5 shrink-0">
                <circle cx="50%" cy="50%" r="50%" fill={segment.color} />
              </svg>
              <span className="min-w-0 flex-1 truncate text-left">
                {segment.rowLabel ?? segment.label}
              </span>
              <span className="text-muted-foreground w-12 shrink-0 text-right text-xs tabular-nums">
                {(segment.pct * 100).toFixed(1)}%
              </span>
              <span className="w-24 shrink-0 text-right tabular-nums">
                {mask(formatSGD(segment.amount))}
              </span>
            </>
          );
          return (
            <li key={segment.key}>
              {expandable ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : segment.key)}
                  className="hover:bg-muted/50 flex w-full items-center gap-2 py-2"
                >
                  {row}
                </button>
              ) : (
                <div className="flex items-center gap-2 py-2">{row}</div>
              )}
              {expandable && expanded && (
                <div className="bg-muted/40 mb-2 rounded-md p-3 text-xs">
                  {segment.details}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
