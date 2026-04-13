'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { Loader2, Lock, Unlock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function VaultUnlockFlow() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 6) {
      setError('PIN must be at least 6 digits');
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
        throw new Error('Incorrect PIN. Please try again.');
      }
      if (!res.ok) {
        throw new Error('Failed to unlock vault. Please try again.');
      }

      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unlock failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
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
            type="password"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••••"
            className="border-zinc-800 bg-zinc-900 py-4 text-center font-mono text-3xl tracking-[1em] text-white focus-visible:ring-blue-500"
            autoFocus
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
