// Must match server-side derivations in @/lib/keystore exactly so derived bytes
// are identical across browser and server. Both sides read constants from
// @/lib/crypto-constants.
import {
  INTERMEDIATE_ITERATIONS,
  INTERMEDIATE_PBKDF2_SALT_PREFIX,
  KEY_LEN_BYTES,
  V1_ITERATIONS,
  V1_PBKDF2_SALT,
  V2_ITERATIONS,
} from '@/lib/crypto-constants';

async function deriveBitsBase64(
  pin: string,
  salt: string,
  iterations: number
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LEN_BYTES * 8
  );

  const bytes = new Uint8Array(bits);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Legacy v1 DEK derivation. Fixed salt + 100k iterations.
 * Kept for unlock-and-rekey of pre-2026-05-27 vaults; do not use for new code.
 */
export async function deriveKeyClient(pin: string): Promise<string> {
  return deriveBitsBase64(pin, V1_PBKDF2_SALT, V1_ITERATIONS);
}

/**
 * Current v2 DEK derivation. Per-user salt (Supabase user id) + 600k iterations
 * (OWASP 2025 PBKDF2-HMAC-SHA-256 minimum / FIPS-140 recommended).
 */
export async function deriveKeyClientV2(
  pin: string,
  userId: string
): Promise<string> {
  return deriveBitsBase64(pin, userId, V2_ITERATIONS);
}

/**
 * Intermediate DEK derivation from feat/logo-redesign (b71cd15). Used only by
 * the salvage path: when v1 canary verifies but encrypted rows were re-written
 * to this scheme during an aborted preview-branch migration.
 */
export async function deriveKeyClientIntermediate(
  pin: string,
  userId: string
): Promise<string> {
  return deriveBitsBase64(
    pin,
    INTERMEDIATE_PBKDF2_SALT_PREFIX + userId,
    INTERMEDIATE_ITERATIONS
  );
}
