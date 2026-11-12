'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAmountVisibility } from '@/features/privacy';
import { useState } from 'react';
import type { FreedomAssumptions } from '../hooks/use-freedom-inputs';
import { validateAssumptions, type AssumptionDraft } from './freedom-format';

interface FreedomAssumptionsFormProps {
  assumptions: FreedomAssumptions;
  currentYear: number;
  onSave: (next: FreedomAssumptions) => Promise<void>;
  isSaving: boolean;
}

function draftOf(assumptions: FreedomAssumptions): AssumptionDraft {
  return {
    realReturn: assumptions.realReturnPct?.toString() ?? '',
    withdrawalRate: assumptions.withdrawalRatePct?.toString() ?? '',
    targetYear: assumptions.targetYear?.toString() ?? '',
  };
}

export function FreedomAssumptionsForm({
  assumptions,
  currentYear,
  onSave,
  isSaving,
}: FreedomAssumptionsFormProps) {
  const { canReveal, hidden } = useAmountVisibility();
  const [draft, setDraft] = useState<AssumptionDraft>(() =>
    draftOf(assumptions)
  );
  const [saveError, setSaveError] = useState(false);
  const { errors } = validateAssumptions(draft, currentYear);
  const locked = hidden || !canReveal();
  const blocked = locked || Object.keys(errors).length > 0 || isSaving;

  const update = (key: keyof AssumptionDraft) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function submit() {
    const result = validateAssumptions(draft, currentYear);
    if (!result.value || locked) return;
    setSaveError(false);
    try {
      await onSave(result.value);
    } catch {
      setSaveError(true);
    }
  }

  const fields: {
    key: keyof AssumptionDraft;
    label: string;
    hint: string;
    step: string;
  }[] = [
    {
      key: 'realReturn',
      label: 'Real return (% a year, after inflation)',
      hint: '0 to 12',
      step: '0.1',
    },
    {
      key: 'withdrawalRate',
      label: 'Withdrawal rate (% a year)',
      hint: '1 to 10',
      step: '0.1',
    },
    {
      key: 'targetYear',
      label: 'Target year (optional)',
      hint: `${currentYear} to ${currentYear + 60}`,
      step: '1',
    },
  ];

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="text-muted-foreground text-xs">
        These are your own assumptions, not suggestions; the card has no
        defaults. Leave a field blank to clear it.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {fields.map((field) => {
          const error = errors[field.key];
          return (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={`freedom-${field.key}`}>{field.label}</Label>
              <Input
                id={`freedom-${field.key}`}
                inputMode="decimal"
                type="number"
                step={field.step}
                value={draft[field.key]}
                disabled={locked}
                aria-invalid={error ? true : undefined}
                aria-describedby={
                  error ? `freedom-${field.key}-error` : undefined
                }
                placeholder={field.hint}
                onChange={(event) => update(field.key)(event.target.value)}
              />
              {error && (
                <p
                  id={`freedom-${field.key}-error`}
                  className="text-destructive text-xs"
                >
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {locked && (
        <p className="text-muted-foreground text-xs">
          Reveal amounts to edit your assumptions.
        </p>
      )}
      {saveError && (
        <p role="alert" className="text-destructive text-xs">
          Couldn&apos;t save your assumptions. Try again.
        </p>
      )}
      <Button type="submit" size="sm" disabled={blocked}>
        {isSaving ? 'Saving' : 'Save assumptions'}
      </Button>
    </form>
  );
}
