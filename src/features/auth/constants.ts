// Idle window before the vault auto-locks (spec security/008). Bounds exposure
// of decrypted data on an unattended device; the 6h absolute cookie maxAge in
// vault/route.ts remains the hard ceiling.
export const IDLE_LIMIT_MS = 15 * 60 * 1000;

// How often the idle watcher checks elapsed inactivity. Coarse on purpose —
// the lock fires within one tick of crossing IDLE_LIMIT_MS.
export const IDLE_CHECK_MS = 30 * 1000;

export const AUTH_CALLBACK_ERROR_MESSAGE =
  'Sign-in could not be completed. Please try again.';
export const OAUTH_LOGIN_ERROR = 'Couldn’t start sign-in. Please try again.';
export const EMAIL_SIGN_IN_UNAVAILABLE = 'Couldn’t sign in. Please try again.';

export const AUTH_IDENTITY_TEARDOWN_TIMEOUT_MS = 10_000;
export const AUTH_IDENTITY_CHANGED_MESSAGE =
  'Your session changed or could not be confirmed. Financial data is hidden.';
