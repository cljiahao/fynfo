'use client';

import { VaultUnlockFlow } from '@/features/auth';
import { useState } from 'react';

interface VaultGateProps {
  initiallyUnlocked: boolean;
}

export function VaultGate({ initiallyUnlocked }: VaultGateProps) {
  const [unlocked, setUnlocked] = useState(initiallyUnlocked);
  if (unlocked) return null;
  return <VaultUnlockFlow onUnlocked={() => setUnlocked(true)} />;
}
