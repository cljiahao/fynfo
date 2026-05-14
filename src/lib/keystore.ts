import { openCookie } from '@/lib/cookie-seal';
import { logger } from '@/lib/logger';
import { VAULT_DEK_COOKIE } from '@/lib/vault-cookie';
import { cookies } from 'next/headers';

// Re-exported for backward-compatible imports; defined in cookie-seal.
export { getSessionSecret } from '@/lib/cookie-seal';

/**
 * Resolves the 256-bit Data Encryption Key for Server Actions.
 * Returns null if the user's vault is locked (no key in session).
 */
export async function getVaultDekSession(): Promise<Buffer | null> {
  const cookieStore = await cookies();
  const secureCookieBlob = cookieStore.get(VAULT_DEK_COOKIE)?.value;

  if (!secureCookieBlob) return null;

  try {
    const masterKeyBase64 = openCookie(secureCookieBlob);
    return Buffer.from(masterKeyBase64, 'base64');
  } catch {
    logger.warn('vault session cookie decrypt failed (likely tamper / stale)');
    return null;
  }
}
