'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useHousehold } from '../hooks/use-household';
import type { PaidBy } from '../schemas';

/** The picker only makes sense with a partner to attribute to. */
export function usePaidByEnabled(): boolean {
  const household = useHousehold();
  return household.data?.memberCount === 2;
}

interface PaidByPickerProps {
  value: PaidBy;
  onChange: (value: PaidBy) => void;
  disabled?: boolean;
}

const OPTIONS: { value: PaidBy; label: string }[] = [
  { value: 'self', label: 'You' },
  { value: 'partner', label: 'Partner' },
];

export function PaidByPicker({ value, onChange, disabled }: PaidByPickerProps) {
  const enabled = usePaidByEnabled();
  if (!enabled) return null;
  return (
    <div className="space-y-1.5">
      <Label id="paid-by-label">Paid by</Label>
      <div role="group" aria-labelledby="paid-by-label" className="flex gap-2">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? 'default' : 'outline'}
            aria-pressed={value === option.value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
