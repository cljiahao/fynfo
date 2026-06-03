import { SALARY_KEY } from '@/features/salary';
import { getSalaryRecords } from '@/features/salary/actions/salary-actions';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { SalaryBody } from './salary-body';

// Per-user, vault-cookie-dependent data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function SalaryPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: SALARY_KEY,
    queryFn: () => getSalaryRecords(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SalaryBody />
    </HydrationBoundary>
  );
}
