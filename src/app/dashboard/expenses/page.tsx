'use client';

import {
  ExpenseChart,
  ExpenseQuickAdd,
  ExpenseTable,
  OwedSummary,
  useExpenses,
} from '@/features/expenses';
import { ExpensesSkeleton } from './expenses-skeleton';

export default function ExpensesPage() {
  const { data: expenses, isLoading } = useExpenses();

  if (isLoading) return <ExpensesSkeleton />;

  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
        <p className="text-muted-foreground mt-1">
          Track your expenses and split shared costs
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ExpenseChart expenses={expenses ?? []} />
        <OwedSummary expenses={expenses ?? []} />
      </div>

      <ExpenseQuickAdd />
      <ExpenseTable />
    </div>
  );
}
