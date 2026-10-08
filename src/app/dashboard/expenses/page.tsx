'use client';

import { DashboardError } from '@/components/layout/dashboard-error';
import { PageHeader } from '@/components/widgets';
import {
  ExpenseChart,
  ExpenseQuickAdd,
  ExpenseTable,
  OwedSummary,
  useExpenses,
} from '@/features/expenses';
import { ExpensesSkeleton } from './expenses-skeleton';

export default function ExpensesPage() {
  const { data: expenses, isLoading, isError, refetch } = useExpenses();

  if (isLoading) return <ExpensesSkeleton />;
  if (isError) return <DashboardError reset={() => void refetch()} />;

  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <PageHeader
        title="Expenses"
        description="Track your expenses and split shared costs"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ExpenseChart expenses={expenses ?? []} />
        <OwedSummary expenses={expenses ?? []} />
      </div>

      <ExpenseQuickAdd />
      <ExpenseTable />
    </div>
  );
}
