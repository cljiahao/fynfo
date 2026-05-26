'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Lock, Unlock } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { createSupabaseBrowserClient } from '@/integrations/clients/supabase';
import { deriveKeyClient, deriveKeyClientV2 } from '@/lib/client-crypto';

const pinSchema = z.object({
  pin: z
    .string()
    .min(6, 'PIN must be 6 digits')
    .max(6, 'PIN must be 6 digits')
    .regex(/^\d{6}$/, 'PIN must be 6 digits'),
});

type PinFormValues = z.infer<typeof pinSchema>;
type DerivedKeys = { derivedKey: string; derivedKeyV2: string };

interface VaultUnlockFlowProps {
  onUnlocked?: () => void;
}

export function VaultUnlockFlow({ onUnlocked }: VaultUnlockFlowProps) {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  // Pre-started derivation promise — kicked off on the 6th keystroke, before submit.
  const derivingRef = useRef<Promise<DerivedKeys> | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });
  }, []);

  const startDerive = useCallback(
    (pin: string): Promise<DerivedKeys> | null => {
      const userId = userIdRef.current;
      if (!userId) return null;
      return Promise.all([
        deriveKeyClient(pin),
        deriveKeyClientV2(pin, userId),
      ]).then(([derivedKey, derivedKeyV2]) => ({ derivedKey, derivedKeyV2 }));
    },
    []
  );

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

  const onSubmit = useCallback(
    async (values: PinFormValues) => {
      try {
        const pending = derivingRef.current ?? startDerive(values.pin);
        derivingRef.current = null;
        if (!pending) {
          const message = 'Session not ready. Please refresh and try again.';
          setError('pin', { message });
          toast.error(message);
          return;
        }
        const keys = await pending;

        const res = await fetch('/api/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(keys),
        });

        if (res.status === 401) {
          resetField('pin');
          setError('pin', { message: 'Incorrect PIN. Please try again.' });
          toast.error('Incorrect PIN. Please try again.');
          return;
        }

        if (!res.ok) {
          const message = 'Failed to unlock vault. Please try again.';
          setError('pin', { message });
          toast.error(message);
          return;
        }

        const body = (await res.json().catch(() => ({}))) as {
          rekeyed?: boolean;
        };
        if (body.rekeyed) {
          toast.success(
            'Vault upgraded to v2 encryption (PBKDF2 600k + per-user salt).'
          );
        }

        // Hide overlay immediately, then refresh data in background.
        onUnlocked?.();
        queryClient.invalidateQueries();
      } catch {
        const message = 'Failed to reach server. Please try again.';
        setError('pin', { message });
        toast.error(message);
      }
    },
    [queryClient, onUnlocked, resetField, setError, startDerive]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
          {isSubmitting ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <Lock className="h-8 w-8" />
          )}
        </div>

        <h2 className="mb-2 text-2xl font-bold text-white">Vault Locked</h2>
        <p className="mb-8 text-center text-zinc-400">
          Enter your secure 6-digit PIN to derive your encryption keys and
          unlock your financial dashboard.
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
                  inputMode="numeric"
                  maxLength={6}
                  value={value}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    onChange(clean);
                    if (clean.length === 6) {
                      // Start both derivations immediately — before submit.
                      derivingRef.current = startDerive(clean);
                      setTimeout(() => formRef.current?.requestSubmit(), 0);
                    } else {
                      derivingRef.current = null;
                    }
                  }}
                  placeholder="••••••"
                  aria-invalid={fieldState.invalid}
                  className="border-zinc-800 bg-zinc-900 py-4 text-center font-mono text-3xl tracking-[1em] text-white focus-visible:ring-blue-500"
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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Decrypting keys...' : 'Unlock Vault'}
            {!isSubmitting && <Unlock className="h-5 w-5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
