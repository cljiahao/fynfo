// Idle window before the vault auto-locks (spec security/008). Bounds exposure
// of decrypted data on an unattended device; the 6h absolute cookie maxAge in
// vault/route.ts remains the hard ceiling.
export const IDLE_LIMIT_MS = 15 * 60 * 1000;

// How often the idle watcher checks elapsed inactivity. Coarse on purpose —
// the lock fires within one tick of crossing IDLE_LIMIT_MS.
export const IDLE_CHECK_MS = 30 * 1000;
