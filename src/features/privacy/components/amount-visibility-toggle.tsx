'use client';

import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { useAmountVisibility } from './amount-visibility-provider';

export function AmountVisibilityToggle() {
  const { hidden, hideAmounts, showAmounts } = useAmountVisibility();
  const label = hidden ? 'Show amounts' : 'Hide amounts';
  const Icon = hidden ? Eye : EyeOff;
  return (
    <Button
      data-amount-visibility-toggle
      variant="ghost"
      size="sm"
      aria-label={label}
      aria-pressed={hidden}
      title={label}
      onPointerDown={(event) => {
        if (event.button === 0) event.preventDefault();
      }}
      onClick={hidden ? showAmounts : hideAmounts}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="hidden lg:inline">{label}</span>
    </Button>
  );
}
