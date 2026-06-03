import { EXPENSE_KEY, PEOPLE_KEY } from '@/features/expenses';
import {
  getDistinctPeople,
  getExpenses,
} from '@/features/expenses/actions/expense-actions';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { ExpensesBody } from './expenses-body';

// Per-user, vault-cookie-dependent data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function ExpensesPage() {
  const queryClient = new QueryClient();

  // EXPENSE_KEY gates the page; PEOPLE_KEY (cheap plaintext) warms the
  // quick-add suggestions so neither fires a post-hydration fetch.
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: EXPENSE_KEY,
      queryFn: () => getExpenses(),
    }),
    queryClient.prefetchQuery({
      queryKey: PEOPLE_KEY,
      queryFn: () => getDistinctPeople(),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ExpensesBody />
    </HydrationBoundary>
  );
}
