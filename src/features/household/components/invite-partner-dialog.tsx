'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Copy, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCreateInvite } from '../hooks/use-household';

/**
 * Owner-only: mints a one-time invite secret and reveals it once. The secret is
 * shown a single time and never stored in plaintext, so it is dropped when the
 * dialog closes; reopening must not display an already-shared code.
 */
export function InvitePartnerDialog() {
  const createInvite = useCreateInvite();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSecret(null);
      createInvite.reset();
    }
  };

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="mr-1.5 size-4" />
          Invite partner
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite your partner</DialogTitle>
          <DialogDescription>
            Generate a one-time code your partner enters to join this household.
          </DialogDescription>
        </DialogHeader>

        {secret ? (
          <div className="space-y-2">
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
              Share this code with your partner once — in person or over a
              trusted channel. It is shown only now, works a single time, and
              expires in 48 hours.
            </p>
          </div>
        ) : (
          <Button
            className="w-fit"
            onClick={mint}
            disabled={createInvite.isPending}
          >
            Generate invite code
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
