'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatSGD } from '@/lib/utils/currency';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { Check, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { GOAL_DETAIL_PATH, GOAL_STATUS_LABEL } from '../constants';
import {
  goalCommitted,
  goalStatus,
  monthlyPaceNeeded,
} from '../lib/goal-stats';
import type { HouseholdGoal } from '../types';
import { ItemBreakdownBar } from './item-breakdown-bar';

interface GoalCardProps {
  goal: HouseholdGoal;
  onContribute: (goal: HouseholdGoal) => void;
  onEdit: (goal: HouseholdGoal) => void;
  onDelete: (goal: HouseholdGoal) => void;
  /** Joint monthly figure from the household plan; absent until it is known. */
  monthly?: number | null;
  className?: string;
}

export function GoalCard({
  goal,
  onContribute,
  onEdit,
  onDelete,
  monthly = null,
  className,
}: GoalCardProps) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const [now] = useState(() => new Date());
  const status = goalStatus(goal, now);
  const funded = status === 'funded';
  const dated = monthlyPaceNeeded(goal, now);
  const pace = dated === 'past' || dated === null ? dated : monthly;

  const overCommitted =
    goal.contributed + goalCommitted(goal) > goal.targetAmount;

  // Derive-state-from-props keeps the one-shot celebration free of refs and
  // effects, so a goal that is already funded on mount never animates.
  const [prevFunded, setPrevFunded] = useState(funded);
  const [celebrate, setCelebrate] = useState(false);
  if (funded !== prevFunded) {
    setPrevFunded(funded);
    setCelebrate(funded);
  }

  const run = (action: (goal: HouseholdGoal) => void) => () => {
    if (canReveal()) action(goal);
  };

  return (
    <Card
      className={cn(
        'relative py-0',
        !hidden && funded && 'border-gain/50',
        className
      )}
    >
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-semibold">
              {/* The ::after covers the card so the whole body is one link while the menu stays a sibling. */}
              <Link
                href={GOAL_DETAIL_PATH(goal.id)}
                className="after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:underline"
              >
                {mask(goal.name)}
              </Link>
            </h2>
            {goal.targetDate && (
              <p className="text-muted-foreground text-xs">
                by{' '}
                {format(parseISO(goal.targetDate.slice(0, 10)), 'dd MMM yyyy')}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!hidden && (
              <span
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  (status === 'funded' || status === 'on-track') &&
                    'bg-gain-subtle text-gain-strong',
                  status === 'behind' && 'bg-destructive/10 text-destructive',
                  status === 'no-date' && 'bg-muted text-muted-foreground',
                  celebrate && 'animate-in zoom-in-50 fade-in duration-500'
                )}
                onAnimationEnd={() => setCelebrate(false)}
              >
                {funded && <Check className="size-3" />}
                {GOAL_STATUS_LABEL[status]}
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground relative z-10 pointer-coarse:size-11"
                  aria-label="Goal actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={run(onContribute)}>
                  <Plus className="size-4" />
                  Add to goal
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={run(onEdit)}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={run(onDelete)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ItemBreakdownBar goal={goal} />

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
          <span className="font-medium tabular-nums">
            {mask(formatSGD(goal.contributed))}{' '}
            <span className="text-muted-foreground font-normal">
              of {mask(formatSGD(goal.targetAmount))}
            </span>
          </span>
          <span className="text-muted-foreground text-xs">
            {funded
              ? 'Goal reached'
              : `${mask(formatSGD(goal.remaining))} to go`}
          </span>
        </div>

        {!hidden && overCommitted && !funded && (
          <p className="text-destructive text-xs">
            Budget lines exceed the target
          </p>
        )}
        {pace !== null && (
          <p className="text-muted-foreground text-xs">
            {pace === 'past'
              ? 'Past target date'
              : pace === 0
                ? 'Nothing to set aside monthly'
                : `${mask(formatSGD(pace))}/mo needed`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
