import { SNAPSHOTS_KEY } from '@/features/assets';
import { getSnapshots } from '@/features/assets/actions/snapshot-actions';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { AssetsBody } from './assets-body';

// Per-user, vault-cookie-dependent data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function AssetsPage() {
  const queryClient = new QueryClient();

  // Prefetch server-side so the client renders from a hydrated cache on first
  // paint (no post-hydration fetch / spinner; the loading.tsx skeleton covers
  // this wait). prefetchQuery never throws — a locked vault leaves it uncached
  // and the client hook fetches as before.
  await queryClient.prefetchQuery({
    queryKey: SNAPSHOTS_KEY,
    queryFn: () => getSnapshots(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AssetsBody />
    </HydrationBoundary>
  );
}
