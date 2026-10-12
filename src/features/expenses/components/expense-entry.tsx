'use client';

import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { getExpenses } from '../actions/expense-actions';
import { EXPENSE_KEY } from '../constants';
import {
  ExpenseQuickAdd,
  type ExpenseQuickAddHandle,
} from './expense-quick-add';
import { ExpenseTable } from './expense-table';

export function ExpenseEntry() {
  const quickAdd = useRef<ExpenseQuickAddHandle>(null);
  const queryClient = useQueryClient();
  const pendingWrites = useIsMutating();
  const [reuseAvailable, setReuseAvailable] = useState(true);
  return (
    <>
      <ExpenseQuickAdd
        ref={quickAdd}
        onReuseAvailabilityChange={setReuseAvailable}
        readSavedExpenses={getExpenses}
        onSavedExpensesRead={(records) => {
          if (queryClient.isMutating() === 0)
            queryClient.setQueryData(EXPENSE_KEY, records);
        }}
      />
      <ExpenseTable
        onReuse={
          pendingWrites || !reuseAvailable
            ? undefined
            : (expense, origin) =>
                quickAdd.current?.requestReuse(expense, origin)
        }
      />
    </>
  );
}
