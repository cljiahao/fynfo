'use client';

import { SignOutButton } from './signout-button';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Lock } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSupabaseBrowserClient } from '@/integrations/clients/supabase';
import { deriveKeyClient, deriveKeyLegacy } from '@/lib/client-crypto';
import { useVaultStatus } from '../hooks/use-vault-status';

// Bound surviving-query invalidation; freshly mounted pages own their skeletons.
const DATA_WAIT_TIMEOUT_MS = 6000;
const LOADING_DATA_MESSAGE = 'Loading your dashboard…';

const pinSchema = z.object({
  pin: z
    .string()
    .min(6, 'PIN must be 6 digits')
    .max(6, 'PIN must be 6 digits')
    .regex(/^\d{6}$/, 'PIN must be 6 digits'),
  confirmation: z.string(),
});

type PinFormValues = z.infer<typeof pinSchema>;

interface VaultUnlockFlowProps {
  onUnlocked?: () => void;
}

export function VaultUnlockFlow({ onUnlocked }: VaultUnlockFlowProps) {
  const queryClient = useQueryClient();
  const fieldId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const derivingRef = useRef<Promise<string> | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Phase 2: DEK cookie set, invalidate before mounting the financial subtree.
  const [loadingData, setLoadingData] = useState(false);

  const vaultStatus = useVaultStatus();
  const vaultState =
    vaultStatus.isFetching || vaultStatus.isPending
      ? 'checking'
      : vaultStatus.isError
        ? 'error'
        : vaultStatus.data.initialized
          ? 'existing'
          : 'new';

  useEffect(() => {
    if (vaultState === 'new' || vaultState === 'existing')
      formRef.current
        ?.querySelector<HTMLInputElement>('input[name="pin"]')
        ?.focus();
  }, [vaultState]);

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
    defaultValues: { pin: '', confirmation: '' },
  });

  // Invalidate surviving queries before mounting the unlocked dashboard. With
  // the financial subtree unmounted, its queries fetch fresh data on mount.
  const revealWhenReady = useCallback(async () => {
    setLoadingData(true);
    await Promise.race([
      queryClient.invalidateQueries(),
      new Promise((resolve) => setTimeout(resolve, DATA_WAIT_TIMEOUT_MS)),
    ]);
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
      if (vaultState !== 'new' && vaultState !== 'existing') return;
      if (vaultState === 'new' && values.pin !== values.confirmation) {
        setError('confirmation', { message: 'PINs do not match.' });
        return;
      }
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
    [getUserId, revealWhenReady, resetField, setError, vaultState]
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-lock-title"
      aria-describedby="vault-lock-description"
      className="bg-background fixed inset-0 z-50 flex overflow-y-auto px-4 py-8 sm:py-12"
    >
      <div className="border-border bg-card text-card-foreground m-auto flex w-full max-w-sm shrink-0 flex-col rounded-2xl border p-6 shadow-lg sm:p-8">
        <div className="bg-muted text-foreground mb-5 flex size-10 items-center justify-center rounded-xl">
          {isSubmitting ? (
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          ) : (
            <Lock aria-hidden="true" className="size-5" />
          )}
        </div>

        <h2
          id="vault-lock-title"
          className="mb-2 text-2xl font-semibold tracking-tight"
        >
          {vaultState === 'new' ? 'Create your vault' : 'Vault Locked'}
        </h2>
        <p
          id="vault-lock-description"
          role="status"
          aria-live="polite"
          className="text-muted-foreground mb-6 text-sm leading-relaxed"
        >
          {isSubmitting ? (
            <span>
              {loadingData ? LOADING_DATA_MESSAGE : 'Unlocking your vault…'}
            </span>
          ) : vaultState === 'new' ? (
            'Choose a 6-digit PIN to protect your financial records.'
          ) : (
            'Enter your 6-digit PIN to unlock your financial records.'
          )}
        </p>

        {vaultState === 'checking' && (
          <p
            role="status"
            className="text-muted-foreground mb-4 text-sm leading-relaxed"
          >
            Checking your vault…
          </p>
        )}
        {vaultState === 'error' && (
          <div
            role="alert"
            className="bg-muted mb-4 space-y-3 rounded-lg p-3 text-sm"
          >
            <p>Couldn&apos;t check your vault. Retry to continue.</p>
            <Button
              variant="outline"
              onClick={() => {
                void vaultStatus.refetch();
              }}
            >
              Retry
            </Button>
          </div>
        )}
        {vaultState === 'new' && (
          <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
            Keep this PIN safe. Resetting your account password won&apos;t
            recover records encrypted with a forgotten PIN.
          </p>
        )}

        <form
          ref={formRef}
          method="post"
          onSubmit={(e) => {
            void handleSubmit(onSubmit)(e);
          }}
          className="flex w-full flex-col gap-4"
        >
          <Controller
            name="pin"
            control={control}
            render={({ field: { ref, onChange, value }, fieldState }) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${fieldId}-pin`}>Vault PIN</Label>
                <Input
                  id={`${fieldId}-pin`}
                  name="pin"
                  aria-describedby={
                    fieldState.invalid ? `${fieldId}-pin-error` : undefined
                  }
                  ref={ref}
                  type="password"
                  aria-label="6-digit vault PIN"
                  inputMode="numeric"
                  maxLength={6}
                  value={value}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    onChange(clean);
                    if (
                      clean.length === 6 &&
                      userIdRef.current &&
                      vaultState === 'existing'
                    ) {
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
                  className="border-input bg-background h-12 text-center font-mono text-2xl tracking-[0.5em] md:text-2xl"
                  disabled={
                    isSubmitting ||
                    vaultState === 'checking' ||
                    vaultState === 'error'
                  }
                />
                {fieldState.invalid && (
                  <FieldError
                    errors={[fieldState.error]}
                    id={`${fieldId}-pin-error`}
                  />
                )}
              </div>
            )}
          />

          {vaultState === 'new' && (
            <Controller
              name="confirmation"
              control={control}
              render={({ field, fieldState }) => (
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-confirmation`}>Confirm PIN</Label>
                  <Input
                    id={`${fieldId}-confirmation`}
                    aria-describedby={
                      fieldState.invalid
                        ? `${fieldId}-confirmation-error`
                        : undefined
                    }
                    className="h-12 text-center font-mono text-2xl tracking-[0.5em] md:text-2xl"
                    {...field}
                    type="password"
                    aria-label="Confirm vault PIN"
                    aria-invalid={fieldState.invalid}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    onChange={(event) =>
                      field.onChange(event.target.value.replace(/\D/g, ''))
                    }
                    disabled={isSubmitting}
                  />
                  {fieldState.invalid && (
                    <FieldError
                      id={`${fieldId}-confirmation-error`}
                      errors={[fieldState.error]}
                    />
                  )}
                </div>
              )}
            />
          )}

          <Button
            type="submit"
            disabled={
              isSubmitting ||
              vaultState === 'checking' ||
              vaultState === 'error'
            }
            className="h-12 w-full rounded-lg font-semibold"
          >
            {isSubmitting
              ? 'Unlocking…'
              : vaultState === 'new'
                ? 'Create vault'
                : 'Unlock Vault'}
            {isSubmitting && (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            )}
          </Button>
        </form>
        <div className="border-border mt-5 border-t pt-3">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
