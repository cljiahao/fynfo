import {
  KEY_LEN_BYTES,
  PBKDF2_DIGEST,
  V2_ITERATIONS,
} from '@/lib/crypto-constants';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { promisify } from 'util';

const pbkdf2Async = promisify(crypto.pbkdf2);

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret)
    throw new Error('SESSION_SECRET environment variable is not set');
  return secret;
}

/**
 * PBKDF2 derivation: 600k iterations (OWASP 2025 minimum for SHA-256),
 * per-user salt bound to the Supabase user id. Front-loads work into the
 * authentication step so brute-force on a stolen PIN hash is infeasible.
 */
export async function deriveKeyFromPinV2(
  pin: string,
  userId: string
): Promise<Buffer> {
  return pbkdf2Async(pin, userId, V2_ITERATIONS, KEY_LEN_BYTES, PBKDF2_DIGEST);
}

function decryptCookiePayload(encryptedBase64: string): string {
  const payloadStr = Buffer.from(encryptedBase64, 'base64').toString('utf8');
  const { iv, data, tag } = JSON.parse(payloadStr) as {
    iv: string;
    data: string;
    tag: string;
  };

  const aesKey = crypto
    .createHash('sha256')
    .update(getSessionSecret())
    .digest();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    aesKey,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  let decrypted = decipher.update(data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Resolves the 256-bit Data Encryption Key for Server Actions.
 * Returns null if the user's vault is locked (no key in session).
 */
export async function getVaultDekSession(): Promise<Buffer | null> {
  const cookieStore = await cookies();
  const secureCookieBlob = cookieStore.get('fynfo_vault_dek')?.value;

  if (!secureCookieBlob) return null;

  try {
    const masterKeyBase64 = decryptCookiePayload(secureCookieBlob);
    return Buffer.from(masterKeyBase64, 'base64');
  } catch {
    logger.warn('vault session cookie decrypt failed (likely tamper / stale)');
    return null;
  }
}
