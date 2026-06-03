// Single source of truth for the vault DEK cookie name + base attributes, so
// the set (vault/route.ts) and clear (vault/lock/route.ts) stay in lock-step.
// keystore.ts reads the same name. Only `maxAge` differs between set/clear.
export const VAULT_DEK_COOKIE = 'fynfo_vault_dek';

export const VAULT_COOKIE_BASE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};
