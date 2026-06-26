import { decryptPayload, encryptPayload } from '@/lib/crypto';
import {
  KEY_LEN_BYTES,
  PBKDF2_DIGEST,
  V2_ITERATIONS,
} from '@/lib/crypto-constants';
import crypto from 'crypto';

/**
 * Household key-wrapping primitives (spec 053, constitution §5.1a).
 *
 * A single random household key `K_h` encrypts all household data. It is stored
 * only *wrapped* — sealed under each member's PIN-derived DEK — and the raw key
 * never touches Supabase at rest. `K_h` is itself a 32-byte AES-256 key, so
 * wrap/unwrap reuse the existing field-encryption envelope (`crypto.ts`).
 */

/** Generates a fresh random 256-bit household key. */
export function generateKh(): Buffer {
  return crypto.randomBytes(KEY_LEN_BYTES);
}

/** Seals `K_h` under a wrapping key (a member's DEK, or an invite-derived key). */
export function wrapKh(kh: Buffer, key: Buffer): string {
  return encryptPayload(kh.toString('base64'), key);
}

/**
 * Recovers `K_h` from a wrapped blob. Throws `DecryptionError` (inherited from
 * `decryptPayload`) on a wrong key or a tampered blob.
 */
export function unwrapKh(wrapped: string, key: Buffer): Buffer {
  return Buffer.from(decryptPayload(wrapped, key), 'base64');
}

/**
 * Derives a 256-bit wrapping key from a one-time invite secret + per-invite
 * salt, using the same PBKDF2 parameters as the personal-vault DEK so the cost
 * floor is identical.
 */
export function deriveInviteKey(secret: string, saltB64: string): Buffer {
  const salt = Buffer.from(saltB64, 'base64');
  return crypto.pbkdf2Sync(
    secret,
    salt,
    V2_ITERATIONS,
    KEY_LEN_BYTES,
    PBKDF2_DIGEST
  );
}

/** SHA-256 hex of the invite secret — the non-reversible lookup key stored at rest. */
export function hashInviteCode(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Mints a one-time invite: a high-entropy, URL-safe secret handed to the second
 * member out-of-band, plus the PBKDF2 salt stored with the invite row. The raw
 * secret is never persisted (only its hash + the salt).
 */
export function generateInviteSecret(): { secret: string; saltB64: string } {
  return {
    secret: crypto.randomBytes(32).toString('base64url'),
    saltB64: crypto.randomBytes(16).toString('base64'),
  };
}
