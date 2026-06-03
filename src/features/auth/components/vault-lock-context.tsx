'use client';

import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

interface VaultLockValue {
  locked: boolean;
  lock: () => void;
  unlock: () => void;
}

const VaultLockContext = createContext<VaultLockValue | null>(null);

interface VaultLockProviderProps {
  initiallyUnlocked: boolean;
  children: ReactNode;
}

export function VaultLockProvider({
  initiallyUnlocked,
  children,
}: VaultLockProviderProps) {
  const [locked, setLocked] = useState(!initiallyUnlocked);

  const lock = useCallback(() => setLocked(true), []);
  const unlock = useCallback(() => setLocked(false), []);

  const value = useMemo<VaultLockValue>(
    () => ({ locked, lock, unlock }),
    [locked, lock, unlock]
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
