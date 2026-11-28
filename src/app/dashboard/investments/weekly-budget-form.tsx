'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  usePublishSummaryOnUnlock,
  useSetWeeklyBudget,
  useWeeklyBudget,
} from '@/features/investment-api';
import { useState } from 'react';

/** Also mounts the once-per-session publish, so opening this page refreshes callers' summary. */
export function WeeklyBudgetForm() {
  usePublishSummaryOnUnlock();
  const budget = useWeeklyBudget();
  const save = useSetWeeklyBudget();
  const [draft, setDraft] = useState<string | null>(null);

  const stored = budget.data === null ? '' : String(budget.data ?? '');
  const value = draft ?? stored;
  const amount = value.trim() === '' ? NaN : Number(value);
  const valid = Number.isFinite(amount) && amount >= 0;

  return (
    <form
      className="flex max-w-sm items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) save.mutate(amount, { onSuccess: () => setDraft(null) });
      }}
    >
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="weekly-budget">Weekly budget (SGD)</Label>
        <Input
          id="weekly-budget"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={value}
          disabled={budget.isPending}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={!valid || save.isPending}>
        Save
      </Button>
      {save.isError ? (
        <p role="alert" className="text-destructive text-sm">
          Could not save. Unlock your vault and retry.
        </p>
      ) : null}
    </form>
  );
}
