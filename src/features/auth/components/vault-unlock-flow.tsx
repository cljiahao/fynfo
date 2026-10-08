'use client';

import { SignOutButton } from './signout-button';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Lock, Unlock } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { createSupabaseBrowserClient } from '@/integrations/clients/supabase';
import { deriveKeyClient, deriveKeyLegacy } from '@/lib/client-crypto';

const UNLOCK_MESSAGES = [
  'Deriving encryption key…',
  'Running 600k PBKDF2 iterations…',
  'Verifying vault integrity…',
  'Unlocking your dashboard…',
] as const;

const PROGRESS_DURATION_MS = 1800;
const MESSAGE_INTERVAL_MS = 600;
// Bound surviving-query invalidation; freshly mounted pages own their skeletons.
const DATA_WAIT_TIMEOUT_MS = 6000;
const LOADING_DATA_MESSAGE = 'Loading your dashboard…';

const pinSchema = z.object({
  pin: z
    .string()
    .min(6, 'PIN must be 6 digits')
    .max(6, 'PIN must be 6 digits')
    .regex(/^\d{6}$/, 'PIN must be 6 digits'),
});

type PinFormValues = z.infer<typeof pinSchema>;

interface VaultUnlockFlowProps {
  onUnlocked?: () => void;
}

export function VaultUnlockFlow({ onUnlocked }: VaultUnlockFlowProps) {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const derivingRef = useRef<Promise<string> | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Progress + message state updated only from interval callbacks (not effect body).
  const [progress, setProgress] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  // Phase 2: DEK cookie set, invalidate before mounting the financial subtree.
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });
  }, []);

  const {
    control,
    handleSubmit,
    resetField,
    setError,
    formState: { isSubmitting },
  } = useForm<PinFormValues>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: '' },
  });

  // Phase 1 — key derivation: animate 0→90 while submitting. Once we flip to
  // loadingData (phase 2), this stops and the bar is pinned manually.
  useEffect(() => {
    if (!isSubmitting || loadingData) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(90, (elapsed / PROGRESS_DURATION_MS) * 90));
      setMsgIndex(
        Math.min(
          Math.floor(elapsed / MESSAGE_INTERVAL_MS),
          UNLOCK_MESSAGES.length - 1
        )
      );
    }, 50);
    return () => clearInterval(timer);
  }, [isSubmitting, loadingData]);

  // Invalidate surviving queries before mounting the unlocked dashboard. With
  // the financial subtree unmounted, its queries fetch fresh data on mount.
  const revealWhenReady = useCallback(async () => {
    setLoadingData(true);
    setProgress(95);
    await Promise.race([
      queryClient.invalidateQueries(),
      new Promise((resolve) => setTimeout(resolve, DATA_WAIT_TIMEOUT_MS)),
    ]);
    setProgress(100);
    onUnlocked?.();
  }, [queryClient, onUnlocked]);

  const getUserId = useCallback(async (): Promise<string> => {
    if (userIdRef.current) return userIdRef.current;
    const { data } = await createSupabaseBrowserClient().auth.getUser();
    const id = data.user?.id ?? '';
    userIdRef.current = id;
    return id;
  }, []);

  const onSubmit = useCallback(
    async (values: PinFormValues) => {
      try {
        const userId = await getUserId();

        const derivedKey = await (derivingRef.current ??
          deriveKeyClient(values.pin, userId));
        derivingRef.current = null;

        const res = await fetch('/api/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ derivedKey }),
        });

        if (res.ok) {
          await revealWhenReady();
          return;
        }

        if (res.status === 409) {
          const legacyKey = await deriveKeyLegacy(values.pin);
          const migrateRes = await fetch('/api/vault', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ derivedKey, legacyKey }),
          });

          if (migrateRes.ok) {
            await revealWhenReady();
            return;
          }

          if (migrateRes.status === 401) {
            resetField('pin');
            setError('pin', { message: 'Incorrect PIN. Please try again.' });
            toast.error('Incorrect PIN. Please try again.');
            return;
          }

          const message = 'Migration failed. Please try again.';
          resetField('pin');
          setError('pin', { message });
          toast.error(message);
          return;
        }

        if (res.status === 401) {
          resetField('pin');
          setError('pin', { message: 'Incorrect PIN. Please try again.' });
          toast.error('Incorrect PIN. Please try again.');
          return;
        }

        const message = 'Failed to unlock vault. Please try again.';
        resetField('pin');
        setError('pin', { message });
        toast.error(message);
      } catch {
        const message = 'Failed to reach server. Please try again.';
        resetField('pin');
        setError('pin', { message });
        toast.error(message);
      }
    },
    [getUserId, revealWhenReady, resetField, setError]
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-lock-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md"
    >
      <div className="border-border bg-card flex w-full max-w-md flex-col items-center rounded-2xl border p-8 shadow-2xl">
        <div className="bg-brand-subtle text-brand mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          {isSubmitting ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <Lock className="h-8 w-8" />
          )}
        </div>

        {isSubmitting && (
          <div className="bg-muted mb-4 h-1 w-full overflow-hidden rounded-full">
            <div
              className="bg-brand h-full rounded-full transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <h2 id="vault-lock-title" className="mb-2 text-2xl font-bold">
          Vault Locked
        </h2>
        <p className="text-muted-foreground mb-8 min-h-[3rem] text-center">
          {isSubmitting ? (
            <span className="animate-pulse">
              {loadingData ? LOADING_DATA_MESSAGE : UNLOCK_MESSAGES[msgIndex]}
            </span>
          ) : (
            'Enter your secure 6-digit PIN to derive your encryption keys and unlock your financial dashboard.'
          )}
        </p>

        <form
          ref={formRef}
          onSubmit={(e) => {
            void handleSubmit(onSubmit)(e);
          }}
          className="flex w-full flex-col gap-4"
        >
          <Controller
            name="pin"
            control={control}
            render={({ field: { ref, onChange, value }, fieldState }) => (
              <div className="flex flex-col gap-1">
                <Input
                  ref={ref}
                  type="password"
                  aria-label="6-digit vault PIN"
                  inputMode="numeric"
                  maxLength={6}
                  value={value}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    onChange(clean);
                    if (clean.length === 6 && userIdRef.current) {
                      derivingRef.current = deriveKeyClient(
                        clean,
                        userIdRef.current
                      );
                      setTimeout(() => formRef.current?.requestSubmit(), 0);
                    } else {
                      derivingRef.current = null;
                    }
                  }}
                  placeholder="••••••"
                  aria-invalid={fieldState.invalid}
                  className="border-input bg-background py-4 text-center font-mono text-3xl tracking-[1em]"
                  autoFocus
                  disabled={isSubmitting}
                />
                {fieldState.invalid && (
                  <FieldError
                    errors={[fieldState.error]}
                    className="text-center"
                  />
                )}
              </div>
            )}
          />

          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-brand-foreground hover:bg-brand/90 flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-semibold disabled:opacity-50"
          >
            {isSubmitting ? 'Unlocking…' : 'Unlock Vault'}
            {!isSubmitting && <Unlock className="h-5 w-5" />}
          </Button>
        </form>
        <div className="mt-4 w-full">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
