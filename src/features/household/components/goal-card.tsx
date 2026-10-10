'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatSGD } from '@/lib/utils/currency';
import { format } from 'date-fns';
import { Check, Plus, Trash2 } from 'lucide-react';
import type { HouseholdGoal } from '../types';

interface GoalCardProps {
  goal: HouseholdGoal;
  onContribute: (goal: HouseholdGoal) => void;
  onDelete: (goal: HouseholdGoal) => void;
}

export function GoalCard({ goal, onContribute, onDelete }: GoalCardProps) {
  const self = goal.contributions
    .filter((c) => c.isSelf)
    .reduce((sum, c) => sum + c.amount, 0);
  const partner = goal.contributed - self;

  const pctOf = (n: number) =>
    goal.targetAmount > 0
      ? Math.max(0, Math.min(100, (n / goal.targetAmount) * 100))
      : 0;
  const selfPct = pctOf(self);
  const partnerPct = Math.min(100 - selfPct, pctOf(partner));
  const funded =
    Number.isFinite(goal.targetAmount) &&
    goal.targetAmount > 0 &&
    Number.isFinite(goal.contributed) &&
    goal.contributed >= goal.targetAmount;

  return (
    <Card className={cn(funded && 'border-gain/50')}>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{goal.name}</h3>
            {goal.targetDate && (
              <p className="text-muted-foreground text-xs">
                by {format(new Date(goal.targetDate), 'dd MMM yyyy')}
              </p>
            )}
          </div>
          {funded ? (
            <span className="bg-gain-subtle text-gain-strong flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
              <Check className="size-3" />
              Funded
            </span>
          ) : (
            <span className="text-muted-foreground shrink-0 text-sm font-medium tabular-nums">
              {goal.pct}%
            </span>
          )}
        </div>

        {/* Two-tone joint progress: primary = you, gain = partner */}
        <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
          <div className="flex h-full">
            <div
              className="bg-primary h-full"
              style={{ width: `${selfPct}%` }}
            />
            <div
              className="bg-gain h-full"
              style={{ width: `${partnerPct}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
          <span className="font-medium tabular-nums">
            {formatSGD(goal.contributed)}{' '}
            <span className="text-muted-foreground font-normal">
              of {formatSGD(goal.targetAmount)}
            </span>
          </span>
          <span className="text-muted-foreground text-xs">
            {funded ? 'Goal reached' : `${formatSGD(goal.remaining)} to go`}
          </span>
        </div>

        <div className="text-muted-foreground flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="bg-primary size-2 rounded-full" />
            You {formatSGD(self)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-gain size-2 rounded-full" />
            Partner {formatSGD(partner)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button size="sm" onClick={() => onContribute(goal)}>
            <Plus className="mr-1 size-3.5" />
            Add to goal
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(goal)}
            aria-label={`Delete goal ${goal.name}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
