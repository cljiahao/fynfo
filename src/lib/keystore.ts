import crypto from 'crypto';
import { cookies } from 'next/headers';

const ITERATIONS = 100000;
const KEY_LEN = 32; // 256 bits for AES-256
const DIGEST = 'sha256';

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret)
    throw new Error('SESSION_SECRET environment variable is not set');
  return secret;
}

const PBKDF2_SALT = 'fynfo_v1_salt';

/**
 * Derives a strong 256-bit Key Encryption Key (KEK) from a short numeric PIN.
 * Uses PBKDF2 to slow down brute-force guessing.
 */
export function deriveKeyFromPin(pin: string): Buffer {
  return crypto.pbkdf2Sync(pin, PBKDF2_SALT, ITERATIONS, KEY_LEN, DIGEST);
}

/**
 * Internal helper to securely decrypt the payload of the HttpOnly session cookie.
 */
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
    console.error('Failed to decrypt vault session cookie.');
    return null;
  }
}
