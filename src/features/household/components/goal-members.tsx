'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { GOAL_MEMBER_CAP, MEMBER_COLORS } from '../constants';
import {
  useHousehold,
  useJoinGoal,
  useLeaveGoal,
} from '../hooks/use-household';
import { useMemberLabels } from '../hooks/use-member-labels';
import type { HouseholdGoal } from '../types';

/** Who is on a goal, with a control for the caller to join or leave it. */
export function GoalMembers({ goal }: { goal: HouseholdGoal }) {
  const { data: household } = useHousehold();
  const { label, initials, colorIndex } = useMemberLabels();
  const join = useJoinGoal();
  const leave = useLeaveGoal();
  const selfId = household?.userId;
  const isMember = selfId !== undefined && goal.memberIds.includes(selfId);
  const pending = join.isPending || leave.isPending;
  const showJoin =
    selfId !== undefined &&
    !isMember &&
    goal.memberIds.length < GOAL_MEMBER_CAP;
  const showLeave = isMember && goal.memberIds.length > 1;

  if (goal.memberIds.length === 0 && !showJoin) return null;

  return (
    <div className="relative z-10 flex items-center justify-between gap-2">
      <ul className="flex items-center -space-x-1.5" aria-label="Goal members">
        {goal.memberIds.map((userId) => (
          <li
            key={userId}
            title={label(userId)}
            className={cn(
              'ring-background flex size-6 items-center justify-center rounded-full text-[10px] font-medium text-white ring-2',
              MEMBER_COLORS[colorIndex(userId)].dot
            )}
          >
            <span aria-hidden="true">{initials(userId)}</span>
            <span className="sr-only">{label(userId)}</span>
          </li>
        ))}
      </ul>
      {showJoin && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            join.mutate(goal.id, {
              onError: () => toast.error('Could not join the goal'),
            })
          }
        >
          Join this goal
        </Button>
      )}
      {showLeave && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          disabled={pending}
          onClick={() =>
            leave.mutate(goal.id, {
              onError: () => toast.error('Could not leave the goal'),
            })
          }
        >
          Leave goal
        </Button>
      )}
    </div>
  );
}
