'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/widgets';
import { formatSGD } from '@/lib/utils/currency';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { BUDGET_BAR_COLORS } from '../constants';
import {
  categoryOptions,
  monthVsBudget,
  type CategoryVsBudget,
} from '../lib/spending-stats';
import type { SharedSpendingEntry, SpendingBudget } from '../types';
import { BudgetField } from './budget-field';

/** This month's spend per category against its monthly budget. */
export function CategoryBudgetBars({
  monthEntries,
  allEntries,
  budgets,
  currentMonth,
}: {
  monthEntries: SharedSpendingEntry[];
  /** Every non-pending ongoing entry, used for options and suggestions. */
  allEntries: SharedSpendingEntry[];
  budgets: SpendingBudget[];
  currentMonth: string;
}) {
  const { hidden } = useAmountVisibility();
  const [editing, setEditing] = useState<string | null>(null);
  const rows = monthVsBudget(monthEntries, budgets);
  const options = categoryOptions(budgets, allEntries);
  const done = () => setEditing(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">This month vs budget</h3>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={hidden}
          onClick={() => setEditing('new')}
        >
          <Plus />
          Add budget
        </Button>
      </div>
      {editing === 'new' && (
        <BudgetField
          options={options}
          entries={allEntries}
          currentMonth={currentMonth}
          onDone={done}
        />
      )}
      {rows.length === 0 && editing !== 'new' && (
        <p className="text-muted-foreground text-sm">
          No categories yet. Add a budget to track one.
        </p>
      )}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.key}>
            {editing === row.key ? (
              <BudgetField
                category={row.category}
                existing={row.budget ?? undefined}
                options={options}
                entries={allEntries}
                currentMonth={currentMonth}
                onDone={done}
              />
            ) : (
              <BarRow row={row} onEdit={() => setEditing(row.key)} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarRow({
  row,
  onEdit,
}: {
  row: CategoryVsBudget;
  onEdit: () => void;
}) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  const budget = row.budget;
  const percent = Math.min(100, Math.round(row.ratio * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate">{mask(row.category)}</span>
        <span className="flex shrink-0 items-center gap-2 tabular-nums">
          <span className={row.over ? 'text-destructive font-medium' : ''}>
            {mask(formatSGD(row.spent))}
            {budget && ` of ${mask(formatSGD(budget.monthlyAmount))}`}
          </span>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="text-muted-foreground"
            disabled={hidden}
            aria-label={`${budget ? 'Edit' : 'Set'} budget for ${mask(row.category)}`}
            onClick={() => {
              if (canReveal()) onEdit();
            }}
          >
            {budget ? 'Edit' : 'Set budget'}
          </Button>
        </span>
      </div>
      {budget && (
        <>
          <div
            className="bg-muted h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-label={`${mask(row.category)} spent against budget`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={hidden ? undefined : percent}
          >
            {!hidden && (
              <ProgressBar
                segments={[
                  {
                    pct: percent,
                    className: row.over
                      ? BUDGET_BAR_COLORS.over
                      : BUDGET_BAR_COLORS.within,
                  },
                ]}
              />
            )}
          </div>
          {row.over && (
            <p className="text-destructive text-xs">
              Over budget by {mask(formatSGD(row.spent - budget.monthlyAmount))}
            </p>
          )}
        </>
      )}
    </div>
  );
}
