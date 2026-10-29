'use client';

import { Button } from '@/components/ui/button';
import { PageViews } from '@/components/widgets';
import { StatementReview } from '@/features/import-review';
import { MerchantRulesButton } from '@/features/merchant-rules';
import { useAmountVisibility } from '@/features/privacy';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { getExpenses } from '../actions/expense-actions';
import { EXPENSE_KEY } from '../constants';
import {
  ExpenseQuickAdd,
  type ExpenseQuickAddHandle,
} from './expense-quick-add';
import { ExpenseTable } from './expense-table';

export function ExpenseEntry({
  overview,
  recurring,
}: { overview?: ReactNode; recurring?: ReactNode } = {}) {
  const [view, setView] = useState('spending');
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (view === 'transactions' && returnFocus.current) {
      returnFocus.current.focus();
      returnFocus.current = null;
    }
  }, [view]);
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
    if (
      entryMode !== 'quick' ||
      (overview !== undefined && view !== 'spending') ||
      !pendingReuse.current
    )
      return;
    const request = pendingReuse.current;
    pendingReuse.current = null;
    quickAdd.current?.requestReuse(...request);
  }, [entryMode, view, overview]);
  const [reuseAvailable, setReuseAvailable] = useState(true);
  const entry = (
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
          onReturnToSource={
            overview === undefined
              ? undefined
              : (origin) => {
                  returnFocus.current = origin;
                  setView('transactions');
                }
          }
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
        <div className="flex flex-wrap gap-2">
          <StatementReview triggerLabel="Choose bank PDF" />
          <MerchantRulesButton />
        </div>
      </div>
    </div>
  );
  const transactions = (
    <ExpenseTable
      onReuse={
        hidden || pendingWrites || !reuseAvailable
          ? undefined
          : (expense, origin) => {
              if (
                entryMode === 'quick' &&
                (overview === undefined || view === 'spending')
              )
                quickAdd.current?.requestReuse(expense, origin);
              else {
                pendingReuse.current = [expense, origin];
                setView('spending');
                setEntryMode('quick');
              }
            }
      }
    />
  );
  if (overview === undefined)
    return (
      <>
        {entry}
        {transactions}
      </>
    );
  return (
    <PageViews
      label="Expense views"
      value={view}
      onValueChange={setView}
      views={[
        {
          id: 'spending',
          label: 'Spending',
          content: (
            <>
              {overview}
              {entry}
            </>
          ),
        },
        { id: 'transactions', label: 'Transactions', content: transactions },
        ...(recurring === undefined
          ? []
          : [{ id: 'recurring', label: 'Recurring', content: recurring }]),
      ]}
    />
  );
}
