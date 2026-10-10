import type { QueryClient, QueryKey } from '@tanstack/react-query';

/** Discard pre-write replies before refetching this query family. */
export async function refreshQueriesAfterMutation(
  queryClient: QueryClient,
  queryKey: QueryKey
): Promise<void> {
  await queryClient.cancelQueries({ queryKey });
  await queryClient.invalidateQueries({ queryKey });
}
