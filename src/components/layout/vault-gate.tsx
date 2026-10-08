'use client';

import { useVaultLock, VaultUnlockFlow } from '@/features/auth';
import type { ReactNode } from 'react';

export function VaultGate({ children }: { children: ReactNode }) {
  const { locked, unlock } = useVaultLock();
  if (!locked) return children;
  return <VaultUnlockFlow onUnlocked={unlock} />;
}
