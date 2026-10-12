'use client';

import { useAmountVisibility } from '@/features/privacy';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { getExpenses } from '../actions/expense-actions';
import { EXPENSE_KEY } from '../constants';
import {
  ExpenseQuickAdd,
  type ExpenseQuickAddHandle,
} from './expense-quick-add';
import { ExpenseTable } from './expense-table';

export function ExpenseEntry() {
  const { hidden, canReveal, getHideEpoch } = useAmountVisibility();
  const lifetime = useRef({ active: true });
  useEffect(() => {
    const instance = { active: true };
    lifetime.current = instance;
    return () => {
      instance.active = false;
    };
  }, []);
  const quickAdd = useRef<ExpenseQuickAddHandle>(null);
  const queryClient = useQueryClient();
  const pendingWrites = useIsMutating();
  const [reuseAvailable, setReuseAvailable] = useState(true);
  return (
    <>
      <ExpenseQuickAdd
        ref={quickAdd}
        onReuseAvailabilityChange={setReuseAvailable}
        readSavedExpenses={async () => {
          if (!canReveal()) throw new Error('Review unavailable');
          const instance = lifetime.current;
          const readEpoch = getHideEpoch();
          const records = await getExpenses();
          if (!instance.active || !canReveal() || getHideEpoch() !== readEpoch)
            throw new Error('Review unavailable');
          return records;
        }}
        onSavedExpensesRead={(records) => {
          if (
            lifetime.current.active &&
            canReveal() &&
            queryClient.isMutating() === 0
          )
            queryClient.setQueryData(EXPENSE_KEY, records);
        }}
      />
      <ExpenseTable
        onReuse={
          hidden || pendingWrites || !reuseAvailable
            ? undefined
            : (expense, origin) =>
                quickAdd.current?.requestReuse(expense, origin)
        }
      />
    </>
  );
}
