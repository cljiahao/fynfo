'use client';

import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/integrations/clients/supabase';
import { PAGE_ROUTES } from '@/lib/constants/routes';

export function SignOutButton() {
  const supabase = createSupabaseBrowserClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = PAGE_ROUTES.HOME;
  };

  return (
    <Button
      onClick={handleSignOut}
      className="bg-primary hover:bg-primary-hover h-12 w-full rounded-md font-bold text-white"
    >
      Log out
    </Button>
  );
}
