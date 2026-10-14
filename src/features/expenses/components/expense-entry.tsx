'use client';

import { Button } from '@/components/ui/button';
import { StatementReview } from '@/features/import-review';
import { useAmountVisibility } from '@/features/privacy';
import { RecurringReview } from '@/features/recurring-expenses';
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
  const [entryMode, setEntryMode] = useState<'quick' | 'pdf'>('quick');
  const pendingReuse = useRef<Parameters<
    ExpenseQuickAddHandle['requestReuse']
  > | null>(null);
  useEffect(() => {
    if (entryMode !== 'quick' || !pendingReuse.current) return;
    const request = pendingReuse.current;
    pendingReuse.current = null;
    quickAdd.current?.requestReuse(...request);
  }, [entryMode]);
  const [reuseAvailable, setReuseAvailable] = useState(true);
  return (
    <>
      <div className="space-y-3">
        <div className="flex gap-1" role="group" aria-label="Add expenses">
          <Button
            variant={entryMode === 'quick' ? 'default' : 'ghost'}
            aria-pressed={entryMode === 'quick'}
            onClick={() => setEntryMode('quick')}
          >
            Quick add
          </Button>
          <Button
            variant={entryMode === 'pdf' ? 'default' : 'ghost'}
            aria-pressed={entryMode === 'pdf'}
            onClick={() => setEntryMode('pdf')}
          >
            Import statement
          </Button>
        </div>
        <div hidden={entryMode !== 'quick'}>
          <ExpenseQuickAdd
            ref={quickAdd}
            onReuseAvailabilityChange={setReuseAvailable}
            readSavedExpenses={async () => {
              if (!canReveal()) throw new Error('Review unavailable');
              const instance = lifetime.current;
              const readEpoch = getHideEpoch();
              const records = await getExpenses();
              if (
                !instance.active ||
                !canReveal() ||
                getHideEpoch() !== readEpoch
              )
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
        </div>
        <div
          hidden={entryMode !== 'pdf'}
          className="space-y-3 rounded-lg border p-4"
        >
          <p className="text-sm">
            Upload a bank PDF, check the extracted expenses, then save.
          </p>
          <StatementReview triggerLabel="Choose bank PDF" />
        </div>
      </div>
      <ExpenseTable
        onReuse={
          hidden || pendingWrites || !reuseAvailable
            ? undefined
            : (expense, origin) => {
                if (entryMode === 'quick')
                  quickAdd.current?.requestReuse(expense, origin);
                else {
                  pendingReuse.current = [expense, origin];
                  setEntryMode('quick');
                }
              }
        }
      />
      <RecurringReview />
    </>
  );
}
