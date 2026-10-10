'use client';

import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

interface VaultLockValue {
  locked: boolean;
  invalidated: boolean;
  invalidate: () => void;
  lock: () => void;
  unlock: () => void;
}

const VaultLockContext = createContext<VaultLockValue | null>(null);

interface VaultLockProviderProps {
  initiallyUnlocked: boolean;
  userId?: string;
  children: ReactNode;
}

export function VaultLockProvider({
  initiallyUnlocked,
  userId,
  children,
}: VaultLockProviderProps) {
  const [locked, setLocked] = useState(!initiallyUnlocked);

  const [initialUserId] = useState(userId);
  const [identityInvalidated, setIdentityInvalidated] = useState(false);
  const invalidatedRef = useRef(false);
  const invalidated = identityInvalidated || userId !== initialUserId;
  const invalidate = useCallback(() => {
    invalidatedRef.current = true;
    setIdentityInvalidated(true);
    setLocked(true);
  }, []);

  const lock = useCallback(() => setLocked(true), []);
  const unlock = useCallback(() => {
    if (!invalidatedRef.current) setLocked(false);
  }, []);

  const value = useMemo<VaultLockValue>(
    () => ({
      locked: locked || invalidated,
      invalidated,
      invalidate,
      lock,
      unlock,
    }),
    [locked, invalidated, invalidate, lock, unlock]
  );

  return (
    <VaultLockContext.Provider value={value}>
      {children}
    </VaultLockContext.Provider>
  );
}

export function useVaultLock(): VaultLockValue {
  const ctx = useContext(VaultLockContext);
  if (!ctx) {
    throw new Error('useVaultLock must be used within a VaultLockProvider');
  }
  return ctx;
}
