'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCreateInvite } from '../hooks/use-household';

/**
 * Owner-only: mints a one-time invite secret and reveals it once. The secret is
 * shown a single time — it is never stored in plaintext — so the copy action and
 * the "share once" warning carry real weight.
 */
export function InvitePanel() {
  const createInvite = useCreateInvite();
  const [secret, setSecret] = useState<string | null>(null);

  const mint = () => {
    createInvite.mutate(undefined, {
      onSuccess: (res) => setSecret(res.secret),
      onError: () => toast.error('Could not create an invite'),
    });
  };

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      toast.success('Invite code copied');
    } catch {
      toast.error('Could not copy the invite code');
    }
  };

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <UserPlus className="text-muted-foreground size-4" />
        <span className="text-sm font-semibold">Invite your partner</span>
      </div>

      {secret ? (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Input
              readOnly
              value={secret}
              aria-label="One-time invite code"
              className="font-mono text-xs"
              onFocus={(e) => e.target.select()}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={copy}
              aria-label="Copy invite code"
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Share this code with your partner once — in person or over a trusted
            channel. It is shown only now, works a single time, and expires in
            48 hours.
          </p>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-muted-foreground mb-3 text-sm">
            Generate a one-time code your partner enters to join this household.
          </p>
          <Button size="sm" onClick={mint} disabled={createInvite.isPending}>
            Generate invite code
          </Button>
        </div>
      )}
    </div>
  );
}
