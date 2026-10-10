'use client';

import { useAuthIdentity } from '../hooks/use-auth-identity';

export function AuthIdentityWatcher({ userId }: { userId: string }) {
  useAuthIdentity(userId);
  return null;
}
