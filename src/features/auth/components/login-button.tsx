'use client';

import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/integrations/clients/supabase';
import { cn } from '@/lib/utils';
import type { Provider } from '@supabase/supabase-js';
import { useRef, useState } from 'react';
import { OAUTH_LOGIN_ERROR } from '../constants';

interface LoginButtonProps {
  className?: string;
  label?: string;
  provider: Provider;
  redirectTo: string;
}

export function LoginButton({
  className = '',
  label = 'Log in',
  provider,
  redirectTo,
}: LoginButtonProps) {
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setAuthError(null);
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    let redirecting = false;
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${baseUrl}${redirectTo}` },
      });
      if (error) setAuthError(OAUTH_LOGIN_ERROR);
      else redirecting = true;
    } catch {
      setAuthError(OAUTH_LOGIN_ERROR);
    } finally {
      if (!redirecting) {
        pendingRef.current = false;
        setPending(false);
      }
    }
  };

  return (
    <>
      <Button
        onClick={handleLogin}
        disabled={pending}
        aria-busy={pending}
        className={cn(
          'bg-primary hover:bg-primary-hover w-full rounded-md font-bold',
          className
        )}
      >
        {label}
      </Button>
      {authError && (
        <p role="alert" className="text-destructive text-sm">
          {authError}
        </p>
      )}
    </>
  );
}
