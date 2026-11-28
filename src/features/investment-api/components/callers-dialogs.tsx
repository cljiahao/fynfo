'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  useAddCallerKey,
  useCreateCaller,
  useSetSealingKey,
} from '../hooks/use-callers';
import {
  addKeyInputSchema,
  CALLER_PRESET_NAMES,
  CALLER_PRESETS,
  createCallerInputSchema,
  setSealingKeyInputSchema,
  type CallerPreset,
} from '../schemas/callers-schemas';
import { CallersKeyId } from './callers-key-id';

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const KEY_HINT = '32-byte public key, base64 (44 characters)';

function ErrorText({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  ) : null;
}

function IssuedKey({ keyId }: { keyId: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm">
        Key registered. Give this key ID to the caller for its Authorization
        header.
      </p>
      <CallersKeyId keyId={keyId} />
    </div>
  );
}

export function CreateCallerDialog() {
  const create = useCreateCaller();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<CallerPreset>('ballast');
  const [signing, setSigning] = useState('');
  const [sealing, setSealing] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [keyId, setKeyId] = useState<string | null>(null);

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setName('');
      setSigning('');
      setSealing('');
      setError(null);
      setKeyId(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = {
      name,
      preset,
      signingPublicKey: signing.trim(),
      sealingPublicKey: sealing.trim(),
    };
    const parsed = createCallerInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setError(null);
    try {
      const result = await create.mutateAsync(parsed.data);
      if (result.ok) setKeyId(result.keyId);
      else setError(result.message);
    } catch {
      setError(GENERIC_ERROR);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button>Create caller</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API caller</DialogTitle>
          <DialogDescription>
            The caller generates its own keys. Paste the public keys only.
          </DialogDescription>
        </DialogHeader>
        {keyId ? (
          <IssuedKey keyId={keyId} />
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="caller-name">Name</Label>
              <Input
                id="caller-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="caller-preset">Preset</Label>
              <Select
                value={preset}
                onValueChange={(v) => setPreset(v as CallerPreset)}
              >
                <SelectTrigger id="caller-preset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALLER_PRESET_NAMES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p} ({CALLER_PRESETS[p].join(', ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="caller-signing">
                Signing public key (Ed25519)
              </Label>
              <Input
                id="caller-signing"
                value={signing}
                onChange={(e) => setSigning(e.target.value)}
                placeholder={KEY_HINT}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="caller-sealing">
                Sealing public key (X25519)
              </Label>
              <Input
                id="caller-sealing"
                value={sealing}
                onChange={(e) => setSealing(e.target.value)}
                placeholder={KEY_HINT}
                autoComplete="off"
              />
            </div>
            <ErrorText message={error} />
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Create
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AddKeyDialog({
  callerId,
  disabled,
}: {
  callerId: string;
  disabled: boolean;
}) {
  const add = useAddCallerKey();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [keyId, setKeyId] = useState<string | null>(null);

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setKey('');
      setError(null);
      setKeyId(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = addKeyInputSchema.safeParse({
      callerId,
      signingPublicKey: key.trim(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setError(null);
    try {
      const result = await add.mutateAsync(parsed.data);
      if (result.ok) setKeyId(result.keyId);
      else setError(result.message);
    } catch {
      setError(GENERIC_ERROR);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          Add key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add signing key</DialogTitle>
          <DialogDescription>
            Add the new key before revoking the old one so the caller keeps
            working during rotation. Keys expire after 90 days.
          </DialogDescription>
        </DialogHeader>
        {keyId ? (
          <IssuedKey keyId={keyId} />
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor={`add-key-${callerId}`}>
                Signing public key (Ed25519)
              </Label>
              <Input
                id={`add-key-${callerId}`}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={KEY_HINT}
                autoComplete="off"
              />
            </div>
            <ErrorText message={error} />
            <DialogFooter>
              <Button type="submit" disabled={add.isPending}>
                {add.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Add key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SealingKeyDialog({ callerId }: { callerId: string }) {
  const update = useSetSealingKey();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setKey('');
      setError(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = setSealingKeyInputSchema.safeParse({
      callerId,
      sealingPublicKey: key.trim(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setError(null);
    try {
      const result = await update.mutateAsync(parsed.data);
      if (result.ok) reset(false);
      else setError(result.message);
    } catch {
      setError(GENERIC_ERROR);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Change sealing key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change sealing key</DialogTitle>
          <DialogDescription>
            The caller&apos;s current summary is deleted and must be published
            again.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`sealing-key-${callerId}`}>
              Sealing public key (X25519)
            </Label>
            <Input
              id={`sealing-key-${callerId}`}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={KEY_HINT}
              autoComplete="off"
            />
          </div>
          <ErrorText message={error} />
          <DialogFooter>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
