'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useRevokeCaller, useRevokeCallerKey } from '../hooks/use-callers';
import {
  isKeyActive,
  type CallerKey,
  type CallerSummary,
} from '../schemas/callers-schemas';
import { AddKeyDialog, SealingKeyDialog } from './callers-dialogs';
import { CallersKeyId } from './callers-key-id';

const MS_PER_DAY = 86_400_000;
const EXPIRY_WARNING_DAYS = 14;
const MAX_ACTIVE_KEYS = 2;

function daysLeft(key: CallerKey, now: number): number {
  return Math.ceil((new Date(key.expiresAt).getTime() - now) / MS_PER_DAY);
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

type RevokeTarget =
  | { kind: 'key'; id: string }
  | { kind: 'caller'; id: string }
  | null;

function KeyRow({
  keyRow,
  now,
  callerRevoked,
  onRevoke,
}: {
  keyRow: CallerKey;
  now: number;
  callerRevoked: boolean;
  onRevoke: (keyId: string) => void;
}) {
  const active = isKeyActive(keyRow, now);
  const remaining = daysLeft(keyRow, now);
  const warn = active && remaining < EXPIRY_WARNING_DAYS;

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="space-y-1">
        <CallersKeyId keyId={keyRow.id} />
        <p className="text-muted-foreground text-xs">
          Created {formatDate(keyRow.createdAt)}
          {keyRow.revokedAt ? (
            <span> · Revoked</span>
          ) : active ? (
            <span className={warn ? 'text-destructive font-medium' : undefined}>
              {' '}
              · Expires {formatDate(keyRow.expiresAt)} ({remaining} days left)
              {warn ? ' · Expiring soon' : ''}
            </span>
          ) : (
            <span> · Expired</span>
          )}
        </p>
      </div>
      {active && !callerRevoked && (
        <Button variant="outline" size="sm" onClick={() => onRevoke(keyRow.id)}>
          Revoke key
        </Button>
      )}
    </li>
  );
}

function CallerCard({ caller, now }: { caller: CallerSummary; now: number }) {
  const revokeKey = useRevokeCallerKey();
  const revokeCaller = useRevokeCaller();
  const [target, setTarget] = useState<RevokeTarget>(null);
  const callerRevoked = caller.revokedAt !== null;
  const activeKeys = caller.keys.filter((k) => isKeyActive(k, now)).length;
  const pending = revokeKey.isPending || revokeCaller.isPending;

  async function confirm() {
    if (!target) return;
    try {
      const result =
        target.kind === 'key'
          ? await revokeKey.mutateAsync(target.id)
          : await revokeCaller.mutateAsync(target.id);
      if (result.ok) {
        toast.success(target.kind === 'key' ? 'Key revoked' : 'Caller revoked');
        setTarget(null);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {caller.name}
          <span className="bg-muted rounded px-2 py-0.5 text-xs font-normal">
            {caller.preset ?? 'custom'}
          </span>
          {callerRevoked && (
            <span className="text-destructive text-xs font-medium">
              Revoked
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Scopes: {caller.scopes.join(', ')} · Sealing key fingerprint{' '}
          <code>{caller.sealingFingerprint}</code> · Created{' '}
          {formatDate(caller.createdAt)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {caller.keys.length === 0 ? (
          <p className="text-muted-foreground text-sm">No keys registered.</p>
        ) : (
          <ul className="space-y-3">
            {caller.keys.map((k) => (
              <KeyRow
                key={k.id}
                keyRow={k}
                now={now}
                callerRevoked={callerRevoked}
                onRevoke={(id) => setTarget({ kind: 'key', id })}
              />
            ))}
          </ul>
        )}
        {!callerRevoked && (
          <div className="flex flex-wrap gap-2">
            <AddKeyDialog
              callerId={caller.id}
              disabled={activeKeys >= MAX_ACTIVE_KEYS}
            />
            <SealingKeyDialog callerId={caller.id} />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setTarget({ kind: 'caller', id: caller.id })}
            >
              Revoke caller
            </Button>
          </div>
        )}
        {activeKeys >= MAX_ACTIVE_KEYS && !callerRevoked && (
          <p className="text-muted-foreground text-xs">
            Two keys are active. Revoke one to add another.
          </p>
        )}
      </CardContent>

      <Dialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {target?.kind === 'caller' ? 'Revoke caller' : 'Revoke key'}
            </DialogTitle>
            <DialogDescription>
              {target?.kind === 'caller'
                ? `Revokes ${caller.name} and all its keys immediately and deletes its summary. This cannot be undone.`
                : 'The key stops working immediately. This cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function CallersList({
  callers,
  now,
}: {
  callers: CallerSummary[];
  now?: number;
}) {
  const [mountedAt] = useState(() => Date.now());
  const effectiveNow = now ?? mountedAt;
  if (callers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No API callers yet. Create one to let a trusted service read your
        summary or write to your journal.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {callers.map((caller) => (
        <CallerCard key={caller.id} caller={caller} now={effectiveNow} />
      ))}
    </div>
  );
}
