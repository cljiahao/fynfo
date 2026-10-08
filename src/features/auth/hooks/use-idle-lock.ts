'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useVaultLock } from '../components/vault-lock-context';
import { IDLE_CHECK_MS, IDLE_LIMIT_MS } from '../constants';

const ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'scroll',
  'visibilitychange',
] as const;

// Bumps to the activity ref are throttled to at most once per second so a burst
// of scroll/pointer events does not thrash on every frame.
const BUMP_THROTTLE_MS = 1000;

/**
 * Vault idle auto-lock watcher (spec security/008). Armed only while the vault
 * is unlocked: tracks last user activity, and after IDLE_LIMIT_MS of inactivity
 * clears the DEK cookie (POST /api/vault/lock), drops cached decrypted data,
 * and flips the vault to locked so the unlock overlay re-appears. Per-tab.
 */
export function useIdleLock(): void {
  const { locked, lock } = useVaultLock();
  const queryClient = useQueryClient();
  const lastActivityRef = useRef(0);
  const lockingRef = useRef(false);

  useEffect(() => {
    // Disarm entirely while locked — nothing to time, and the unlock overlay
    // owns the screen.
    if (locked) return;

    lastActivityRef.current = Date.now();
    lockingRef.current = false;
    let lastBump = lastActivityRef.current;

    const bump = () => {
      const now = Date.now();
      if (now - lastBump < BUMP_THROTTLE_MS) return;
      lastBump = now;
      lastActivityRef.current = now;
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, bump, { passive: true });
    }

    const interval = window.setInterval(() => {
      if (lockingRef.current) return;
      if (Date.now() - lastActivityRef.current < IDLE_LIMIT_MS) return;
      lockingRef.current = true;
      queryClient.clear();
      lock();
      void fetch('/api/vault/lock', { method: 'POST' }).catch(() => {
        // Network failure still locks client-side: fail safe, never leave the
        // dashboard unlocked. The cookie's 6h ceiling is the server backstop.
      });
    }, IDLE_CHECK_MS);

    return () => {
      window.clearInterval(interval);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, bump);
      }
    };
  }, [locked, lock, queryClient]);
}
