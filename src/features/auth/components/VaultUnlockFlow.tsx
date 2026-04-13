'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { Loader2, Lock, Unlock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

export function VaultUnlockFlow() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const triggerShake = (message: string) => {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pin.length < 6) {
      triggerShake('PIN must be at least 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      if (res.status === 401) {
        setPin('');
        triggerShake('Incorrect PIN. Please try again.');
        inputRef.current?.focus();
        return;
      }

      if (!res.ok) {
        triggerShake('Failed to unlock vault. Please try again.');
        return;
      }

      router.refresh();
    } catch {
      triggerShake('Failed to reach server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <motion.div
        animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex w-full max-w-md flex-col items-center rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl"
      >
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
          {loading ? (
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

        <form onSubmit={handleUnlock} className="flex w-full flex-col gap-4">
          <Input
            ref={inputRef}
            type="password"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''));
              setError('');
            }}
            placeholder="••••••"
            className="border-zinc-800 bg-zinc-900 py-4 text-center font-mono text-3xl tracking-[1em] text-white focus-visible:ring-blue-500"
            autoFocus
            disabled={loading}
          />

          {error && (
            <p className="text-center text-sm font-medium text-red-400">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || pin.length < 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Decrypting keys...' : 'Unlock Vault'}
            {!loading && <Unlock className="h-5 w-5" />}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
