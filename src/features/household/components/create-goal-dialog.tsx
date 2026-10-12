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
import { useCreateGoal } from '../hooks/use-household';

interface CreateGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGoalDialog({
  open,
  onOpenChange,
}: CreateGoalDialogProps) {
  const { hidden, canReveal } = useAmountVisibility();
  const createGoal = useCreateGoal();
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');

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
    createGoal.mutate(
      {
        name: name.trim(),
        targetAmount: amount,
        targetDate: targetDate || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Goal created');
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error('Could not create the goal'),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New goal</DialogTitle>
          <DialogDescription>
            A big-item you and your partner are saving toward.
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
            disabled={hidden || createGoal.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={createGoal.isPending}>
            Create goal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
