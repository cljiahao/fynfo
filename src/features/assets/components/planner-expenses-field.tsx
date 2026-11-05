'use client';

import { useAmountVisibility } from '@/features/privacy';
import { formatSGD } from '@/lib/utils/currency';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PlannerExpensesFieldProps {
  value: number;
  /** Recent average, rounded; 0 when there is no history in the window. */
  average: number;
  monthsUsed: number;
  isCustom: boolean;
  onChange: (value: number) => void;
  onReset: () => void;
}

export function expensesSourceLabel(
  monthsUsed: number,
  isCustom: boolean
): string {
  if (isCustom) return 'Custom';
  if (monthsUsed === 0) return 'No recent history; estimate';
  return monthsUsed === 1
    ? 'Avg of last full month'
    : `Avg of last ${monthsUsed} full months`;
}

/**
 * Expenses follow the recent average until the user types their own figure;
 * "Reset to average" hands control back to the data.
 */
export function PlannerExpensesField({
  value,
  average,
  monthsUsed,
  isCustom,
  onChange,
  onReset,
}: PlannerExpensesFieldProps) {
  const { hidden, mask, canReveal } = useAmountVisibility();
  return (
    <div className="space-y-1">
      <Label htmlFor="planner-expenses" className="text-xs">
        Expenses
      </Label>
      <Input
        disabled={hidden}
        id="planner-expenses"
        type="number"
        min="0"
        placeholder="0"
        className="h-8 text-sm"
        value={hidden ? '' : value || ''}
        onChange={(e) => canReveal() && onChange(Number(e.target.value) || 0)}
      />
      <div className="text-muted-foreground flex min-h-6 items-center gap-1 text-xs">
        <span>{expensesSourceLabel(monthsUsed, isCustom)}</span>
        {isCustom && average > 0 && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-6 px-1 text-xs"
            disabled={hidden}
            onClick={() => canReveal() && onReset()}
          >
            Reset to average ({mask(formatSGD(average))})
          </Button>
        )}
      </div>
    </div>
  );
}
