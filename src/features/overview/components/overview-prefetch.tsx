import {
  getPlannerSettings,
  getSnapshots,
  PLANNER_KEY,
  SNAPSHOTS_KEY,
} from '@/features/assets';
import { EXPENSE_KEY, getExpenses } from '@/features/expenses';
import { getSalaryRecords, SALARY_KEY } from '@/features/salary';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import type { ReactNode } from 'react';

export async function OverviewPrefetch({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();

  // Failed auth/vault reads stay unhydrated so client observers can recover.
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: SNAPSHOTS_KEY,
      queryFn: getSnapshots,
    }),
    queryClient.prefetchQuery({
      queryKey: SALARY_KEY,
      queryFn: getSalaryRecords,
    }),
    queryClient.prefetchQuery({
      queryKey: PLANNER_KEY,
      queryFn: getPlannerSettings,
    }),
    queryClient.prefetchQuery({ queryKey: EXPENSE_KEY, queryFn: getExpenses }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
