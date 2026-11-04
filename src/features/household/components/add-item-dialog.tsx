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
import { useId, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useAddGoalItem } from '../hooks/use-household';
import { invalidProps, omitError } from '../lib/form-errors';
import type { HouseholdGoal } from '../types';

type ItemField = 'name' | 'budget';

interface AddItemDialogProps {
  goal: HouseholdGoal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddItemDialog({
  goal,
  open,
  onOpenChange,
}: AddItemDialogProps) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const addItem = useAddGoalItem();
  const fieldId = useId();
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [errors, setErrors] = useState<Partial<Record<ItemField, string>>>({});
  const nameId = `${fieldId}-item-name`;
  const budgetId = `${fieldId}-item-budget`;

  function reset() {
    setName('');
    setBudget('');
    setErrors({});
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function clearError(field: ItemField) {
    setErrors((current) => omitError(current, field));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReveal()) return;
    const value = parseFloat(budget);
    const found: Partial<Record<ItemField, string>> = {};
    if (!name.trim()) found.name = 'Enter a name';
    if (!value || value <= 0) found.budget = 'Enter an amount above 0';
    if (found.name || found.budget) {
      setErrors(found);
      document.getElementById(found.name ? nameId : budgetId)?.focus();
      return;
    }
    setErrors({});
    addItem.mutate(
      { goalId: goal.id, name: name.trim(), budget: value },
      {
        onSuccess: () => {
          toast.success('Item added');
          handleOpenChange(false);
        },
        onError: () => toast.error('Could not add the item'),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add budget item</DialogTitle>
            <DialogDescription>
              Add a line to {mask(goal.name)}.
            </DialogDescription>
          </DialogHeader>
          <AmountsHiddenNotice />

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={nameId}>Item</Label>
              <Input
                id={nameId}
                placeholder="e.g. Venue"
                maxLength={80}
                autoFocus
                disabled={hidden}
                value={hidden ? '' : name}
                {...invalidProps(nameId, errors.name)}
                onChange={(event) => {
                  if (!canReveal()) return;
                  setName(event.target.value);
                  clearError('name');
                }}
              />
              <FieldError id={`${nameId}-error`}>{errors.name}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={budgetId}>Budget</Label>
              <Input
                id={budgetId}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="text-right tabular-nums"
                disabled={hidden}
                value={hidden ? '' : budget}
                {...invalidProps(budgetId, errors.budget)}
                onChange={(event) => {
                  if (!canReveal()) return;
                  setBudget(event.target.value);
                  clearError('budget');
                }}
              />
              <FieldError id={`${budgetId}-error`}>{errors.budget}</FieldError>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={addItem.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={hidden || addItem.isPending}>
              Add item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
