'use client';

import { useIdleLock } from '../hooks/use-idle-lock';

// Headless mount point for the idle auto-lock watcher (spec security/008).
// Renders nothing; lives inside VaultLockProvider so the hook can read context.
export function IdleLockWatcher() {
  useIdleLock();
  return null;
}
