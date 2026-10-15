'use client';

import { Button } from '@/components/ui/button';
import { useSignOut } from '../hooks/use-sign-out';

export function SignOutButton() {
  const { signOut, isSigningOut } = useSignOut();

  return (
    <Button
      onClick={signOut}
      disabled={isSigningOut}
      variant="ghost"
      className="h-10 w-full"
    >
      Log out
    </Button>
  );
}
