'use client';

import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/integrations/clients/supabase';
import { cn } from '@/lib/utils';
import type { Provider } from '@supabase/supabase-js';

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
  const supabase = createSupabaseBrowserClient();

  const handleLogin = async () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${baseUrl}${redirectTo}`,
      },
    });
  };

  return (
    <Button
      onClick={handleLogin}
      className={cn(
        'bg-primary hover:bg-primary-hover w-full rounded-md font-bold',
        className
      )}
    >
      {label}
    </Button>
  );
}
