'use client';

import { ProgressBar } from '@/components/widgets';
import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatSGD } from '@/lib/utils/currency';
import { format } from 'date-fns';
import { ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  useAddGoalItem,
  useAddItemPayment,
  useDeleteGoalItem,
  useDeleteItemPayment,
} from '../hooks/use-household';
import { useUndoableDelete } from '../hooks/use-undoable-delete';
import type { GoalItem, HouseholdGoal } from '../types';

const today = () => format(new Date(), 'yyyy-MM-dd');

/** Invisible 44px touch target that leaves row height untouched. */
const TOUCH_TARGET =
  'relative after:absolute after:-inset-2.5 after:content-[""]';

type ItemField = 'name' | 'budget';
type PaymentField = 'amount' | 'date';

/** Returns the same object when the field has no error so React skips the re-render. */
function omitError<K extends string>(
  errors: Partial<Record<K, string>>,
  field: K
): Partial<Record<K, string>> {
  if (!errors[field]) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}

function invalidProps(id: string, message: string | undefined) {
  return message
    ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` }
    : {};
}

export function ProjectBreakdown({ goal }: { goal: HouseholdGoal }) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const { pendingIds } = useUndoableDelete();
  const regionId = useId();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [errors, setErrors] = useState<Partial<Record<ItemField, string>>>({});
  const addItem = useAddGoalItem();
  const nameId = `${fieldId}-item-name`;
  const budgetId = `${fieldId}-item-budget`;
  const items = goal.items.filter((item) => !pendingIds.has(item.id));
  // Totals follow the rows still shown so they stay consistent while a
  // deletion is in its undo window.
  const budgeted = items.reduce((sum, item) => sum + item.budget, 0);
  const paid = items.reduce(
    (sum, item) =>
      sum +
      item.paid -
      item.payments.reduce(
        (gone, payment) =>
          pendingIds.has(payment.id) ? gone + payment.amount : gone,
        0
      ),
    0
  );
  const pendingRef = useRef(pendingIds);
  useEffect(() => {
    pendingRef.current = pendingIds;
  }, [pendingIds]);

  function clearError(field: ItemField) {
    setErrors((current) => omitError(current, field));
  }

  function submitItem(event: FormEvent<HTMLFormElement>) {
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
          setName('');
          setBudget('');
        },
        onError: () => toast.error('Could not add the item'),
      }
    );
  }

  return (
    <div className="border-t pt-3">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex flex-col">
          <span className="text-foreground font-medium">
            Breakdown
            {items.length > 0 &&
              ` · ${items.length} item${items.length === 1 ? '' : 's'}`}
          </span>
          <span className="text-xs">
            {items.length === 0
              ? 'Split into budget items'
              : `${mask(formatSGD(paid))} paid of ${mask(formatSGD(budgeted))}`}
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div id={regionId} className="mt-3 space-y-3">
          {!hidden && budgeted > goal.targetAmount && (
            <p role="status" className="text-warning text-xs">
              Items total {formatSGD(budgeted)}, above the{' '}
              {formatSGD(goal.targetAmount)} target.
            </p>
          )}
          <ul className="space-y-3">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                isItemPending={() => pendingRef.current.has(item.id)}
              />
            ))}
          </ul>
          <form
            onSubmit={submitItem}
            noValidate
            className="grid grid-cols-[minmax(0,1fr)_7rem_auto] gap-2"
          >
            <div className="space-y-1">
              <Label htmlFor={nameId} className="text-xs">
                Item
              </Label>
              <Input
                id={nameId}
                placeholder="e.g. Venue"
                maxLength={80}
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
            <div className="space-y-1">
              <Label htmlFor={budgetId} className="text-xs">
                Budget
              </Label>
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
            <div className="flex items-start pt-[1.375rem]">
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={hidden || addItem.isPending}
              >
                <Plus className="mr-1 size-3.5" />
                Add item
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
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
