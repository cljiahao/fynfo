import { TRADES_KEY } from '@/features/equity';
import { getTrades } from '@/features/equity/actions/equity-actions';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { EquityBody } from './equity-body';

// Per-user, vault-cookie-dependent data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function EquityPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: TRADES_KEY,
    queryFn: () => getTrades(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <EquityBody />
    </HydrationBoundary>
  );
}
