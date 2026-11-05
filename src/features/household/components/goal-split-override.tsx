'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  usePlannerSplit,
  useSetPlannerSplit,
} from '../hooks/use-planner-split';
import { parsePct, partnerIdOf } from '../split-utils';
import type { PlannerSplit } from '../types';

function OverrideForm({
  goalId,
  split,
}: {
  goalId: string;
  split: PlannerSplit;
}) {
  const save = useSetPlannerSplit();
  const partnerId = partnerIdOf(split);
  const override = split.goalOverrides[goalId];
  const [mine, setMine] = useState(
    override ? String(override[split.userId]) : ''
  );
  if (!partnerId) return null;

  const write = (next: Record<string, number> | null) =>
    save.mutate(
      { goalId, override: next },
      {
        onSuccess: () => toast.success('Goal split saved'),
        onError: () => toast.error('Could not save the split, try again'),
      }
    );

  const blank = mine.trim() === '';
  const pct = parsePct(mine);
  const invalid = !blank && pct === null;

  const onSave = () => {
    if (pct === null) return;
    write({ [split.userId]: pct, [partnerId]: 100 - pct });
  };

  const onReset = () => {
    setMine('');
    write(null);
  };

  return (
    <div className="space-y-1.5 border-t pt-4" data-testid="goal-split">
      <Label htmlFor="goal-split-mine">Your share of this goal (%)</Label>
      <div className="flex items-center gap-2">
        <Input
          id="goal-split-mine"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          value={mine}
          placeholder={String(split.members[split.userId])}
          onChange={(event) => setMine(event.target.value)}
          aria-invalid={invalid ? true : undefined}
          className="w-24 text-right tabular-nums"
        />
        <span className="text-muted-foreground text-sm tabular-nums">
          Partner: {pct === null ? '-' : 100 - pct}%
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={pct === null || save.isPending}
          onClick={onSave}
        >
          Save
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {override
          ? 'This goal uses its own split. '
          : 'Blank uses the household split. '}
        Your partner sees this change.
        {override && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 pl-1 text-xs"
            disabled={save.isPending}
            onClick={onReset}
          >
            Use household split
          </Button>
        )}
      </p>
      {invalid && (
        <p role="alert" className="text-destructive text-sm">
          Enter a whole number from 0 to 100
        </p>
      )}
    </div>
  );
}

/** Per-goal override of the household split; edit mode only, as it needs a saved goal. */
export function GoalSplitOverride({ goalId }: { goalId: string }) {
  const split = usePlannerSplit();
  if (!split.data) return null;
  const key = JSON.stringify(split.data.goalOverrides[goalId] ?? null);
  return <OverrideForm key={key} goalId={goalId} split={split.data} />;
}
