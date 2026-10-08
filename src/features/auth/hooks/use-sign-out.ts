'use client';

import { createSupabaseBrowserClient } from '@/integrations/clients/supabase';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useVaultLock } from '../components/vault-lock-context';

export function useSignOut() {
  const queryClient = useQueryClient();
  const { lock } = useVaultLock();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const pending = useRef(false);

  const signOut = async () => {
    if (pending.current) return;
    pending.current = true;
    setIsSigningOut(true);
    queryClient.clear();
    lock();
    try {
      const response = await fetch('/api/vault/lock', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('Session teardown failed');
      const { error } = await createSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
      window.location.assign(PAGE_ROUTES.LOGIN);
    } catch {
      toast.error('Could not log out. Your vault is locked; try again.');
    } finally {
      pending.current = false;
      setIsSigningOut(false);
    }
  };

  return { signOut, isSigningOut };
}
