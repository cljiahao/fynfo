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
import { useId, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useAddItemPayment } from '../hooks/use-household';
import { invalidProps, omitError } from '../lib/form-errors';
import { PaidByPicker, usePayerOptions } from './paid-by-picker';

type PaymentField = 'amount' | 'date';

interface RecordPaymentDialogProps {
  open: boolean;
  itemId: string;
  itemName: string;
  /** Members of the goal the item belongs to; the roster when empty. */
  goalMemberIds?: readonly string[];
  onOpenChange: (open: boolean) => void;
}

/** Mount with a key that changes per open so the fields start empty. */
export function RecordPaymentDialog({
  open,
  itemId,
  itemName,
  goalMemberIds,
  onOpenChange,
}: RecordPaymentDialogProps) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const addPayment = useAddItemPayment();
  const payerOptions = usePayerOptions(goalMemberIds);
  const fieldId = useId();
  const amountId = `${fieldId}-amount`;
  const dateId = `${fieldId}-date`;
  const noteId = `${fieldId}-note`;
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [payer, setPayer] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<PaymentField, string>>>(
    {}
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReveal()) return;
    const value = parseFloat(amount);
    const found: Partial<Record<PaymentField, string>> = {};
    if (!value || value <= 0) found.amount = 'Enter an amount above 0';
    if (!date) found.date = 'Pick a date';
    if (found.amount || found.date) {
      setErrors(found);
      document.getElementById(found.amount ? amountId : dateId)?.focus();
      return;
    }
    setErrors({});
    addPayment.mutate(
      {
        itemId,
        amount: value,
        date,
        note: note.trim() || undefined,
        ...(payerOptions.enabled && (payer ?? payerOptions.selfId)
          ? { payerUserId: payer ?? payerOptions.selfId }
          : {}),
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: () => toast.error('Could not record the payment'),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Add a payment towards {mask(itemName)}.
            </DialogDescription>
          </DialogHeader>
          <AmountsHiddenNotice />
          <PaidByPicker
            value={payer}
            onChange={setPayer}
            options={payerOptions.options}
            selfId={payerOptions.selfId}
            disabled={hidden}
          />
          <div className="space-y-1.5">
            <Label htmlFor={amountId}>Amount (SGD)</Label>
            <Input
              id={amountId}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="text-right tabular-nums"
              autoFocus
              disabled={hidden}
              value={hidden ? '' : amount}
              {...invalidProps(amountId, errors.amount)}
              onChange={(event) => {
                if (!canReveal()) return;
                setAmount(event.target.value);
                setErrors((current) => omitError(current, 'amount'));
              }}
            />
            <FieldError id={`${amountId}-error`}>{errors.amount}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={dateId}>Date</Label>
            <Input
              id={dateId}
              type="date"
              disabled={hidden}
              value={date}
              {...invalidProps(dateId, errors.date)}
              onChange={(event) => {
                setDate(event.target.value);
                setErrors((current) => omitError(current, 'date'));
              }}
            />
            <FieldError id={`${dateId}-error`}>{errors.date}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={noteId}>Note (optional)</Label>
            <Input
              id={noteId}
              disabled={hidden}
              maxLength={200}
              value={hidden ? '' : note}
              onChange={(event) => {
                if (canReveal()) setNote(event.target.value);
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={hidden || addPayment.isPending}>
              Save payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
