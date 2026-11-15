import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { GOAL_STATUS_LABEL } from '../constants';
import type { GoalStatus } from '../lib/goal-stats';

export function GoalStatusChip({ status }: { status: GoalStatus }) {
  return (
    <span
      className={cn(
        'flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        (status === 'funded' || status === 'on-track') &&
          'bg-gain-subtle text-gain-strong',
        status === 'behind' && 'bg-destructive/10 text-destructive',
        status === 'no-date' && 'bg-muted text-muted-foreground'
      )}
    >
      {status === 'funded' && <Check className="size-3" />}
      {GOAL_STATUS_LABEL[status]}
    </span>
  );
}
