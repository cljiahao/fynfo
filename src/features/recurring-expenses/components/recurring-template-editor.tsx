'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EXPENSE_TYPE_LABELS } from '@/features/expenses';
import { useAmountVisibility } from '@/features/privacy';
import { useId, useState } from 'react';
import { recurringDefinitionSchema } from '../schemas';
import type { RecurringDefinition } from '../types';

export function RecurringTemplateEditor({
  initial,
  disabled,
  onSave,
  onCancel,
}: {
  initial: RecurringDefinition;
  disabled: boolean;
  onSave: (value: RecurringDefinition) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { hidden, canReveal } = useAmountVisibility();
  const id = useId();
  const [definition, setDefinition] = useState(initial);
  const [amount, setAmount] = useState((initial.cents / 100).toFixed(2));
  const [error, setError] = useState('');
  if (hidden) return null;
  function change(value: Partial<RecurringDefinition>) {
    if (canReveal() && !disabled) {
      setDefinition((current) => ({ ...current, ...value }));
      setError('');
    }
  }
  async function save() {
    if (!canReveal() || disabled) return;
    if (!/^\d+\.\d{2}$/.test(amount)) {
      setError('Enter a positive SGD amount with exactly two decimal places.');
      return;
    }
    const parsed = recurringDefinitionSchema.safeParse({
      ...definition,
      cents: Math.round(Number(amount) * 100),
    });
    if (!parsed.success) {
      setError(
        'Check the name, dates, preferred day and positive amount. End month must not precede start month.'
      );
      return;
    }
    await onSave(parsed.data);
  }
  return (
    <fieldset disabled={disabled} className="space-y-3 rounded-md border p-3">
      <legend className="px-1 text-sm">Monthly template</legend>
      <p className="text-muted-foreground text-sm">
        Expected defaults only. Nothing is recorded until you confirm a due
        occurrence.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-name`}>Template name</Label>
          <Input
            id={`${id}-name`}
            maxLength={80}
            value={definition.name}
            onChange={(e) => change({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-item`}>Default merchant</Label>
          <Input
            id={`${id}-item`}
            maxLength={256}
            value={definition.item}
            onChange={(e) => change({ item: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-amount`}>Expected SGD amount</Label>
          <Input
            id={`${id}-amount`}
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              if (canReveal() && !disabled) {
                setAmount(e.target.value);
                setError('');
              }
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-day`}>Preferred day (1–31)</Label>
          <Input
            id={`${id}-day`}
            type="number"
            min={1}
            max={31}
            step={1}
            value={definition.preferredDay}
            onChange={(e) => change({ preferredDay: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-start`}>First month</Label>
          <Input
            id={`${id}-start`}
            type="month"
            value={definition.startMonth}
            onChange={(e) => change({ startMonth: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-end`}>Last month (optional)</Label>
          <Input
            id={`${id}-end`}
            type="month"
            value={definition.endMonth ?? ''}
            onChange={(e) => change({ endMonth: e.target.value || null })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-category`}>Default category</Label>
          <select
            id={`${id}-category`}
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={definition.category}
            onChange={(e) =>
              change({
                category: e.target.value as RecurringDefinition['category'],
              })
            }
          >
            {Object.entries(EXPENSE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-notes`}>Default notes</Label>
          <Input
            id={`${id}-notes`}
            maxLength={4096}
            value={definition.info}
            onChange={(e) => change({ info: e.target.value })}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={definition.enabled}
          onChange={(e) => change({ enabled: e.target.checked })}
        />
        Enabled for monthly review
      </label>
      <p className="text-muted-foreground text-sm">
        Day 31 becomes February 28/29, then returns to 31 in March. Singapore
        dates apply. Changing a template preserves all confirmed and skipped
        months.
      </p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void save()}>
          Save monthly template
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (
              canReveal() &&
              window.confirm('Discard this unsaved template draft?')
            )
              onCancel();
          }}
        >
          Cancel template edit
        </Button>
      </div>
    </fieldset>
  );
}
