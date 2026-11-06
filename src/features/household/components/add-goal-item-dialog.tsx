'use client';

import { AmountsHiddenNotice, useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useSaveGoal } from '../hooks/use-household';
import { saveGoalItemSchema } from '../schemas';
import type { HouseholdGoal } from '../types';

interface AddGoalItemDialogProps {
  /** The unfiltered goal, so items in an undo window are saved back too. */
  goal: HouseholdGoal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ItemErrors = { name?: string; budget?: string; quote?: string };

function toAmount(value: string): number {
  return value.trim() === '' ? NaN : Number(value);
}

// Matches the editor sheet's seed so untouched items round-trip identically.
function existingItem(item: HouseholdGoal['items'][number]) {
  return {
    id: item.id,
    name: item.name,
    budget: toAmount(item.budget.toFixed(2)),
    quote: item.quote === null ? null : toAmount(item.quote.toFixed(2)),
  };
}

export function AddGoalItemDialog({
  goal,
  open,
  onOpenChange,
}: AddGoalItemDialogProps) {
  const { hidden, canReveal } = useAmountVisibility();
  const save = useSaveGoal();
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [quote, setQuote] = useState('');
  const [errors, setErrors] = useState<ItemErrors>({});

  const clear = (key: keyof ItemErrors) =>
    setErrors((prev) => ({ ...prev, [key]: undefined }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canReveal() || save.isPending) return;
    const parsed = saveGoalItemSchema.safeParse({
      name,
      budget: toAmount(budget),
      quote: quote.trim() === '' ? null : toAmount(quote),
    });
    if (!parsed.success) {
      const next: ItemErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'name') next.name ??= 'Enter a name';
        if (key === 'budget') next.budget ??= 'Enter an amount above 0';
        if (key === 'quote') next.quote ??= 'Enter an amount above 0';
      }
      setErrors(next);
      return;
    }
    setErrors({});
    save.mutate(
      {
        goalId: goal.id,
        name: goal.name,
        target: goal.targetAmount,
        ...(goal.targetDate
          ? { targetDate: goal.targetDate.slice(0, 10) }
          : {}),
        items: [...goal.items.map(existingItem), parsed.data],
      },
      {
        onSuccess: (result) => {
          if (result.ok) {
            toast.success('Item added');
            onOpenChange(false);
            return;
          }
          toast.error('Could not add the item');
        },
        onError: () => toast.error('Could not add the item'),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add budget item</DialogTitle>
          <DialogDescription>
            Add a budget line to this goal. Nothing else about the goal changes.
          </DialogDescription>
        </DialogHeader>
        <AmountsHiddenNotice />
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="goal-item-name">Item</Label>
            <Input
              id="goal-item-name"
              disabled={hidden}
              maxLength={80}
              value={hidden ? '' : name}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={
                errors.name ? 'goal-item-name-error' : undefined
              }
              onChange={(e) => {
                if (!canReveal()) return;
                setName(e.target.value);
                clear('name');
              }}
              autoFocus
            />
            <FieldError id="goal-item-name-error">{errors.name}</FieldError>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-item-budget">Estimate (SGD)</Label>
              <Input
                id="goal-item-budget"
                disabled={hidden}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="text-right tabular-nums"
                value={hidden ? '' : budget}
                aria-invalid={errors.budget ? true : undefined}
                aria-describedby={
                  errors.budget ? 'goal-item-budget-error' : undefined
                }
                onChange={(e) => {
                  if (!canReveal()) return;
                  setBudget(e.target.value);
                  clear('budget');
                }}
              />
              <FieldError id="goal-item-budget-error">
                {errors.budget}
              </FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-item-quote">Final quote (optional)</Label>
              <Input
                id="goal-item-quote"
                disabled={hidden}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="text-right tabular-nums"
                value={hidden ? '' : quote}
                aria-invalid={errors.quote ? true : undefined}
                aria-describedby={
                  errors.quote ? 'goal-item-quote-error' : undefined
                }
                onChange={(e) => {
                  if (!canReveal()) return;
                  setQuote(e.target.value);
                  clear('quote');
                }}
              />
              <FieldError id="goal-item-quote-error">{errors.quote}</FieldError>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={hidden || save.isPending}>
              Add item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
