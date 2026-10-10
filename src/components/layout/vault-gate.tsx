'use client';

import {
  AUTH_IDENTITY_CHANGED_MESSAGE,
  useVaultLock,
  VaultUnlockFlow,
} from '@/features/auth';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import type { ReactNode } from 'react';

export function VaultGate({ children }: { children: ReactNode }) {
  const { locked, invalidated, unlock } = useVaultLock();
  if (invalidated) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p role="status" className="text-muted-foreground">
          {AUTH_IDENTITY_CHANGED_MESSAGE}
        </p>
        <a
          href={PAGE_ROUTES.LOGIN}
          className="text-brand focus-visible:outline-ring underline underline-offset-4 focus-visible:outline focus-visible:outline-2"
        >
          Continue to sign in
        </a>
      </main>
    );
  }
  if (!locked) return children;
  return <VaultUnlockFlow onUnlocked={unlock} />;
}
