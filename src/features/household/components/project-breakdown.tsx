'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { summarizeBreakdown } from '../lib/goal-stats';
import type { HouseholdGoal } from '../types';
import { AddItemDialog } from './add-item-dialog';

export function ProjectBreakdown({ goal }: { goal: HouseholdGoal }) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const [open, setOpen] = useState(false);
  const summary = summarizeBreakdown(goal, mask);

  return (
    <div className="flex items-center justify-between gap-3 border-t pt-3">
      <p
        className={cn(
          'min-w-0 text-sm',
          goal.items.length === 0 ? 'text-muted-foreground' : 'font-medium'
        )}
      >
        {summary.text}
        {!hidden && summary.over && (
          <span className="text-loss-strong"> · over budget</span>
        )}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 pointer-coarse:min-h-11"
        disabled={hidden}
        onClick={() => {
          if (canReveal()) setOpen(true);
        }}
      >
        <Plus className="mr-1 size-3.5" />
        Add item
      </Button>
      <AddItemDialog goal={goal} open={open} onOpenChange={setOpen} />
    </div>
  );
}
