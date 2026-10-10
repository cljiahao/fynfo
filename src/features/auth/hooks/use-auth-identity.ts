'use client';

import { createSupabaseBrowserClient } from '@/integrations/clients/supabase';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useVaultLock } from '../components/vault-lock-context';
import { AUTH_IDENTITY_TEARDOWN_TIMEOUT_MS } from '../constants';

export function useAuthIdentity(userId: string): void {
  const [initialUserId] = useState(userId);
  const queryClient = useQueryClient();
  const { invalidate } = useVaultLock();
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    const invalidateIdentity = (navigate = true) => {
      if (!active || pending.current) return;
      pending.current = true;
      invalidate();
      queryClient.clear();
      // No auth API calls in this callback: Supabase dispatch holds its lock.
      void (async () => {
        try {
          await fetch('/api/vault/lock', {
            method: 'POST',
            signal: AbortSignal.timeout(AUTH_IDENTITY_TEARDOWN_TIMEOUT_MS),
          });
        } catch {
          // Financial children remain blocked even when cookie teardown fails.
        } finally {
          if (active && navigate) window.location.assign(PAGE_ROUTES.LOGIN);
        }
      })();
    };

    if (userId !== initialUserId) invalidateIdentity();
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = createSupabaseBrowserClient().auth.onAuthStateChange(
        (event, session) => {
          if (event === 'INITIAL_SESSION' && !session) {
            invalidateIdentity(false);
          } else if (
            event === 'SIGNED_OUT' ||
            (session?.user.id && session.user.id !== initialUserId)
          ) {
            invalidateIdentity();
          }
        }
      );
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      invalidateIdentity(false);
    }
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [initialUserId, userId, invalidate, queryClient]);
}
