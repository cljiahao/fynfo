import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

const vaultStatusSchema = z.object({ initialized: z.boolean() });

export function useVaultStatus() {
  return useQuery({
    queryKey: ['vault-status'],
    retry: false,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/vault', { cache: 'no-store', signal });
      const body: unknown = await response.json();
      const parsed = vaultStatusSchema.safeParse(body);
      if (!response.ok || !parsed.success) throw new Error('Vault unavailable');
      return parsed.data;
    },
  });
}
