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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCreateGoal, useUpdateGoal } from '../hooks/use-household';
import type { HouseholdGoal } from '../types';

interface CreateGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this goal; mount with key={goal.id} to re-seed. */
  goal?: HouseholdGoal | null;
}

export function CreateGoalDialog({
  open,
  onOpenChange,
  goal,
}: CreateGoalDialogProps) {
  const { hidden, canReveal } = useAmountVisibility();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const [name, setName] = useState(goal?.name ?? '');
  const [targetAmount, setTargetAmount] = useState(
    goal ? String(goal.targetAmount) : ''
  );
  const [targetDate, setTargetDate] = useState(
    goal?.targetDate?.slice(0, 10) ?? ''
  );
  const isEdit = Boolean(goal);
  const pending = createGoal.isPending || updateGoal.isPending;

  const reset = () => {
    setName('');
    setTargetAmount('');
    setTargetDate('');
  };

  const submit = () => {
    if (!canReveal()) return;
    const amount = parseFloat(targetAmount);
    if (!name.trim() || !amount || amount <= 0) {
      toast.error('Name and a target amount are required');
      return;
    }
    const values = {
      name: name.trim(),
      targetAmount: amount,
      targetDate: targetDate || undefined,
    };
    if (goal) {
      updateGoal.mutate(
        { ...values, goalId: goal.id },
        {
          onSuccess: () => {
            toast.success('Goal updated');
            onOpenChange(false);
          },
          onError: () => toast.error('Could not update the goal'),
        }
      );
      return;
    }
    createGoal.mutate(values, {
      onSuccess: () => {
        toast.success('Goal created');
        reset();
        onOpenChange(false);
      },
      onError: () => toast.error('Could not create the goal'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit goal' : 'New goal'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Change the name, target amount or date.'
              : 'A big-item you and your partner are saving toward.'}
          </DialogDescription>
        </DialogHeader>
        <AmountsHiddenNotice />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">Name</Label>
            <Input
              disabled={hidden}
              id="goal-name"
              value={hidden ? '' : name}
              onChange={(e) => {
                if (canReveal()) setName(e.target.value);
              }}
              placeholder="e.g. New sofa"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-target">Target amount (SGD)</Label>
            <Input
              disabled={hidden}
              id="goal-target"
              type="number"
              min="0"
              step="0.01"
              value={hidden ? '' : targetAmount}
              onChange={(e) => {
                if (canReveal()) setTargetAmount(e.target.value);
              }}
              placeholder="0.00"
              className="text-right tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-date">Target date (optional)</Label>
            <Input
              disabled={hidden}
              id="goal-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
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
            {isEdit ? 'Save changes' : 'Create goal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
