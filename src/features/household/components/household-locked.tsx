'use client';

import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useUnlockHousehold } from '../hooks/use-household';

export function HouseholdLocked() {
  const unlock = useUnlockHousehold();

  const doUnlock = () =>
    unlock.mutate(undefined, {
      onError: () =>
        toast.error('Unlock your personal vault first, then try again.'),
    });

  return (
    <div className="rounded-xl border py-14 text-center">
      <div className="bg-muted flex-center mx-auto size-10 rounded-full">
        <Lock className="size-5" />
      </div>
      <p className="mt-3 font-medium">Household locked</p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
        Unlock to view and edit shared goals. This uses the PIN you already
        entered for your personal vault — no extra password.
      </p>
      <Button className="mt-4" onClick={doUnlock} disabled={unlock.isPending}>
        Unlock household
      </Button>
    </div>
  );
}
