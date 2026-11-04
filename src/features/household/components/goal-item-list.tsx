'use client';

import { ProgressBar } from '@/components/widgets';
import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatSGD } from '@/lib/utils/currency';
import { format } from 'date-fns';
import { Trash2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  useAddItemPayment,
  useDeleteGoalItem,
  useDeleteItemPayment,
} from '../hooks/use-household';
import { useUndoableDelete } from '../hooks/use-undoable-delete';
import { invalidProps, omitError } from '../lib/form-errors';
import type { GoalItem } from '../types';

const today = () => format(new Date(), 'yyyy-MM-dd');

/** Invisible 44px touch target that leaves row height untouched. */
const TOUCH_TARGET =
  'relative after:absolute after:-inset-2.5 after:content-[""]';

type PaymentField = 'amount' | 'date';

/** Items already filtered of rows pending deletion; payments are filtered per row. */
export function GoalItemList({ items }: { items: GoalItem[] }) {
  const { pendingIds } = useUndoableDelete();
  const pendingRef = useRef(pendingIds);
  useEffect(() => {
    pendingRef.current = pendingIds;
  }, [pendingIds]);

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          isItemPending={() => pendingRef.current.has(item.id)}
        />
      ))}
    </ul>
  );
}

function ItemRow({
  item,
  isItemPending,
}: {
  item: GoalItem;
  isItemPending: () => boolean;
}) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const { pendingIds, request } = useUndoableDelete();
  const fieldId = useId();
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<Partial<Record<PaymentField, string>>>(
    {}
  );
  const addPayment = useAddItemPayment();
  const removeItem = useDeleteGoalItem();
  const removePayment = useDeleteItemPayment();
  const amountId = `${fieldId}-pay-amount`;
  const dateId = `${fieldId}-pay-date`;
  const payments = item.payments.filter(
    (payment) => !pendingIds.has(payment.id)
  );
  const pct =
    item.budget > 0 ? Math.min(100, (item.paid / item.budget) * 100) : 0;

  function clearError(field: PaymentField) {
    setErrors((current) => omitError(current, field));
  }

  function submitPayment(event: FormEvent<HTMLFormElement>) {
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
      { itemId: item.id, amount: value, date },
      {
        onSuccess: () => {
          setAmount('');
          setDate(today());
          setPaying(false);
        },
        onError: () => toast.error('Could not record the payment'),
      }
    );
  }

  return (
    <li className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-medium">{mask(item.name)}</span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="tabular-nums">
            {mask(formatSGD(item.paid))}
            <span className="text-muted-foreground">
              {' '}
              / {mask(formatSGD(item.budget))}
            </span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive h-7 px-2 pointer-coarse:size-11"
            disabled={hidden}
            aria-label={`Delete item ${mask(item.name)}`}
            onClick={() => {
              if (!canReveal()) return;
              request({
                id: item.id,
                label: `${mask(item.name)} item deleted`,
                commit: () => removeItem.mutateAsync(item.id),
                errorMessage: 'Could not delete the item',
              });
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </span>
      </div>
      {/* The track stays when amounts are hidden so the row keeps its height;
          a fill would leak the masked percentage. */}
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        {!hidden && (
          <ProgressBar
            segments={[
              { pct, className: item.over > 0 ? 'fill-loss' : 'fill-primary' },
            ]}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {!hidden && item.over > 0 ? (
          <span className="text-loss-strong">
            Over by {formatSGD(item.over)}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {mask(formatSGD(item.remaining))} left
          </span>
        )}
        {!paying && (
          <Button
            type="button"
            size="sm"
            variant="link"
            className="h-auto p-0 text-xs pointer-coarse:min-h-11"
            disabled={hidden}
            onClick={() => {
              if (canReveal()) setPaying(true);
            }}
          >
            Record payment
          </Button>
        )}
      </div>
      {paying && (
        <form
          onSubmit={submitPayment}
          noValidate
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2"
        >
          <div className="space-y-1">
            <Input
              id={amountId}
              aria-label={`Payment amount for ${mask(item.name)}`}
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
                clearError('amount');
              }}
            />
            <FieldError id={`${amountId}-error`}>{errors.amount}</FieldError>
          </div>
          <div className="space-y-1">
            <Input
              id={dateId}
              aria-label={`Payment date for ${mask(item.name)}`}
              type="date"
              disabled={hidden}
              value={date}
              {...invalidProps(dateId, errors.date)}
              onChange={(event) => {
                setDate(event.target.value);
                clearError('date');
              }}
            />
            <FieldError id={`${dateId}-error`}>{errors.date}</FieldError>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={hidden || addPayment.isPending}
          >
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPaying(false)}
          >
            Cancel
          </Button>
        </form>
      )}
      {payments.length > 0 && (
        <ul className="text-muted-foreground space-y-0.5 text-xs">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="flex items-center justify-between gap-2"
            >
              <span>
                {format(new Date(payment.date), 'dd MMM yyyy')} ·{' '}
                {payment.isSelf ? 'You' : 'Partner'}
              </span>
              <span className="flex items-center gap-1 tabular-nums">
                {mask(formatSGD(payment.amount))}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className={`hover:text-destructive ${TOUCH_TARGET}`}
                  disabled={hidden}
                  aria-label={`Delete ${mask(formatSGD(payment.amount))} payment on ${format(
                    new Date(payment.date),
                    'dd MMM yyyy'
                  )} by ${payment.isSelf ? 'You' : 'Partner'}`}
                  onClick={() => {
                    if (!canReveal()) return;
                    request({
                      id: payment.id,
                      label: 'Payment deleted',
                      // Deleting the item cascades to its payments, so a payment
                      // commit after that would only fail.
                      commit: async () => {
                        if (isItemPending()) return;
                        await removePayment.mutateAsync(payment.id);
                      },
                      errorMessage: 'Could not delete the payment',
                    });
                  }}
                >
                  <X className="size-3" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
