'use client';

import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';
import { AMOUNTS_HIDDEN_MESSAGE, HIDDEN_FINANCIAL_VALUE } from '../constants';
import { useAmountVisibility } from './amount-visibility-provider';

export function FinancialValue({ children }: { children: ReactNode }) {
  const { hidden } = useAmountVisibility();
  return <>{hidden ? HIDDEN_FINANCIAL_VALUE : children}</>;
}

export function AmountsHiddenNotice() {
  const { hidden, showAmounts } = useAmountVisibility();
  if (!hidden) return null;
  return (
    <div
      className="bg-muted/50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-6 py-2 text-sm"
      role="status"
    >
      <p>{AMOUNTS_HIDDEN_MESSAGE}</p>
      <Button variant="link" size="sm" onClick={showAmounts}>
        Show amounts
      </Button>
    </div>
  );
}
