'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatSGD } from '@/lib/utils/currency';
import { useId, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { BUDGET_EXISTS, BUDGET_SUGGESTION_MONTHS } from '../constants';
import {
  useDeleteCategoryBudget,
  useSetCategoryBudget,
} from '../hooks/use-spending-budgets';
import {
  resolveCategory,
  suggestedBudget,
  type CategoryOption,
} from '../lib/spending-stats';
import type { SharedSpendingEntry, SpendingBudget } from '../types';
import { CategoryPicker } from './category-picker';

/**
 * Sets or edits one category's monthly budget. The suggestion fills the
 * amount only on click; nothing is saved until the form is submitted.
 */
export function BudgetField({
  category: fixedCategory,
  existing,
  options,
  entries,
  currentMonth,
  onDone,
}: {
  /** Fixed category for a row; omit to pick one. */
  category?: string;
  existing?: SpendingBudget;
  options: CategoryOption[];
  /** All non-pending ongoing entries, any month, for the suggestion. */
  entries: SharedSpendingEntry[];
  currentMonth: string;
  onDone: () => void;
}) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const fieldId = useId();
  const setBudget = useSetCategoryBudget();
  const removeBudget = useDeleteCategoryBudget();
  const [typedCategory, setTypedCategory] = useState('');
  const [amount, setAmount] = useState(
    existing ? String(existing.monthlyAmount) : ''
  );
  const [error, setError] = useState('');
  const category = fixedCategory ?? typedCategory;
  const suggestion = category.trim()
    ? suggestedBudget(entries, category, currentMonth)
    : null;
  const amountId = `${fieldId}-amount`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReveal()) return;
    const value = parseFloat(amount);
    if (!category.trim()) return setError('Enter a category');
    if (!value || value <= 0) return setError('Enter an amount above 0');
    setError('');
    setBudget.mutate(
      {
        id: existing?.id,
        category: resolveCategory(options, category),
        monthlyAmount: value,
      },
      {
        onSuccess: onDone,
        onError: (err) =>
          setError(
            err.message === BUDGET_EXISTS
              ? 'That category already has a budget'
              : 'Could not save the budget'
          ),
      }
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-2 py-2">
      <div className="flex flex-wrap items-end gap-2">
        {fixedCategory === undefined && (
          <div className="min-w-40 flex-1 space-y-1">
            <Label htmlFor={`${fieldId}-category`} className="text-xs">
              Budget category
            </Label>
            <CategoryPicker
              id={`${fieldId}-category`}
              options={options}
              disabled={hidden}
              value={hidden ? '' : typedCategory}
              onValueChange={(value) => {
                if (canReveal()) setTypedCategory(value);
              }}
            />
          </div>
        )}
        <div className="w-36 space-y-1">
          <Label htmlFor={amountId} className="text-xs">
            Monthly budget (SGD)
          </Label>
          <Input
            id={amountId}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="text-right tabular-nums"
            disabled={hidden}
            value={hidden ? '' : amount}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${amountId}-error` : undefined}
            onChange={(event) => {
              if (canReveal()) setAmount(event.target.value);
            }}
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={hidden || setBudget.isPending}
        >
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        {existing && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            disabled={hidden || removeBudget.isPending}
            onClick={() => {
              if (!canReveal()) return;
              removeBudget.mutate(existing.id, {
                onSuccess: onDone,
                onError: () => toast.error('Could not remove the budget'),
              });
            }}
          >
            Remove
          </Button>
        )}
      </div>
      {suggestion !== null && (
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          Average of the last {BUDGET_SUGGESTION_MONTHS} months:{' '}
          {mask(formatSGD(suggestion))}
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={hidden}
            onClick={() => {
              if (canReveal()) setAmount(String(suggestion));
            }}
          >
            Use {mask(formatSGD(suggestion))}
          </Button>
        </p>
      )}
      <FieldError id={`${amountId}-error`}>{error}</FieldError>
    </form>
  );
}
