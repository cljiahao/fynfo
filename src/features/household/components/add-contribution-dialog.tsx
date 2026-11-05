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
import { format } from 'date-fns/format';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  useAddContribution,
  useUpdateGoalContribution,
} from '../hooks/use-household';
import type { GoalContribution, HouseholdGoal } from '../types';

interface AddContributionDialogProps {
  goal: HouseholdGoal | null;
  /** When set the dialog edits this contribution; mount with a key to re-seed. */
  contribution?: GoalContribution | null;
  onOpenChange: (open: boolean) => void;
}

export function AddContributionDialog({
  goal,
  contribution,
  onOpenChange,
}: AddContributionDialogProps) {
  const isEdit = !!contribution;
  const { hidden, mask, canReveal } = useAmountVisibility();
  const addContribution = useAddContribution();
  const updateContribution = useUpdateGoalContribution();
  const pending = addContribution.isPending || updateContribution.isPending;
  const [amount, setAmount] = useState(
    contribution ? contribution.amount.toFixed(2) : ''
  );
  const [note, setNote] = useState(contribution?.note ?? '');
  const [date, setDate] = useState(
    contribution
      ? contribution.date.slice(0, 10)
      : format(new Date(), 'yyyy-MM-dd')
  );

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
    const trimmed = note.trim() || undefined;
    if (contribution) {
      updateContribution.mutate(
        { contributionId: contribution.id, amount: value, note: trimmed, date },
        {
          onSuccess: () => {
            toast.success('Contribution updated');
            onOpenChange(false);
          },
          onError: () => toast.error('Could not update the contribution'),
        }
      );
      return;
    }
    addContribution.mutate(
      { goalId: goal.id, amount: value, note: trimmed, date },
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
          <DialogTitle>
            {isEdit ? 'Edit contribution' : `Add to ${mask(goal?.name ?? '')}`}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Change the amount, date or note.'
              : 'Log what you put toward this goal.'}
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
            disabled={hidden || pending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {isEdit ? 'Save changes' : 'Add contribution'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
