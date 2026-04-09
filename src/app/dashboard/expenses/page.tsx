'use client';

import { Button } from '@/components/ui/button';
import {
  ExpenseChart,
  ExpenseQuickAdd,
  ExpenseTable,
  OwedSummary,
  StatementDialog,
  useExpenses,
} from '@/features/expenses';
import { FileUp, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function ExpensesPage() {
  const { data: expenses, isLoading } = useExpenses();
  const [statementOpen, setStatementOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex-center min-h-[60vh]">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <div className="flex-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground mt-1">
            Track your expenses and split shared costs
          </p>
        </div>
        <Button variant="outline" onClick={() => setStatementOpen(true)}>
          <FileUp className="mr-2 size-4" />
          Import Statement
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ExpenseChart expenses={expenses ?? []} />
        <OwedSummary expenses={expenses ?? []} />
      </div>

      <ExpenseQuickAdd />
      <ExpenseTable />

      <StatementDialog open={statementOpen} onOpenChange={setStatementOpen} />
    </div>
  );
}
