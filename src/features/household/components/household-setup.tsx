'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Home, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAcceptInvite, useCreateHousehold } from '../hooks/use-household';

/**
 * Shown when the signed-in user is in no household yet: create a new one, or
 * join an existing one with a partner's one-time invite code.
 */
export function HouseholdSetup() {
  const createHousehold = useCreateHousehold();
  const acceptInvite = useAcceptInvite();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const create = () => {
    if (!name.trim()) {
      toast.error('Give your household a name');
      return;
    }
    createHousehold.mutate(name.trim(), {
      onSuccess: () => toast.success('Household created'),
      onError: () => toast.error('Could not create the household'),
    });
  };

  const join = () => {
    if (!code.trim()) {
      toast.error('Enter the invite code your partner shared');
      return;
    }
    acceptInvite.mutate(code.trim(), {
      onSuccess: () => toast.success('Joined the household'),
      onError: () => toast.error('That invite code is not valid'),
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <div className="flex-center bg-primary size-8 rounded-lg">
              <Home className="text-primary-foreground size-4" />
            </div>
            <h2 className="font-semibold">Start a household</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Create a shared space for joint goals. Your personal vault stays
            private — only what you add here is shared.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="household-name">Household name</Label>
            <Input
              id="household-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Home"
              maxLength={80}
            />
          </div>
          <Button onClick={create} disabled={createHousehold.isPending}>
            Create household
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <div className="bg-muted flex-center size-8 rounded-lg">
              <KeyRound className="size-4" />
            </div>
            <h2 className="font-semibold">Join with a code</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Your partner created the household and shared a one-time invite
            code. Enter it to join.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="invite-code">Invite code</Label>
            <Input
              id="invite-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste the code"
              className="font-mono text-xs"
            />
          </div>
          <Button
            variant="outline"
            onClick={join}
            disabled={acceptInvite.isPending}
          >
            Join household
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
