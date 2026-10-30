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
import { format } from 'date-fns';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAddContribution } from '../hooks/use-household';
import type { HouseholdGoal } from '../types';

interface AddContributionDialogProps {
  goal: HouseholdGoal | null;
  onOpenChange: (open: boolean) => void;
}

export function AddContributionDialog({
  goal,
  onOpenChange,
}: AddContributionDialogProps) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const addContribution = useAddContribution();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [errors, setErrors] = useState<{ amount?: string; date?: string }>({});
  const amountRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setErrors({});
    setAmount('');
    setNote('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const submit = () => {
    if (!canReveal()) return;
    if (!goal) return;
    const value = parseFloat(amount);
    const next: { amount?: string; date?: string } = {};
    if (!value || value <= 0) next.amount = 'Enter an amount above 0';
    if (!date) next.date = 'Pick a date';
    if (next.amount || next.date) {
      setErrors(next);
      (next.amount ? amountRef : dateRef).current?.focus();
      return;
    }
    addContribution.mutate(
      { goalId: goal.id, amount: value, note: note.trim() || undefined, date },
      {
        onSuccess: () => {
          toast.success('Contribution added');
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error('Could not add the contribution'),
      }
    );
  };

  return (
    <Dialog open={goal !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to {mask(goal?.name ?? '')}</DialogTitle>
          <DialogDescription>
            Log what you put toward this goal.
          </DialogDescription>
        </DialogHeader>
        <AmountsHiddenNotice />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="contrib-amount">Amount (SGD)</Label>
            <Input
              disabled={hidden}
              id="contrib-amount"
              ref={amountRef}
              aria-invalid={errors.amount ? true : undefined}
              aria-describedby={
                errors.amount ? 'contrib-amount-error' : undefined
              }
              type="number"
              min="0"
              step="0.01"
              value={hidden ? '' : amount}
              onChange={(e) => {
                if (!canReveal()) return;
                setAmount(e.target.value);
                setErrors((prev) => ({ ...prev, amount: undefined }));
              }}
              placeholder="0.00"
              className="text-right tabular-nums"
              autoFocus
            />
            <FieldError id="contrib-amount-error">{errors.amount}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contrib-date">Date</Label>
            <Input
              disabled={hidden}
              id="contrib-date"
              ref={dateRef}
              aria-invalid={errors.date ? true : undefined}
              aria-describedby={errors.date ? 'contrib-date-error' : undefined}
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setErrors((prev) => ({ ...prev, date: undefined }));
              }}
            />
            <FieldError id="contrib-date-error">{errors.date}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contrib-note">Note (optional)</Label>
            <Input
              disabled={hidden}
              id="contrib-note"
              value={hidden ? '' : note}
              onChange={(e) => {
                if (canReveal()) setNote(e.target.value);
              }}
              placeholder="e.g. December bonus"
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={hidden || addContribution.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={addContribution.isPending}>
            Add contribution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
