'use client';

import { useVaultLock, VaultUnlockFlow } from '@/features/auth';

export function VaultGate() {
  const { locked, unlock } = useVaultLock();
  if (!locked) return null;
  return <VaultUnlockFlow onUnlocked={unlock} />;
}
