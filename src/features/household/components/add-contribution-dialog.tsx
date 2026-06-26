'use client';

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
import { format } from 'date-fns';
import { useState } from 'react';
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
  const addContribution = useAddContribution();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const reset = () => {
    setAmount('');
    setNote('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const submit = () => {
    if (!goal) return;
    const value = parseFloat(amount);
    if (!value || value <= 0 || !date) {
      toast.error('An amount and date are required');
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
          <DialogTitle>Add to {goal?.name}</DialogTitle>
          <DialogDescription>
            Log what you put toward this goal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="contrib-amount">Amount (SGD)</Label>
            <Input
              id="contrib-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-right tabular-nums"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contrib-date">Date</Label>
            <Input
              id="contrib-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contrib-note">Note (optional)</Label>
            <Input
              id="contrib-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. December bonus"
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={addContribution.isPending}
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
