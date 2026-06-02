import { PLANNER_KEY, SNAPSHOTS_KEY } from '@/features/assets';
import { getPlannerSettings } from '@/features/assets/actions/planner-actions';
import { getSnapshots } from '@/features/assets/actions/snapshot-actions';
import { EXPENSE_KEY } from '@/features/expenses';
import { getExpenses } from '@/features/expenses/actions/expense-actions';
import { SALARY_KEY } from '@/features/salary';
import { getSalaryRecords } from '@/features/salary/actions/salary-actions';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { DashboardOverview } from './dashboard-overview';

// Per-user, vault-cookie-dependent data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function DashboardOverviewPage() {
  const queryClient = new QueryClient();

  // Prefetch all four datasets server-side, in parallel, so the client renders
  // from a hydrated cache on first paint instead of firing four post-hydration
  // fetches (the post-PIN waterfall). prefetchQuery never throws — if the vault
  // is locked or auth fails here, the query is simply left uncached and the
  // client hook fetches as before.
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: SNAPSHOTS_KEY,
      queryFn: () => getSnapshots(),
    }),
    queryClient.prefetchQuery({
      queryKey: SALARY_KEY,
      queryFn: () => getSalaryRecords(),
    }),
    queryClient.prefetchQuery({
      queryKey: PLANNER_KEY,
      queryFn: () => getPlannerSettings(),
    }),
    queryClient.prefetchQuery({
      queryKey: EXPENSE_KEY,
      queryFn: () => getExpenses(),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardOverview />
    </HydrationBoundary>
  );
}
