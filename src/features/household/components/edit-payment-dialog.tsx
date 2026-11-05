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
import { useState } from 'react';
import { toast } from 'sonner';
import { useUpdateGoalPayment } from '../hooks/use-household';
import type { GoalItemPayment } from '../types';

interface EditPaymentDialogProps {
  /** The payment being edited; the dialog is closed when null. */
  payment: GoalItemPayment | null;
  itemName: string;
  onOpenChange: (open: boolean) => void;
}

/** Mount with key={payment.id} so the fields re-seed for each payment. */
export function EditPaymentDialog({
  payment,
  itemName,
  onOpenChange,
}: EditPaymentDialogProps) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const update = useUpdateGoalPayment();
  const [amount, setAmount] = useState(payment?.amount.toFixed(2) ?? '');
  const [note, setNote] = useState(payment?.note ?? '');
  const [date, setDate] = useState(payment?.date.slice(0, 10) ?? '');
  const [errors, setErrors] = useState<{ amount?: string; date?: string }>({});

  const submit = () => {
    if (!canReveal() || !payment) return;
    const value = parseFloat(amount);
    const next: { amount?: string; date?: string } = {};
    if (!value || value <= 0) next.amount = 'Enter an amount above 0';
    if (!date) next.date = 'Pick a date';
    if (next.amount || next.date) {
      setErrors(next);
      return;
    }
    update.mutate(
      {
        paymentId: payment.id,
        amount: value,
        note: note.trim() || undefined,
        date,
      },
      {
        onSuccess: () => {
          toast.success('Payment updated');
          onOpenChange(false);
        },
        onError: () => toast.error('Could not update the payment'),
      }
    );
  };

  return (
    <Dialog open={payment !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit payment</DialogTitle>
          <DialogDescription>
            Change the amount, date or note for {mask(itemName)}.
          </DialogDescription>
        </DialogHeader>
        <AmountsHiddenNotice />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="payment-amount">Amount (SGD)</Label>
            <Input
              id="payment-amount"
              disabled={hidden}
              type="number"
              min="0"
              step="0.01"
              value={hidden ? '' : amount}
              aria-invalid={errors.amount ? true : undefined}
              aria-describedby={
                errors.amount ? 'payment-amount-error' : undefined
              }
              onChange={(e) => {
                if (!canReveal()) return;
                setAmount(e.target.value);
                setErrors((prev) => ({ ...prev, amount: undefined }));
              }}
              className="text-right tabular-nums"
            />
            <FieldError id="payment-amount-error">{errors.amount}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment-date">Date</Label>
            <Input
              id="payment-date"
              disabled={hidden}
              type="date"
              value={date}
              aria-invalid={errors.date ? true : undefined}
              aria-describedby={errors.date ? 'payment-date-error' : undefined}
              onChange={(e) => {
                setDate(e.target.value);
                setErrors((prev) => ({ ...prev, date: undefined }));
              }}
            />
            <FieldError id="payment-date-error">{errors.date}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment-note">Note (optional)</Label>
            <Input
              id="payment-note"
              disabled={hidden}
              value={hidden ? '' : note}
              maxLength={200}
              onChange={(e) => {
                if (canReveal()) setNote(e.target.value);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={hidden || update.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={update.isPending}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
