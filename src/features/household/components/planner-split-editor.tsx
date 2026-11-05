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

function SplitForm({ split }: { split: PlannerSplit }) {
  const save = useSetPlannerSplit();
  const partnerId = partnerIdOf(split);
  const [mine, setMine] = useState(String(split.members[split.userId] ?? 50));
  const pct = parsePct(mine);

  if (!partnerId) return null;

  const onSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (pct === null) return;
    save.mutate(
      {
        members: { [split.userId]: pct, [partnerId]: 100 - pct },
        goalOverrides: split.goalOverrides,
      },
      {
        onSuccess: () => toast.success('Split saved'),
        onError: () => toast.error('Could not save the split, try again'),
      }
    );
  };

  return (
    <form
      onSubmit={onSave}
      className="space-y-3 rounded-xl border p-4"
      aria-label="Household split"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Household split</p>
        {split.isDefault && (
          <span className="text-muted-foreground text-xs">
            Default 50/50, not set yet
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-sm">
        How household goals and budgets are shared in each planner. Your partner
        sees any change you make here.
      </p>
      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="split-mine">Your share (%)</Label>
          <Input
            id="split-mine"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={mine}
            onChange={(event) => setMine(event.target.value)}
            aria-invalid={pct === null ? true : undefined}
            className="w-24 text-right tabular-nums"
          />
        </div>
        <p className="text-muted-foreground pb-2 text-sm tabular-nums">
          Partner: {pct === null ? '-' : 100 - pct}%
        </p>
        <Button
          type="submit"
          className="ml-auto"
          disabled={pct === null || save.isPending}
        >
          Save split
        </Button>
      </div>
      {pct === null && (
        <p role="alert" className="text-destructive text-sm">
          Enter a whole number from 0 to 100
        </p>
      )}
    </form>
  );
}

/** Edits the default split between the two household members. */
export function PlannerSplitEditor() {
  const split = usePlannerSplit();
  if (!split.data) return null;
  // Remount on server change so the field follows the saved or partner-edited value.
  const key = JSON.stringify(split.data.members);
  return <SplitForm key={key} split={split.data} />;
}
