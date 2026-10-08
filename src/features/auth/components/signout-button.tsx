'use client';

import { Button } from '@/components/ui/button';
import { useSignOut } from '../hooks/use-sign-out';

export function SignOutButton() {
  const { signOut, isSigningOut } = useSignOut();

  return (
    <Button
      onClick={signOut}
      disabled={isSigningOut}
      className="bg-primary hover:bg-primary-hover h-12 w-full rounded-md font-bold text-white"
    >
      Log out
    </Button>
  );
}
