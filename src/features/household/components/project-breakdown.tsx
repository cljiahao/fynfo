'use client';

import { ProgressBar } from '@/components/widgets';
import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatSGD } from '@/lib/utils/currency';
import { format } from 'date-fns';
import { ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  useAddGoalItem,
  useAddItemPayment,
  useDeleteGoalItem,
  useDeleteItemPayment,
} from '../hooks/use-household';
import type { GoalItem, HouseholdGoal } from '../types';

const today = () => format(new Date(), 'yyyy-MM-dd');

export function ProjectBreakdown({ goal }: { goal: HouseholdGoal }) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const regionId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const addItem = useAddGoalItem();

  function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReveal()) return;
    const value = parseFloat(budget);
    if (!name.trim() || !value || value <= 0) {
      toast.error('A name and budget are required');
      return;
    }
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

  const summary =
    goal.items.length === 0
      ? 'Split into budget items'
      : `${goal.items.length} item${goal.items.length === 1 ? '' : 's'} · ${mask(
          formatSGD(goal.paid)
        )} paid of ${mask(formatSGD(goal.budgeted))}`;

  return (
    <div className="border-t pt-3">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between gap-2 text-left text-sm"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span className="text-foreground font-medium">Breakdown</span>{' '}
          {summary}
        </span>
        <ChevronDown
          className={cn('size-4 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div id={regionId} className="mt-3 space-y-3">
          {!hidden && goal.budgeted > goal.targetAmount && (
            <p role="status" className="text-warning text-xs">
              Items total {formatSGD(goal.budgeted)}, above the{' '}
              {formatSGD(goal.targetAmount)} target.
            </p>
          )}
          <ul className="space-y-3">
            {goal.items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
          <form
            onSubmit={submitItem}
            className="grid grid-cols-[minmax(0,1fr)_7rem_auto] gap-2"
          >
            <Input
              aria-label="New item name"
              placeholder="e.g. Venue"
              maxLength={80}
              disabled={hidden}
              value={hidden ? '' : name}
              onChange={(event) => {
                if (canReveal()) setName(event.target.value);
              }}
            />
            <Input
              aria-label="New item budget"
              type="number"
              min="0"
              step="0.01"
              placeholder="Budget"
              className="text-right tabular-nums"
              disabled={hidden}
              value={hidden ? '' : budget}
              onChange={(event) => {
                if (canReveal()) setBudget(event.target.value);
              }}
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={hidden || addItem.isPending}
            >
              <Plus className="mr-1 size-3.5" />
              Add item
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item }: { item: GoalItem }) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const addPayment = useAddItemPayment();
  const deleteItem = useDeleteGoalItem();
  const deletePayment = useDeleteItemPayment();
  const pct =
    item.budget > 0 ? Math.min(100, (item.paid / item.budget) * 100) : 0;

  function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReveal()) return;
    const value = parseFloat(amount);
    if (!value || value <= 0 || !date) {
      toast.error('An amount and date are required');
      return;
    }
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
            className="text-muted-foreground hover:text-destructive h-7 px-2"
            disabled={hidden || deleteItem.isPending}
            aria-label={`Delete item ${mask(item.name)}`}
            onClick={() => {
              if (canReveal())
                deleteItem.mutate(item.id, {
                  onError: () => toast.error('Could not delete the item'),
                });
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </span>
      </div>
      {!hidden && (
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <ProgressBar
            segments={[
              { pct, className: item.over > 0 ? 'fill-loss' : 'fill-primary' },
            ]}
          />
        </div>
      )}
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
            className="h-auto p-0 text-xs"
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
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2"
        >
          <Input
            aria-label={`Payment amount for ${mask(item.name)}`}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="text-right tabular-nums"
            autoFocus
            disabled={hidden}
            value={hidden ? '' : amount}
            onChange={(event) => {
              if (canReveal()) setAmount(event.target.value);
            }}
          />
          <Input
            aria-label={`Payment date for ${mask(item.name)}`}
            type="date"
            disabled={hidden}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
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
      {item.payments.length > 0 && (
        <ul className="text-muted-foreground space-y-0.5 text-xs">
          {item.payments.map((payment) => (
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
                <button
                  type="button"
                  className="hover:text-destructive disabled:opacity-50"
                  disabled={hidden || deletePayment.isPending}
                  aria-label={`Delete payment on ${payment.date}`}
                  onClick={() => {
                    if (canReveal())
                      deletePayment.mutate(payment.id, {
                        onError: () =>
                          toast.error('Could not delete the payment'),
                      });
                  }}
                >
                  <X className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
